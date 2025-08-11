import { TsAgent } from '../src';

async function basicExample() {
  console.log('=== TsAgent Basic Example ===\n');

  // Create agent configuration
  const config = {
    storage: {
      type: 'json' as const,
      dataDir: './data'
    },
    security: {
      enablePermissions: true,
      allowedTools: ['file_write', 'file_read', 'system_info'],
      maxTaskDuration: 300000,
      safeMode: true
    },
    logging: {
      level: 'info' as const,
      enableConsole: true,
      enableFile: false
    },
    tools: {
      directory: './tools',
      autoLoad: false,
      timeout: 30000
    }
  };

  // Create agent
  const agent = new TsAgent(config);

  try {
    // Initialize agent
    console.log('Initializing agent...');
    await agent.initialize();
    console.log('✓ Agent initialized successfully\n');

    // Get available tools
    const tools = await agent.getAvailableTools();
    console.log('Available tools:', tools.join(', '), '\n');

    // Execute a simple task
    console.log('Executing task: "创建一个测试文件"');
    const result = await agent.executeTask('创建一个测试文件');
    
    console.log('Task result:');
    console.log('- Success:', result.success);
    console.log('- Execution time:', result.executionTime, 'ms');
    console.log('- Steps executed:', result.stepsExecuted);
    if (result.task) {
      console.log('- Task status:', result.task.status);
      console.log('- Steps:', result.task.steps.length);
    }
    console.log('');

    // Test with LLM planning
    console.log('Testing LLM planning...');
    const plan = await agent.planWithLLM('分析当前系统状态并生成报告');
    console.log('LLM Plan:', plan.substring(0, 200) + '...\n');

    // Get agent stats
    const stats = await agent.getStats();
    console.log('Agent Statistics:');
    console.log('- Tasks total:', stats.tasks.total);
    console.log('- Tools available:', stats.tools.length || 0);
    console.log('- System uptime:', Math.round(stats.system.uptime), 'seconds\n');

    // Health check
    const health = await agent.healthCheck();
    console.log('Health check:', health.status);
    console.log('- Storage:', health.checks.storage ? '✓' : '✗');
    console.log('- Tools:', health.checks.tools ? '✓' : '✗');
    console.log('- Tasks:', health.checks.tasks ? '✓' : '✗');

  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    // Shutdown agent
    await agent.shutdown();
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}