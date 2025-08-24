import { AgentConfig, Task, ToolDefinition } from './types';
import { TaskResult } from './task-manager';
import { TaskManager, TaskManagerConfig } from './task-manager';
import { ToolRegistry, ToolRegistryConfig } from './tool-registry';
import { JsonStorage, StorageConfig } from './storage';
import { Logger, LoggerConfig } from './logger';
import { LLMService, LLMTaskType } from './llm-service';
import { InteractiveService } from './interactive-service';
import {
  builtInTools,
  fileWriteTool,
  fileReadTool,
  fileDeleteTool,
  fileListTool,
  commandExecuteTool,
  commandExecuteSyncTool,
  systemInfoTool,
  httpRequestTool,
  httpGetTool,
  httpPostTool,
  ImageAnalysisTool,
  ImageGenerationTool,
  OCRTool,
  VideoGenerationTool,
  VideoAnalysisTool,
  VideoScriptTool
} from './tools';

export class TsAgent {
  private config: AgentConfig;
  private storage: JsonStorage;
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  private taskManager: TaskManager;
  private llmService: LLMService;
  private interactiveService: InteractiveService;
  private isInitialized = false;

  // Advanced agent features
  private knowledge: Map<string, any> = new Map();
  private memory: Array<{ timestamp: Date; action: string; result: any; success: boolean }> = [];
  private maxMemorySize: number = 1000;

  constructor(config: AgentConfig) {
    this.config = this.validateConfig(config);
    this.logger = new Logger(this.config.logging);
    this.storage = new JsonStorage(this.config.storage);
    this.toolRegistry = new ToolRegistry(this.config.tools, this.logger);

    // Initialize LLM service
    const llmTaskModels: LLMTaskType = {
      planning: 'glm-4.5',
      execution: 'glm-4.5',
      validation: 'glm-4.5-air',
      repair: 'glm-4.5-air',
      general: 'glm-4.5'
    };

    this.llmService = new LLMService(llmTaskModels, this.logger);

    // Initialize interactive service
    const interactiveConfig = this.config.interactive || {
      enabled: false,
      confirmBeforeExecution: false,
      askForClarification: false,
      maxQuestions: 5
    };
    this.interactiveService = new InteractiveService(interactiveConfig, this.logger);

    this.taskManager = new TaskManager(
      {
        maxRetries: this.config.security.maxTaskDuration > 0 ? 3 : 0,
        maxTaskDuration: this.config.security.maxTaskDuration,
        enableAutoValidation: true,
        enableAutoRepair: this.config.security.safeMode
      },
      this.toolRegistry,
      this.storage,
      this.logger,
      this.interactiveService
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Agent already initialized', null, 'TsAgent');
      return;
    }

    try {
      this.logger.info('Initializing TsAgent', {
        version: '1.0.0',
        config: this.config
      }, 'TsAgent');

      // Initialize storage
      await this.storage.init();
      this.logger.debug('Storage initialized', null, 'TsAgent');

      // Initialize LLM service
      await this.llmService.initialize();
      this.logger.debug('LLM service initialized', null, 'TsAgent');

      // Load built-in tools
      await this.loadBuiltInTools();
      this.logger.debug('Built-in tools loaded', null, 'TsAgent');

      // Load tools from directory if enabled
      if (this.config.tools.autoLoad && this.config.tools.directory) {
        const loadedCount = await this.toolRegistry.loadToolsFromDirectory();
        this.logger.info(`Loaded ${loadedCount} tools from directory`, {
          directory: this.config.tools.directory
        }, 'TsAgent');
      }

      // Validate all tools
      const validation = await this.toolRegistry.validateAllTools();
      if (validation.invalid.length > 0) {
        this.logger.warn('Some tools failed validation', {
          invalid: validation.invalid.map(t => ({ tool: t.tool.name, errors: t.errors }))
        }, 'TsAgent');
      }

      this.isInitialized = true;
      this.logger.info('TsAgent initialized successfully', {
        toolsCount: validation.valid.length,
        invalidTools: validation.invalid.length
      }, 'TsAgent');

    } catch (error) {
      this.logger.error('Failed to initialize TsAgent', {
        error: error instanceof Error ? error.message : String(error)
      }, 'TsAgent');
      throw error;
    }
  }

  async executeTask(description: string): Promise<TaskResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Executing task', { description }, 'TsAgent');

    try {
      const result = await this.taskManager.executeTask(description);
      this.logger.info('Task execution completed', {
        success: result.success,
        executionTime: result.executionTime,
        stepsExecuted: result.stepsExecuted
      }, 'TsAgent');

      return result;
    } catch (error) {
      this.logger.error('Task execution failed', {
        error: error instanceof Error ? error.message : String(error),
        description
      }, 'TsAgent');
      throw error;
    }
  }

  async registerTool(tool: ToolDefinition): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Registering tool', {
      name: tool.name,
      version: tool.version
    }, 'TsAgent');

    try {
      await this.toolRegistry.register(tool);
      this.logger.info('Tool registered successfully', {
        name: tool.name
      }, 'TsAgent');
    } catch (error) {
      this.logger.error('Failed to register tool', {
        error: error instanceof Error ? error.message : String(error),
        toolName: tool.name
      }, 'TsAgent');
      throw error;
    }
  }

  async unregisterTool(toolName: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Unregistering tool', { toolName }, 'TsAgent');

    try {
      const success = await this.toolRegistry.unregister(toolName);
      if (success) {
        this.logger.info('Tool unregistered successfully', { toolName }, 'TsAgent');
      } else {
        this.logger.warn('Tool not found for unregistration', { toolName }, 'TsAgent');
      }
      return success;
    } catch (error) {
      this.logger.error('Failed to unregister tool', {
        error: error instanceof Error ? error.message : String(error),
        toolName
      }, 'TsAgent');
      throw error;
    }
  }

  async getTaskStatus(taskId: string): Promise<Task | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.taskManager.getTaskStatus(taskId);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Cancelling task', { taskId }, 'TsAgent');
    return await this.taskManager.cancelTask(taskId);
  }

  async getAvailableTools(): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.toolRegistry.getToolNames();
  }

  async getToolInfo(toolName: string): Promise<ToolDefinition | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.toolRegistry.getTool(toolName) || null;
  }

  async getStats(): Promise<{
    tasks: any;
    tools: any;
    system: any;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const [taskStats, toolStats, storageStats] = await Promise.all([
      this.taskManager.getTaskStats(),
      this.toolRegistry.getToolStats(),
      this.storage.getStats()
    ]);

    return {
      tasks: taskStats,
      tools: toolStats,
      system: {
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        initialized: this.isInitialized
      }
    };
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Exporting data', { format }, 'TsAgent');
    return await this.storage.exportData(format);
  }

  async importData(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Importing data', { format }, 'TsAgent');
    await this.storage.importData(data, format);
  }

  async cleanup(maxAge?: number): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Cleaning up old data', { maxAge }, 'TsAgent');
    return await this.storage.cleanup(maxAge);
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down TsAgent', null, 'TsAgent');

    try {
      // Flush any pending logs
      await this.logger.flush();

      // Perform backup
      await this.storage.backup();

      this.isInitialized = false;
      this.logger.info('TsAgent shutdown completed', null, 'TsAgent');
    } catch (error) {
      this.logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error)
      }, 'TsAgent');
    }
  }

  private validateConfig(config: AgentConfig): AgentConfig {
    const validatedConfig = { ...config };

    // Validate storage config
    if (!validatedConfig.storage.type) {
      validatedConfig.storage.type = 'json';
    }

    if (!validatedConfig.storage.dataDir) {
      validatedConfig.storage.dataDir = './data';
    }

    // Validate security config
    if (validatedConfig.security.maxTaskDuration <= 0) {
      validatedConfig.security.maxTaskDuration = 300000; // 5 minutes
    }

    // Validate logging config
    if (!validatedConfig.logging.level) {
      validatedConfig.logging.level = 'info';
    }

    // Validate tools config
    if (!validatedConfig.tools.timeout) {
      validatedConfig.tools.timeout = 30000;
    }

    return validatedConfig;
  }

  private async loadBuiltInTools(): Promise<void> {
    // Load basic built-in tools
    const basicTools = [
      fileWriteTool,
      fileReadTool,
      fileDeleteTool,
      fileListTool,
      commandExecuteTool,
      commandExecuteSyncTool,
      systemInfoTool,
      httpRequestTool,
      httpGetTool,
      httpPostTool
    ];

    // Register basic tools
    for (const tool of basicTools) {
      try {
        await this.toolRegistry.register(tool);
        this.logger.debug(`Built-in tool registered`, {
          name: tool.name,
          version: tool.version
        }, 'TsAgent');
      } catch (error) {
        this.logger.error(`Failed to register built-in tool`, {
          error: error instanceof Error ? error.message : String(error),
          toolName: tool.name
        }, 'TsAgent');
      }
    }

    // Register LLM-dependent tools if LLM service is available
    if (this.llmService) {
      const llmTools = [
        new ImageAnalysisTool(this.llmService, this.logger),
        new ImageGenerationTool(this.llmService, this.logger),
        new OCRTool(this.llmService, this.logger),
        new VideoGenerationTool(this.llmService, this.logger),
        new VideoAnalysisTool(this.llmService, this.logger),
        new VideoScriptTool(this.llmService, this.logger)
      ];

      for (const tool of llmTools) {
        try {
          await this.toolRegistry.register(tool);
          this.logger.debug(`LLM tool registered`, {
            name: tool.name,
            version: tool.version
          }, 'TsAgent');
        } catch (error) {
          this.logger.error(`Failed to register LLM tool`, {
            error: error instanceof Error ? error.message : String(error),
            toolName: tool.name
          }, 'TsAgent');
        }
      }
    }

    const totalTools = basicTools.length + (this.llmService ? 6 : 0);
    this.logger.info(`Loaded ${totalTools} built-in tools`, null, 'TsAgent');
  }

  // Configuration updates
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.updateConfig(this.config.logging);
    this.toolRegistry.updateConfig(this.config.tools);
    this.logger.info('Agent configuration updated', { config }, 'TsAgent');
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      storage: boolean;
      tools: boolean;
      tasks: boolean;
    };
    details: any;
  }> {
    const checks = {
      storage: false,
      tools: false,
      tasks: false
    };

    const details: any = {};

    try {
      // Check storage
      await this.storage.getStats();
      checks.storage = true;
    } catch (error) {
      details.storage = error instanceof Error ? error.message : String(error);
    }

    try {
      // Check tools
      const tools = this.toolRegistry.getAllTools();
      checks.tools = tools.length > 0;
      details.toolsCount = tools.length;
    } catch (error) {
      details.tools = error instanceof Error ? error.message : String(error);
    }

    try {
      // Check task manager
      const stats = await this.taskManager.getTaskStats();
      checks.tasks = true;
      details.taskStats = stats;
    } catch (error) {
      details.tasks = error instanceof Error ? error.message : String(error);
    }

    const failedChecks = Object.values(checks).filter(check => !check).length;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (failedChecks === Object.keys(checks).length) {
      status = 'unhealthy';
    } else if (failedChecks > 0) {
      status = 'degraded';
    }

    return { status, checks, details };
  }

  // Get agent version
  getVersion(): string {
    return '1.0.0';
  }

  // Advanced agent methods - Knowledge and Memory Management
  async addToKnowledge(key: string, value: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.knowledge.set(key, value);
    this.logger.debug('Added to knowledge base', { key, type: typeof value }, 'TsAgent');
  }

  async getFromKnowledge(key: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.knowledge.get(key);
  }

  async getAllKnowledge(): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return Object.fromEntries(this.knowledge);
  }

  async clearKnowledge(): Promise<void> {
    this.knowledge.clear();
    this.logger.debug('Knowledge base cleared', null, 'TsAgent');
  }

  async addToMemory(action: string, result: any, success: boolean = true): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.memory.push({
      timestamp: new Date(),
      action,
      result,
      success
    });

    // Maintain memory size limit
    if (this.memory.length > this.maxMemorySize) {
      this.memory = this.memory.slice(-this.maxMemorySize);
    }

    this.logger.debug('Added to memory', {
      action: action.substring(0, 50),
      success,
      memorySize: this.memory.length
    }, 'TsAgent');
  }

  async getRecentMemory(count: number = 10): Promise<Array<{
    timestamp: Date;
    action: string;
    result: any;
    success: boolean;
  }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.memory.slice(-count);
  }

  async searchMemory(query: string): Promise<Array<{
    timestamp: Date;
    action: string;
    result: any;
    success: boolean;
  }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const lowerQuery = query.toLowerCase();
    return this.memory.filter(mem =>
      mem.action.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(mem.result).toLowerCase().includes(lowerQuery)
    );
  }

  async clearMemory(): Promise<void> {
    this.memory = [];
    this.logger.debug('Memory cleared', null, 'TsAgent');
  }

  async getMemoryStats(): Promise<{
    totalEntries: number;
    successRate: number;
    averageActionsPerDay: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const totalEntries = this.memory.length;
    const successfulEntries = this.memory.filter(m => m.success).length;
    const successRate = totalEntries > 0 ? successfulEntries / totalEntries : 0;

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    let averageActionsPerDay = 0;

    if (totalEntries > 0) {
      oldestEntry = this.memory[0].timestamp;
      newestEntry = this.memory[this.memory.length - 1].timestamp;

      const daysDiff = (newestEntry.getTime() - oldestEntry.getTime()) / (1000 * 60 * 60 * 24);
      averageActionsPerDay = daysDiff > 0 ? totalEntries / daysDiff : totalEntries;
    }

    return {
      totalEntries,
      successRate,
      averageActionsPerDay,
      oldestEntry,
      newestEntry
    };
  }

  // Check if agent is initialized
  isReady(): boolean {
    return this.isInitialized;
  }

  // LLM-related methods
  async planWithLLM(description: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.llmService.planTask(description);
  }

  async selectToolWithLLM(description: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const availableTools = await this.getAvailableTools();
    return await this.llmService.selectTool(description, availableTools);
  }

  async validateWithLLM(taskDescription: string, result: any): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.llmService.validateResult(taskDescription, result);
  }

  async repairWithLLM(taskDescription: string, error: string, failedSteps: any[]): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.llmService.repairError(taskDescription, error, failedSteps);
  }

  async getLLMModels(): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.llmService.getAvailableModels();
  }

  async updateLLMTaskModel(taskType: keyof LLMTaskType, modelName: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.llmService.updateTaskModel(taskType, modelName);
  }

  // Interactive methods
  async askUserQuestion(question: string, options?: string[]): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.interactiveService.makeChoice(question, options || []);
  }

  async confirmAction(action: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const decision = {
      type: 'confirmation' as const,
      question: action,
      required: true
    };

    const response = await this.interactiveService.askQuestion(decision);
    return response.confirmed;
  }

  async clarifyTask(taskDescription: string, ambiguity: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.interactiveService.requestClarification(taskDescription, ambiguity);
  }

  // Enable/disable interactive mode
  setInteractiveMode(enabled: boolean): void {
    this.interactiveService['enabled'] = enabled;
    this.logger.info('Interactive mode updated', { enabled }, 'TsAgent');
  }

  isInteractiveMode(): boolean {
    return this.interactiveService.isEnabled();
  }

  getInteractiveStats(): { enabled: boolean; questionsAsked: number; maxQuestions: number } {
    return {
      enabled: this.interactiveService.isEnabled(),
      questionsAsked: this.interactiveService.getQuestionsAsked(),
      maxQuestions: this.interactiveService['maxQuestions']
    };
  }
}
