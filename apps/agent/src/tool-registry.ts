import { ToolDefinition } from './types';
import { Logger } from './logger';

export interface ToolRegistryConfig {
  directory?: string;
  autoLoad?: boolean;
  timeout?: number;
  allowedTools?: string[];
  enablePermissions?: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
  toolName: string;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private config: ToolRegistryConfig;
  private logger: Logger;
  private executionStats: Map<string, { count: number; totalTime: number; errors: number }> = new Map();

  constructor(config: ToolRegistryConfig, logger: Logger) {
    this.config = {
      timeout: 30000,
      autoLoad: false,
      enablePermissions: true,
      ...config
    };
    this.logger = logger;
  }

  async register(tool: ToolDefinition): Promise<void> {
    // Validate tool definition
    if (!this.validateToolDefinition(tool)) {
      throw new Error(`Invalid tool definition for ${tool.name}`);
    }

    // Check if tool already exists
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} already registered, overwriting...`, null, 'ToolRegistry');
    }

    // Check permissions if enabled
    if (this.config.enablePermissions && this.config.allowedTools) {
      if (!this.config.allowedTools.includes(tool.name)) {
        throw new Error(`Tool ${tool.name} is not in the allowed tools list`);
      }
    }

    this.tools.set(tool.name, tool);
    this.logger.info(`Tool ${tool.name} registered successfully`, { version: tool.version }, 'ToolRegistry');

    // Initialize execution stats
    this.executionStats.set(tool.name, { count: 0, totalTime: 0, errors: 0 });
  }

  async unregister(toolName: string): Promise<boolean> {
    if (!this.tools.has(toolName)) {
      this.logger.warn(`Tool ${toolName} not found for unregistration`, null, 'ToolRegistry');
      return false;
    }

    this.tools.delete(toolName);
    this.executionStats.delete(toolName);
    this.logger.info(`Tool ${toolName} unregistered successfully`, null, 'ToolRegistry');
    return true;
  }

  async execute(toolName: string, input: any, context?: string): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get tool
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      // Check permissions
      if (!this.checkPermission(toolName)) {
        throw new Error(`Permission denied for tool ${toolName}`);
      }

      // Validate input
      if (tool.validate && !tool.validate(input)) {
        throw new Error(`Invalid input for tool ${toolName}`);
      }

      this.logger.debug(`Executing tool ${toolName}`, { input }, context || 'ToolExecution');

      // Execute with timeout
      const timeout = tool.timeout || this.config.timeout!;
      const result = await this.safeExecute(tool, input, timeout);
      const duration = Date.now() - startTime;

      // Update stats
      const stats = this.executionStats.get(toolName)!;
      stats.count++;
      stats.totalTime += duration;

      this.logger.debug(`Tool ${toolName} executed successfully`, { 
        duration, 
        output: typeof result === 'object' ? 'object' : result 
      }, context || 'ToolExecution');

      return {
        success: true,
        output: result,
        duration,
        toolName
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update error stats
      const stats = this.executionStats.get(toolName);
      if (stats) {
        stats.errors++;
      }

      this.logger.error(`Tool ${toolName} execution failed`, { 
        error: errorMessage, 
        input, 
        duration 
      }, context || 'ToolExecution');

      return {
        success: false,
        error: errorMessage,
        duration,
        toolName
      };
    }
  }

  private async safeExecute(tool: ToolDefinition, input: any, timeout: number): Promise<any> {
    return Promise.race([
      tool.execute(input),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }

  private checkPermission(toolName: string): boolean {
    if (!this.config.enablePermissions) {
      return true;
    }

    if (!this.config.allowedTools || this.config.allowedTools.length === 0) {
      return true;
    }

    return this.config.allowedTools.includes(toolName);
  }

  private validateToolDefinition(tool: ToolDefinition): boolean {
    return (
      typeof tool.name === 'string' && tool.name.length > 0 &&
      typeof tool.description === 'string' && tool.description.length > 0 &&
      typeof tool.version === 'string' && tool.version.length > 0 &&
      typeof tool.execute === 'function' &&
      Array.isArray(tool.permissions) &&
      typeof tool.inputSchema === 'object'
    );
  }

  getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  async loadToolsFromDirectory(directory?: string): Promise<number> {
    const toolDir = directory || this.config.directory;
    if (!toolDir) {
      return 0;
    }

    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Check if directory exists
      if (!fs.existsSync(toolDir)) {
        this.logger.warn(`Tool directory ${toolDir} does not exist`, null, 'ToolRegistry');
        return 0;
      }

      const files = fs.readdirSync(toolDir);
      let loadedCount = 0;

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          try {
            const toolPath = path.join(toolDir, file);
            const toolModule = require(toolPath);
            
            // Handle different export formats
            let tool = toolModule.default || toolModule.tool || toolModule;
            
            if (Array.isArray(tool)) {
              // Multiple tools in one file
              for (const t of tool) {
                await this.register(t);
                loadedCount++;
              }
            } else {
              // Single tool
              await this.register(tool);
              loadedCount++;
            }
          } catch (error) {
            this.logger.error(`Failed to load tool from ${file}`, { 
              error: error instanceof Error ? error.message : String(error) 
            }, 'ToolRegistry');
          }
        }
      }

      this.logger.info(`Loaded ${loadedCount} tools from directory`, { directory: toolDir }, 'ToolRegistry');
      return loadedCount;
    } catch (error) {
      this.logger.error(`Failed to load tools from directory`, { 
        directory: toolDir, 
        error: error instanceof Error ? error.message : String(error) 
      }, 'ToolRegistry');
      return 0;
    }
  }

  getToolStats(toolName?: string): any {
    if (toolName) {
      const stats = this.executionStats.get(toolName);
      if (!stats) return null;

      return {
        toolName,
        ...stats,
        averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        successRate: stats.count > 0 ? ((stats.count - stats.errors) / stats.count) * 100 : 0
      };
    }

    // Return stats for all tools
    const allStats: any[] = [];
    for (const [name, stats] of this.executionStats.entries()) {
      allStats.push({
        toolName: name,
        ...stats,
        averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        successRate: stats.count > 0 ? ((stats.count - stats.errors) / stats.count) * 100 : 0
      });
    }

    return allStats;
  }

  async validateAllTools(): Promise<{ valid: ToolDefinition[]; invalid: { tool: ToolDefinition; errors: string[] }[] }> {
    const valid: ToolDefinition[] = [];
    const invalid: { tool: ToolDefinition; errors: string[] }[] = [];

    for (const tool of this.tools.values()) {
      const errors: string[] = [];

      // Validate required fields
      if (!tool.name || tool.name.trim() === '') {
        errors.push('Tool name is required');
      }

      if (!tool.description || tool.description.trim() === '') {
        errors.push('Tool description is required');
      }

      if (!tool.version || tool.version.trim() === '') {
        errors.push('Tool version is required');
      }

      if (typeof tool.execute !== 'function') {
        errors.push('Tool execute function is required');
      }

      if (!Array.isArray(tool.permissions)) {
        errors.push('Tool permissions must be an array');
      }

      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        errors.push('Tool input schema is required');
      }

      if (errors.length === 0) {
        valid.push(tool);
      } else {
        invalid.push({ tool, errors });
      }
    }

    this.logger.info(`Tool validation completed`, { 
      valid: valid.length, 
      invalid: invalid.length 
    }, 'ToolRegistry');

    return { valid, invalid };
  }

  updateConfig(config: Partial<ToolRegistryConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('ToolRegistry configuration updated', { config }, 'ToolRegistry');
  }

  clear(): void {
    this.tools.clear();
    this.executionStats.clear();
    this.logger.info('ToolRegistry cleared', null, 'ToolRegistry');
  }

  async testTool(toolName: string, testInput: any): Promise<ToolExecutionResult> {
    this.logger.info(`Testing tool ${toolName}`, { input: testInput }, 'ToolRegistry');
    return await this.execute(toolName, testInput, 'ToolTest');
  }
}