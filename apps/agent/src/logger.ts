import { promises as fs } from 'fs';
import path from 'path';
import { LogLevel } from './types';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logPath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableColors?: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private logQueue: LogEntry[] = [];
  private isWriting = false;

  constructor(config: LoggerConfig) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableColors: true,
      ...config
    };

    // Process log queue periodically
    setInterval(() => this.processLogQueue(), 1000);
  }

  debug(message: string, data?: any, context?: string): void {
    this.log('debug', message, data, context);
  }

  info(message: string, data?: any, context?: string): void {
    this.log('info', message, data, context);
  }

  warn(message: string, data?: any, context?: string): void {
    this.log('warn', message, data, context);
  }

  error(message: string, data?: any, context?: string): void {
    this.log('error', message, data, context);
  }

  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context
    };

    // Add to queue
    this.logQueue.push(logEntry);

    // Log to console immediately if enabled
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Process queue if not already writing
    if (!this.isWriting && this.config.enableFile) {
      this.processLogQueue();
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase();
    const context = entry.context ? `[${entry.context}]` : '';
    
    let message = `${timestamp} ${level}${context}: ${entry.message}`;
    
    if (this.config.enableColors) {
      const colors = {
        debug: '\x1b[90m',    // Gray
        info: '\x1b[36m',     // Cyan
        warn: '\x1b[33m',     // Yellow
        error: '\x1b[31m'     // Red
      };
      const reset = '\x1b[0m';
      message = `${colors[entry.level]}${message}${reset}`;
    }

    console.log(message);

    if (entry.data) {
      if (typeof entry.data === 'object') {
        console.log(JSON.stringify(entry.data, null, 2));
      } else {
        console.log(entry.data);
      }
    }
  }

  private async processLogQueue(): Promise<void> {
    if (this.isWriting || !this.config.enableFile || !this.config.logPath || this.logQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    const entriesToProcess = [...this.logQueue];
    this.logQueue = [];

    try {
      await this.writeToFile(entriesToProcess);
    } catch (error) {
      console.error('Failed to write logs to file:', error);
      // Put entries back in queue for retry
      this.logQueue.unshift(...entriesToProcess);
    } finally {
      this.isWriting = false;
    }
  }

  private async writeToFile(entries: LogEntry[]): Promise<void> {
    if (!this.config.logPath) {
      return;
    }

    // Ensure log directory exists
    const logDir = path.dirname(this.config.logPath);
    try {
      await fs.access(logDir);
    } catch {
      await fs.mkdir(logDir, { recursive: true });
    }

    // Check if we need to rotate log file
    if (await this.shouldRotateLog()) {
      await this.rotateLogFile();
    }

    // Write entries to file
    const logLines = entries.map(entry => JSON.stringify(entry));
    const content = logLines.join('\n') + '\n';

    await fs.appendFile(this.config.logPath, content, 'utf8');
  }

  private async shouldRotateLog(): Promise<boolean> {
    if (!this.config.logPath || !this.config.maxFileSize) {
      return false;
    }

    try {
      const stats = await fs.stat(this.config.logPath);
      return stats.size >= this.config.maxFileSize;
    } catch {
      return false;
    }
  }

  private async rotateLogFile(): Promise<void> {
    if (!this.config.logPath || !this.config.maxFiles) {
      return;
    }

    // Remove oldest log file if we have too many
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldFile = `${this.config.logPath}.${i}`;
      try {
        await fs.unlink(oldFile);
      } catch {
        // File doesn't exist, continue
      }
    }

    // Shift existing log files
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldFile = i === 1 ? this.config.logPath : `${this.config.logPath}.${i - 1}`;
      const newFile = `${this.config.logPath}.${i}`;
      
      try {
        await fs.rename(oldFile, newFile);
      } catch {
        // File doesn't exist, continue
      }
    }
  }

  async flush(): Promise<void> {
    // Process any remaining logs
    await this.processLogQueue();
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getLogEntries(level?: LogLevel): LogEntry[] {
    return [...this.logQueue].filter(entry => !level || entry.level === level);
  }

  clear(): void {
    this.logQueue = [];
  }
}