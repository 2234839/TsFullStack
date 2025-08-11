import { promises as fs } from 'fs';
import path from 'path';
import { Task, TaskStep, ToolDefinition } from './types';

export interface StorageConfig {
  type: 'json' | 'sqlite';
  path?: string;
  dataDir?: string;
  backupEnabled?: boolean;
  backupInterval?: number;
  maxBackups?: number;
}

export class JsonStorage {
  private config: StorageConfig;
  private dataDir: string;
  private tasksFile: string;
  private toolsFile: string;
  private lastBackup = 0;

  constructor(config: StorageConfig) {
    this.config = {
      dataDir: './data',
      backupEnabled: true,
      backupInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxBackups: 7,
      ...config
    };

    this.dataDir = this.config.dataDir!;
    this.tasksFile = path.join(this.dataDir, 'tasks.json');
    this.toolsFile = path.join(this.dataDir, 'tools.json');
  }

  async init(): Promise<void> {
    // Ensure data directory exists
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }

    // Initialize data files if they don't exist
    await this.initDataFile(this.tasksFile, []);
    await this.initDataFile(this.toolsFile, []);

    // Start backup timer
    if (this.config.backupEnabled) {
      setInterval(() => this.backup(), this.config.backupInterval);
    }
  }

  private async initDataFile(filePath: string, initialData: any): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await this.writeJsonFile(filePath, initialData);
    }
  }

  private async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return null;
      }
      throw error;
    }
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
  }

  // Task operations
  async saveTask(task: Task): Promise<void> {
    const tasks = await this.getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    await this.writeJsonFile(this.tasksFile, tasks);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  async getTasks(filter?: {
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Task[]> {
    let tasks = await this.readJsonFile(this.tasksFile) || [];

    if (filter) {
      if (filter.status) {
        tasks = tasks.filter((t: Task) => t.status === filter.status);
      }
      
      if (filter.startDate) {
        tasks = tasks.filter((t: Task) => new Date(t.createdAt) >= filter.startDate!);
      }
      
      if (filter.endDate) {
        tasks = tasks.filter((t: Task) => new Date(t.createdAt) <= filter.endDate!);
      }
      
      if (filter.offset) {
        tasks = tasks.slice(filter.offset);
      }
      
      if (filter.limit) {
        tasks = tasks.slice(0, filter.limit);
      }
    }

    return tasks;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const tasks = await this.getTasks();
    const initialLength = tasks.length;
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    
    if (filteredTasks.length < initialLength) {
      await this.writeJsonFile(this.tasksFile, filteredTasks);
      return true;
    }
    
    return false;
  }

  async updateTaskStatus(taskId: string, status: Task['status'], result?: any, error?: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) {
      return false;
    }

    task.status = status;
    task.updatedAt = new Date();
    
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date();
    }
    
    if (result !== undefined) {
      task.result = result;
    }
    
    if (error !== undefined) {
      task.error = error;
    }

    await this.saveTask(task);
    return true;
  }

  // Tool operations
  async saveTool(tool: ToolDefinition): Promise<void> {
    const tools = await this.getTools();
    const existingIndex = tools.findIndex(t => t.name === tool.name);
    
    if (existingIndex >= 0) {
      tools[existingIndex] = tool;
    } else {
      tools.push(tool);
    }

    await this.writeJsonFile(this.toolsFile, tools);
  }

  async getTool(toolName: string): Promise<ToolDefinition | null> {
    const tools = await this.getTools();
    return tools.find(t => t.name === toolName) || null;
  }

  async getTools(): Promise<ToolDefinition[]> {
    return await this.readJsonFile(this.toolsFile) || [];
  }

  async deleteTool(toolName: string): Promise<boolean> {
    const tools = await this.getTools();
    const initialLength = tools.length;
    const filteredTools = tools.filter(t => t.name !== toolName);
    
    if (filteredTools.length < initialLength) {
      await this.writeJsonFile(this.toolsFile, filteredTools);
      return true;
    }
    
    return false;
  }

  // Statistics
  async getStats(): Promise<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalTools: number;
    lastTask?: Task;
  }> {
    const tasks = await this.getTasks();
    const tools = await this.getTools();
    
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    
    const sortedTasks = tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const lastTask = sortedTasks[0];

    return {
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      totalTools: tools.length,
      lastTask
    };
  }

  // Cleanup
  async cleanup(maxAge?: number): Promise<number> {
    if (!maxAge) {
      maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    const tasks = await this.getTasks();
    const cutoffDate = new Date(Date.now() - maxAge);
    
    const filteredTasks = tasks.filter(t => new Date(t.createdAt) > cutoffDate);
    const removedCount = tasks.length - filteredTasks.length;
    
    if (removedCount > 0) {
      await this.writeJsonFile(this.tasksFile, filteredTasks);
    }

    return removedCount;
  }

  // Backup
  async backup(): Promise<void> {
    const now = Date.now();
    
    // Check if enough time has passed since last backup
    if (now - this.lastBackup < this.config.backupInterval!) {
      return;
    }

    const backupDir = path.join(this.dataDir, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSuffix = `backup-${timestamp}`;

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Backup tasks file
      const tasksBackup = path.join(backupDir, `tasks-${backupSuffix}.json`);
      await fs.copyFile(this.tasksFile, tasksBackup);

      // Backup tools file
      const toolsBackup = path.join(backupDir, `tools-${backupSuffix}.json`);
      await fs.copyFile(this.toolsFile, toolsBackup);

      // Clean old backups
      await this.cleanOldBackups(backupDir);

      this.lastBackup = now;
    } catch (error) {
      console.error('Backup failed:', error);
    }
  }

  private async cleanOldBackups(backupDir: string): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(f => f.endsWith('.json')).sort();
      
      const maxBackups = this.config.maxBackups!;
      while (backupFiles.length > maxBackups) {
        const oldestFile = backupFiles.shift();
        if (oldestFile) {
          await fs.unlink(path.join(backupDir, oldestFile));
        }
      }
    } catch (error) {
      console.error('Failed to clean old backups:', error);
    }
  }

  // Data export
  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const tasks = await this.getTasks();
    const tools = await this.getTools();

    if (format === 'json') {
      return JSON.stringify({ tasks, tools, exportedAt: new Date().toISOString() }, null, 2);
    } else {
      // Simple CSV export for tasks
      const csvHeaders = ['id', 'description', 'status', 'createdAt', 'updatedAt', 'completedAt', 'result', 'error'];
      const csvRows = tasks.map(task => [
        task.id,
        `"${task.description.replace(/"/g, '""')}"`,
        task.status,
        task.createdAt,
        task.updatedAt,
        task.completedAt || '',
        `"${JSON.stringify(task.result || '').replace(/"/g, '""')}"`,
        `"${(task.error || '').replace(/"/g, '""')}"`
      ]);

      return [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    }
  }

  // Data import
  async importData(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    if (format === 'json') {
      const imported = JSON.parse(data);
      
      if (imported.tasks) {
        await this.writeJsonFile(this.tasksFile, imported.tasks);
      }
      
      if (imported.tools) {
        await this.writeJsonFile(this.toolsFile, imported.tools);
      }
    } else {
      // CSV import would be more complex - for now, just support JSON
      throw new Error('CSV import not yet supported');
    }
  }
}