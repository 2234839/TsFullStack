import { Task, TaskStep, TaskStatus, ExecutionStatus, PlannedStep } from './types';
import { ToolRegistry } from './tool-registry';
import { JsonStorage } from './storage';
import { Logger } from './logger';
import { InteractiveService } from './interactive-service';

export interface TaskManagerConfig {
  maxRetries?: number;
  retryDelay?: number;
  maxTaskDuration?: number;
  enableAutoValidation?: boolean;
  enableAutoRepair?: boolean;
  parallelExecution?: boolean;
}

export interface TaskResult {
  success: boolean;
  task: Task;
  output?: any;
  error?: string;
  executionTime: number;
  stepsExecuted: number;
}

export class TaskManager {
  private config: TaskManagerConfig;
  private toolRegistry: ToolRegistry;
  private storage: JsonStorage;
  private logger: Logger;
  private interactiveService?: InteractiveService;
  private activeTasks: Map<string, { startTime: number; timeout?: NodeJS.Timeout }> = new Map();

  constructor(
    config: TaskManagerConfig,
    toolRegistry: ToolRegistry,
    storage: JsonStorage,
    logger: Logger,
    interactiveService?: InteractiveService
  ) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      maxTaskDuration: 300000, // 5 minutes
      enableAutoValidation: true,
      enableAutoRepair: true,
      parallelExecution: false,
      ...config
    };
    this.toolRegistry = toolRegistry;
    this.storage = storage;
    this.logger = logger;
    this.interactiveService = interactiveService;
  }

  async executeTask(description: string): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Create task
      const task = await this.createTask(description);
      await this.storage.saveTask(task);

      this.logger.info(`Starting task execution`, { 
        taskId: task.id, 
        description 
      }, 'TaskManager');

      // Start timeout monitoring
      this.startTaskTimeout(task.id, this.config.maxTaskDuration!);

      try {
        // Plan steps
        const plannedSteps = await this.planSteps(description, task);
        this.logger.debug(`Planned ${plannedSteps.length} steps`, { 
          steps: plannedSteps 
        }, 'TaskManager');

        // Execute steps
        const executionResult = await this.executeSteps(task.id, plannedSteps);
        
        // Validate result if enabled
        if (this.config.enableAutoValidation && executionResult.success) {
          await this.validateTaskResult(task.id);
        }

        // Mark task as completed
        await this.completeTask(task.id, executionResult);

        const executionTime = Date.now() - startTime;
        this.logger.info(`Task completed successfully`, { 
          taskId: task.id, 
          executionTime,
          stepsExecuted: executionResult.stepsExecuted
        }, 'TaskManager');

        const finalTask = await this.storage.getTask(task.id);
        if (!finalTask) {
          throw new Error(`Task ${task.id} not found after completion`);
        }

        return {
          success: true,
          task: finalTask,
          output: executionResult.output,
          executionTime,
          stepsExecuted: executionResult.stepsExecuted
        };

      } catch (error) {
        // Handle task failure
        const errorResult = await this.handleTaskFailure(task.id, error);
        const executionTime = Date.now() - startTime;

        this.logger.error(`Task failed`, { 
          taskId: task.id, 
          error: errorResult.error,
          executionTime
        }, 'TaskManager');

        const failedTask = await this.storage.getTask(task.id);
        if (!failedTask) {
          throw new Error(`Task ${task.id} not found after failure`);
        }

        return {
          success: false,
          task: failedTask,
          error: errorResult.error,
          executionTime,
          stepsExecuted: errorResult.stepsExecuted
        };
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Task creation failed`, { 
        error: errorMessage, 
        description,
        executionTime
      }, 'TaskManager');

      return {
        success: false,
        task: null as unknown as Task,
        error: errorMessage,
        executionTime,
        stepsExecuted: 0
      };
    }
  }

  private async createTask(description: string): Promise<Task> {
    const task: Task = {
      id: this.generateId(),
      description,
      status: 'pending',
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return task;
  }

  private async planSteps(description: string, task: Task): Promise<PlannedStep[]> {
    // Simple rule-based planning - in a real system this would use LLM
    const steps: PlannedStep[] = [];
    const lowerDescription = description.toLowerCase();

    // File operations
    if (lowerDescription.includes('文件') || lowerDescription.includes('file')) {
      if (lowerDescription.includes('创建') || lowerDescription.includes('创建') || lowerDescription.includes('write')) {
        const contentMatch = description.match(/["']([^"']+)["']/) || description.match(/["']([^"']+)["']/);
        const content = contentMatch ? contentMatch[1] : 'Hello World';
        
        const pathMatch = description.match(/([a-zA-Z0-9_\-\.\/]+\.(txt|md|json|js|ts))/);
        const filename = pathMatch ? pathMatch[1] : './data/test.txt';
        
        steps.push({
          toolName: 'file_write',
          input: { path: filename, content },
          description: `Create file ${filename} with content`
        });
      }
    }

    // Command execution
    if (lowerDescription.includes('命令') || lowerDescription.includes('command') || lowerDescription.includes('执行')) {
      const commandMatch = description.match(/["']([^"']+)["']/);
      const command = commandMatch ? commandMatch[1] : 'echo "Hello World"';
      
      steps.push({
        toolName: 'command_execute',
        input: { command, args: [] },
        description: `Execute command: ${command}`
      });
    }

    // HTTP requests
    if (lowerDescription.includes('http') || lowerDescription.includes('请求') || lowerDescription.includes('request')) {
      const urlMatch = description.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : 'https://httpbin.org/get';
      
      steps.push({
        toolName: 'http_request',
        input: { url, method: 'GET' },
        description: `Make HTTP request to ${url}`
      });
    }

    // If no specific tools identified, create a simple info step
    if (steps.length === 0) {
      steps.push({
        toolName: 'info',
        input: { message: `Processing task: ${description}` },
        description: 'Process task description'
      });
    }

    this.logger.debug(`Planned steps for task`, { 
      taskId: task.id, 
      steps: steps.length 
    }, 'TaskManager');

    return steps;
  }

  private async executeSteps(taskId: string, plannedSteps: PlannedStep[]): Promise<{
    success: boolean;
    output?: any;
    stepsExecuted: number;
  }> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let finalOutput: any = null;
    let stepsExecuted = 0;

    for (let i = 0; i < plannedSteps.length; i++) {
      const plannedStep = plannedSteps[i];
      
      // Create task step
      const taskStep: TaskStep = {
        id: this.generateId(),
        toolName: plannedStep.toolName,
        input: plannedStep.input,
        status: 'pending',
        startTime: new Date()
      };

      // Add step to task
      task.steps.push(taskStep);
      await this.storage.saveTask(task);

      this.logger.debug(`Executing step ${i + 1}/${plannedSteps.length}`, { 
        taskId,
        stepId: taskStep.id,
        toolName: plannedStep.toolName
      }, 'TaskManager');

      try {
        // Execute step with retry logic
        const result = await this.executeStepWithRetry(taskStep, plannedStep);
        
        // Update step result
        taskStep.status = result.success ? 'completed' : 'failed';
        taskStep.output = result.output;
        taskStep.error = result.error;
        taskStep.endTime = new Date();
        taskStep.duration = result.duration;

        if (!result.success) {
          throw new Error(`Step ${i + 1} failed: ${result.error}`);
        }

        // Collect output
        finalOutput = result.output;
        stepsExecuted++;

      } catch (error) {
        taskStep.status = 'failed';
        taskStep.error = error instanceof Error ? error.message : String(error);
        taskStep.endTime = new Date();
        
        await this.storage.saveTask(task);
        throw error;
      }

      await this.storage.saveTask(task);
    }

    return { success: true, output: finalOutput, stepsExecuted };
  }

  private async executeStepWithRetry(step: TaskStep, plannedStep: PlannedStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
    duration: number;
  }> {
    let lastError: string | null = null;

    // Interactive confirmation before execution
    if (this.interactiveService && this.interactiveService.isEnabled()) {
      const confirmed = await this.interactiveService.confirmExecution(
        plannedStep.toolName,
        plannedStep.input,
        plannedStep.description
      );
      
      if (!confirmed) {
        return {
          success: false,
          error: 'User cancelled execution',
          duration: 0
        };
      }
    }

    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const result = await this.toolRegistry.execute(
          plannedStep.toolName,
          plannedStep.input,
          `TaskStep-${step.id}`
        );

        if (result.success) {
          return result;
        } else {
          lastError = result.error || null;
          if (attempt < this.config.maxRetries!) {
            await this.delay(this.config.retryDelay! * attempt);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < this.config.maxRetries!) {
          await this.delay(this.config.retryDelay! * attempt);
        }
      }
    }

    return {
      success: false,
      error: lastError || `Step failed after ${this.config.maxRetries} attempts`,
      duration: 0
    };
  }

  private async validateTaskResult(taskId: string): Promise<void> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    this.logger.debug(`Validating task result`, { taskId }, 'TaskManager');

    // Simple validation - check if all steps completed successfully
    const failedSteps = task.steps.filter(step => step.status === 'failed');
    if (failedSteps.length > 0) {
      throw new Error(`${failedSteps.length} steps failed`);
    }

    // Check if we have meaningful output
    if (!task.result && task.steps.length > 0) {
      const lastStep = task.steps[task.steps.length - 1];
      if (lastStep.output) {
        task.result = lastStep.output;
      }
    }

    await this.storage.saveTask(task);
  }

  private async handleTaskFailure(taskId: string, error: any): Promise<{
    error: string;
    stepsExecuted: number;
  }> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      return { error: String(error), stepsExecuted: 0 };
    }

    // Update task status
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : String(error);
    task.updatedAt = new Date();
    task.completedAt = new Date();

    await this.storage.saveTask(task);

    // Auto-repair logic if enabled
    if (this.config.enableAutoRepair) {
      await this.attemptAutoRepair(task, error);
    }

    const stepsExecuted = task.steps.filter(step => step.status === 'completed').length;
    return { error: task.error, stepsExecuted };
  }

  private async attemptAutoRepair(task: Task, error: any): Promise<void> {
    this.logger.info(`Attempting auto-repair for task`, { 
      taskId: task.id, 
      error: String(error) 
    }, 'TaskManager');

    // Simple repair strategies
    const errorMessage = String(error).toLowerCase();
    
    if (errorMessage.includes('timeout')) {
      // Retry with longer timeout
      this.logger.debug(`Repair strategy: Retry with longer timeout`, { taskId: task.id }, 'TaskManager');
      // Implementation would involve retrying failed steps with longer timeouts
    } else if (errorMessage.includes('permission')) {
      // Try alternative tools
      this.logger.debug(`Repair strategy: Try alternative tools`, { taskId: task.id }, 'TaskManager');
      // Implementation would involve finding alternative tools
    } else if (errorMessage.includes('not found')) {
      // Create missing resources
      this.logger.debug(`Repair strategy: Create missing resources`, { taskId: task.id }, 'TaskManager');
      // Implementation would involve creating missing files/directories
    }
  }

  private async completeTask(taskId: string, result: {
    success: boolean;
    output?: any;
    stepsExecuted: number;
  }): Promise<void> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'completed';
    task.result = result.output;
    task.updatedAt = new Date();
    task.completedAt = new Date();

    await this.storage.saveTask(task);
    this.clearTaskTimeout(taskId);
  }

  private startTaskTimeout(taskId: string, duration: number): void {
    const timeout = setTimeout(() => {
      this.handleTaskTimeout(taskId);
    }, duration);

    this.activeTasks.set(taskId, { startTime: Date.now(), timeout });
  }

  private clearTaskTimeout(taskId: string): void {
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask && activeTask.timeout) {
      clearTimeout(activeTask.timeout);
    }
    this.activeTasks.delete(taskId);
  }

  private async handleTaskTimeout(taskId: string): Promise<void> {
    this.logger.warn(`Task timeout`, { taskId }, 'TaskManager');
    
    const task = await this.storage.getTask(taskId);
    if (task && task.status === 'running') {
      await this.handleTaskFailure(taskId, new Error('Task execution timeout'));
    }
    
    this.clearTaskTimeout(taskId);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for task management
  async getTaskStatus(taskId: string): Promise<Task | null> {
    return await this.storage.getTask(taskId);
  }

  async getActiveTasks(): Promise<Task[]> {
    return await this.storage.getTasks({ status: 'running' });
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.storage.getTask(taskId);
    if (!task || task.status === 'completed') {
      return false;
    }

    task.status = 'failed';
    task.error = 'Task cancelled by user';
    task.updatedAt = new Date();
    task.completedAt = new Date();

    await this.storage.saveTask(task);
    this.clearTaskTimeout(taskId);

    this.logger.info(`Task cancelled`, { taskId }, 'TaskManager');
    return true;
  }

  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
  }> {
    const tasks = await this.storage.getTasks();
    
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      running: tasks.filter(t => t.status === 'running').length,
      pending: tasks.filter(t => t.status === 'pending').length
    };
  }
}