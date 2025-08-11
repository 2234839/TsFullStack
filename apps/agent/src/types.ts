// 基础数据模型和类型定义

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type StorageType = 'json' | 'sqlite';

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  steps: TaskStep[];
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface TaskStep {
  id: string;
  toolName: string;
  input: any;
  output?: any;
  status: ExecutionStatus;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  inputSchema: any;
  outputSchema?: any;
  permissions: string[];
  execute: (input: any) => Promise<any>;
  validate?: (input: any) => boolean;
  timeout?: number;
}

export interface AgentConfig {
  storage: {
    type: StorageType;
    path?: string;
    dataDir?: string;
  };
  security: {
    enablePermissions: boolean;
    allowedTools: string[];
    maxTaskDuration: number;
    safeMode: boolean;
  };
  logging: {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    logPath?: string;
  };
  tools: {
    directory: string;
    autoLoad: boolean;
    timeout: number;
  };
  interactive?: {
    enabled: boolean;
    confirmBeforeExecution: boolean;
    askForClarification: boolean;
    maxQuestions: number;
  };
}

export interface PlannedStep {
  toolName: string;
  input: any;
  description?: string;
}

// 工具函数
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}