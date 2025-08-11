import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { ToolDefinition } from '../types';

const execAsync = promisify(exec);

export const commandExecuteTool: ToolDefinition = {
  name: 'command_execute',
  description: 'Execute shell commands safely with timeout',
  version: '1.0.0',
  permissions: ['command_execute'],
  inputSchema: {
    type: 'object',
    properties: {
      command: { 
        type: 'string',
        description: 'Command to execute'
      },
      args: { 
        type: 'array',
        items: { type: 'string' },
        description: 'Command arguments'
      },
      cwd: {
        type: 'string',
        description: 'Working directory'
      },
      timeout: {
        type: 'number',
        default: 30000,
        description: 'Timeout in milliseconds'
      },
      env: {
        type: 'object',
        description: 'Additional environment variables'
      }
    },
    required: ['command']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      exitCode: { type: 'number' },
      message: { type: 'string' }
    }
  },
  timeout: 60000,
  validate: (input) => {
    // Security validation
    const dangerousCommands = [
      'rm -rf', 'format', 'del', '> /dev/null', 'sudo', 'su',
      'chmod 777', 'chown', 'mkfs', 'fdisk', 'dd if=/dev',
      'shutdown', 'reboot', 'halt', 'poweroff'
    ];
    
    const cmd = input.command.toLowerCase();
    
    if (dangerousCommands.some(dangerous => cmd.includes(dangerous))) {
      return false;
    }

    return typeof input.command === 'string' &&
           input.command.length > 0 &&
           input.command.trim().length > 0 &&
           (input.args === undefined || Array.isArray(input.args)) &&
           (input.cwd === undefined || typeof input.cwd === 'string') &&
           (input.timeout === undefined || typeof input.timeout === 'number' && input.timeout > 0) &&
           (input.env === undefined || typeof input.env === 'object');
  },
  execute: async (input) => {
    try {
      const command = input.command;
      const args = input.args || [];
      const cwd = input.cwd || process.cwd();
      const timeout = input.timeout || 30000;
      const env = { ...process.env, ...input.env };

      // Build full command string
      const fullCommand = `${command} ${args.join(' ')}`.trim();

      // Execute command with timeout
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd,
        timeout,
        env,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 // 1MB
      });

      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        message: 'Command executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1,
        message: error.message
      };
    }
  }
};

export const commandExecuteSyncTool: ToolDefinition = {
  name: 'command_execute_sync',
  description: 'Execute shell commands synchronously (for simple commands)',
  version: '1.0.0',
  permissions: ['command_execute'],
  inputSchema: {
    type: 'object',
    properties: {
      command: { 
        type: 'string',
        description: 'Command to execute'
      },
      args: { 
        type: 'array',
        items: { type: 'string' },
        description: 'Command arguments'
      },
      cwd: {
        type: 'string',
        description: 'Working directory'
      },
      timeout: {
        type: 'number',
        default: 10000,
        description: 'Timeout in milliseconds'
      }
    },
    required: ['command']
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      exitCode: { type: 'number' },
      message: { type: 'string' }
    }
  },
  timeout: 15000,
  validate: (input) => {
    // More restrictive validation for sync execution
    const dangerousCommands = [
      'rm -rf', 'format', 'del', 'sudo', 'su', 'chmod 777',
      'chown', 'mkfs', 'fdisk', 'dd if=/dev', 'shutdown', 'reboot'
    ];
    
    const cmd = input.command.toLowerCase();
    
    if (dangerousCommands.some(dangerous => cmd.includes(dangerous))) {
      return false;
    }

    // Only allow safe commands for sync execution
    const allowedCommands = ['echo', 'ls', 'pwd', 'date', 'whoami', 'uname', 'cat', 'head', 'tail', 'wc', 'grep', 'find'];
    if (!allowedCommands.some(allowed => cmd.includes(allowed))) {
      return false;
    }

    return typeof input.command === 'string' &&
           input.command.length > 0 &&
           (input.args === undefined || Array.isArray(input.args)) &&
           (input.cwd === undefined || typeof input.cwd === 'string') &&
           (input.timeout === undefined || typeof input.timeout === 'number' && input.timeout > 0 && input.timeout <= 30000);
  },
  execute: async (input) => {
    try {
      const command = input.command;
      const args = input.args || [];
      const cwd = input.cwd || process.cwd();
      const timeout = Math.min(input.timeout || 10000, 30000);

      const fullCommand = `${command} ${args.join(' ')}`.trim();

      const stdout = execSync(fullCommand, {
        cwd,
        timeout,
        encoding: 'utf8',
        maxBuffer: 512 * 1024 // 512KB for sync
      });

      return {
        success: true,
        stdout: stdout || '',
        stderr: '',
        exitCode: 0,
        message: 'Command executed successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1,
        message: error.message
      };
    }
  }
};

export const systemInfoTool: ToolDefinition = {
  name: 'system_info',
  description: 'Get system information',
  version: '1.0.0',
  permissions: ['system_info'],
  inputSchema: {
    type: 'object',
    properties: {
      info_type: {
        type: 'string',
        enum: ['os', 'memory', 'disk', 'cpu', 'network', 'all'],
        default: 'all',
        description: 'Type of system information to retrieve'
      }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      info: { type: 'object' },
      message: { type: 'string' }
    }
  },
  timeout: 5000,
  validate: (input) => {
    return typeof input.info_type === 'string' &&
           ['os', 'memory', 'disk', 'cpu', 'network', 'all'].includes(input.info_type);
  },
  execute: async (input) => {
    try {
      const infoType = input.info_type || 'all';
      const result: any = {};

      if (infoType === 'all' || infoType === 'os') {
        result.os = {
          platform: process.platform,
          arch: process.arch,
          version: process.version,
          uptime: process.uptime(),
          cwd: process.cwd()
        };
      }

      if (infoType === 'all' || infoType === 'memory') {
        const memUsage = process.memoryUsage();
        result.memory = {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        };
      }

      if (infoType === 'all' || infoType === 'cpu') {
        result.cpu = {
          cpus: require('os').cpus().length,
          loadavg: require('os').loadavg()
        };
      }

      if (infoType === 'all' || infoType === 'network') {
        const networkInterfaces = require('os').networkInterfaces();
        result.network = {
          interfaces: Object.keys(networkInterfaces).map(iface => ({
            name: iface,
            addresses: networkInterfaces[iface].map((addr: any) => ({
              address: addr.address,
              netmask: addr.netmask,
              family: addr.family,
              mac: addr.mac,
              internal: addr.internal
            }))
          }))
        };
      }

      return {
        success: true,
        info: result,
        message: 'System information retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        info: {},
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
};