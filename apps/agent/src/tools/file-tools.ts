import { promises as fs } from 'fs';
import path from 'path';
import { ToolDefinition } from '../types';

export const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file safely',
  version: '1.0.0',
  permissions: ['file_write'],
  inputSchema: {
    type: 'object',
    properties: {
      path: { 
        type: 'string',
        description: 'File path to write to'
      },
      content: { 
        type: 'string',
        description: 'Content to write to the file'
      },
      encoding: { 
        type: 'string',
        enum: ['utf8', 'base64'],
        default: 'utf8',
        description: 'File encoding'
      },
      createDir: {
        type: 'boolean',
        default: false,
        description: 'Create directory if it does not exist'
      }
    },
    required: ['path', 'content']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      path: { type: 'string' },
      size: { type: 'number' }
    }
  },
  timeout: 30000,
  validate: (input) => {
    return typeof input.path === 'string' &&
           typeof input.content === 'string' &&
           input.path.length > 0 &&
           !input.path.includes('..') && // Prevent path traversal
           (input.encoding === undefined || ['utf8', 'base64'].includes(input.encoding)) &&
           (input.createDir === undefined || typeof input.createDir === 'boolean');
  },
  execute: async (input) => {
    try {
      // Security check - ensure path is within allowed directories
      const safePath = path.resolve(input.path);
      const allowedDirs = ['/tmp', './workspace', './data', './logs'];
      
      if (!allowedDirs.some(dir => safePath.startsWith(path.resolve(dir)))) {
        throw new Error('Access denied: path outside allowed directories');
      }

      // Create directory if needed
      if (input.createDir) {
        const dir = path.dirname(safePath);
        await fs.mkdir(dir, { recursive: true });
      }

      // Write file
      const encoding = input.encoding || 'utf8';
      await fs.writeFile(safePath, input.content, encoding as BufferEncoding);

      // Get file stats
      const stats = await fs.stat(safePath);

      return {
        success: true,
        message: 'File written successfully',
        path: safePath,
        size: stats.size
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        path: input.path,
        size: 0
      };
    }
  }
};

export const fileReadTool: ToolDefinition = {
  name: 'file_read',
  description: 'Read content from a file safely',
  version: '1.0.0',
  permissions: ['file_read'],
  inputSchema: {
    type: 'object',
    properties: {
      path: { 
        type: 'string',
        description: 'File path to read from'
      },
      encoding: { 
        type: 'string',
        enum: ['utf8', 'base64'],
        default: 'utf8',
        description: 'File encoding'
      },
      maxLength: {
        type: 'number',
        default: 1024 * 1024, // 1MB
        description: 'Maximum content length to read'
      }
    },
    required: ['path']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      content: { type: 'string' },
      message: { type: 'string' },
      path: { type: 'string' },
      size: { type: 'number' }
    }
  },
  timeout: 10000,
  validate: (input) => {
    return typeof input.path === 'string' &&
           input.path.length > 0 &&
           !input.path.includes('..') &&
           (input.encoding === undefined || ['utf8', 'base64'].includes(input.encoding)) &&
           (input.maxLength === undefined || typeof input.maxLength === 'number' && input.maxLength > 0);
  },
  execute: async (input) => {
    try {
      // Security check
      const safePath = path.resolve(input.path);
      const allowedDirs = ['/tmp', './workspace', './data', './logs'];
      
      if (!allowedDirs.some(dir => safePath.startsWith(path.resolve(dir)))) {
        throw new Error('Access denied: path outside allowed directories');
      }

      // Check if file exists
      try {
        await fs.access(safePath);
      } catch {
        throw new Error('File does not exist');
      }

      // Read file
      const encoding = input.encoding || 'utf8';
      const maxLength = input.maxLength || 1024 * 1024;
      
      let content = await fs.readFile(safePath, encoding as BufferEncoding);
      
      // Truncate if too long
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n... [TRUNCATED]';
      }

      const stats = await fs.stat(safePath);

      return {
        success: true,
        content,
        message: 'File read successfully',
        path: safePath,
        size: stats.size
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        message: error instanceof Error ? error.message : String(error),
        path: input.path,
        size: 0
      };
    }
  }
};

export const fileDeleteTool: ToolDefinition = {
  name: 'file_delete',
  description: 'Delete a file safely',
  version: '1.0.0',
  permissions: ['file_delete'],
  inputSchema: {
    type: 'object',
    properties: {
      path: { 
        type: 'string',
        description: 'File path to delete'
      }
    },
    required: ['path']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      path: { type: 'string' }
    }
  },
  timeout: 5000,
  validate: (input) => {
    return typeof input.path === 'string' &&
           input.path.length > 0 &&
           !input.path.includes('..');
  },
  execute: async (input) => {
    try {
      // Security check
      const safePath = path.resolve(input.path);
      const allowedDirs = ['/tmp', './workspace', './data', './logs'];
      
      if (!allowedDirs.some(dir => safePath.startsWith(path.resolve(dir)))) {
        throw new Error('Access denied: path outside allowed directories');
      }

      // Check if file exists
      try {
        await fs.access(safePath);
      } catch {
        throw new Error('File does not exist');
      }

      // Delete file
      await fs.unlink(safePath);

      return {
        success: true,
        message: 'File deleted successfully',
        path: safePath
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        path: input.path
      };
    }
  }
};

export const fileListTool: ToolDefinition = {
  name: 'file_list',
  description: 'List files in a directory safely',
  version: '1.0.0',
  permissions: ['file_list'],
  inputSchema: {
    type: 'object',
    properties: {
      path: { 
        type: 'string',
        default: './workspace',
        description: 'Directory path to list'
      },
      pattern: {
        type: 'string',
        description: 'Optional file pattern to filter (e.g., "*.txt")'
      },
      recursive: {
        type: 'boolean',
        default: false,
        description: 'List files recursively'
      }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            size: { type: 'number' },
            isDirectory: { type: 'boolean' },
            modified: { type: 'string' }
          }
        }
      },
      message: { type: 'string' }
    }
  },
  timeout: 10000,
  validate: (input) => {
    return typeof input.path === 'string' &&
           input.path.length > 0 &&
           !input.path.includes('..') &&
           (input.pattern === undefined || typeof input.pattern === 'string') &&
           (input.recursive === undefined || typeof input.recursive === 'boolean');
  },
  execute: async (input) => {
    try {
      // Security check
      const safePath = path.resolve(input.path);
      const allowedDirs = ['/tmp', './workspace', './data', './logs'];
      
      if (!allowedDirs.some(dir => safePath.startsWith(path.resolve(dir)))) {
        throw new Error('Access denied: path outside allowed directories');
      }

      // Check if directory exists
      try {
        const stats = await fs.stat(safePath);
        if (!stats.isDirectory()) {
          throw new Error('Path is not a directory');
        }
      } catch {
        throw new Error('Directory does not exist');
      }

      // List files
      const files = await listFiles(safePath, input.pattern, input.recursive || false);

      return {
        success: true,
        files,
        message: `Found ${files.length} files`
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

async function listFiles(dirPath: string, pattern?: string, recursive = false): Promise<any[]> {
  const files: any[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const stats = await fs.stat(fullPath);

    const fileInfo = {
      name: entry.name,
      path: fullPath,
      size: stats.size,
      isDirectory: entry.isDirectory(),
      modified: stats.mtime.toISOString()
    };

    // Apply pattern filter
    if (pattern && !entry.isDirectory()) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (!regex.test(entry.name)) {
        continue;
      }
    }

    files.push(fileInfo);

    // Recursively list subdirectories
    if (recursive && entry.isDirectory()) {
      const subFiles = await listFiles(fullPath, pattern, true);
      files.push(...subFiles);
    }
  }

  return files;
}