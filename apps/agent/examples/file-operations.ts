import { TsAgent } from '../src';

async function fileOperationsExample() {
  console.log('=== TsAgent File Operations Example ===\n');

  const config = {
    storage: {
      type: 'json' as const,
      dataDir: './data'
    },
    security: {
      enablePermissions: true,
      allowedTools: ['file_write', 'file_read', 'file_delete', 'file_list'],
      maxTaskDuration: 300000,
      safeMode: true
    },
    logging: {
      level: 'debug' as const,
      enableConsole: true,
      enableFile: false
    },
    tools: {
      timeout: 30000
    }
  };

  const agent = new TsAgent(config);

  try {
    await agent.initialize();
    console.log('✓ Agent initialized\n');

    // Example 1: Create a file
    console.log('1. Creating test.txt...');
    const result1 = await agent.executeTask('创建一个名为 test.txt 的文件，内容为 "Hello TsAgent!"');
    console.log('Result:', result1.success ? '✓ Success' : '✗ Failed');
    console.log('');

    // Example 2: Read the file
    console.log('2. Reading test.txt...');
    const result2 = await agent.executeTask('读取 test.txt 文件的内容');
    console.log('Result:', result2.success ? '✓ Success' : '✗ Failed');
    if (result2.success && result2.task?.result) {
      console.log('Content:', result2.task.result);
    }
    console.log('');

    // Example 3: List files
    console.log('3. Listing files in current directory...');
    const result3 = await agent.executeTask('列出当前目录的文件');
    console.log('Result:', result3.success ? '✓ Success' : '✗ Failed');
    console.log('');

    // Example 4: Delete the file
    console.log('4. Deleting test.txt...');
    const result4 = await agent.executeTask('删除 test.txt 文件');
    console.log('Result:', result4.success ? '✓ Success' : '✗ Failed');
    console.log('');

    // Show final stats
    const stats = await agent.getStats();
    console.log('Final Statistics:');
    console.log('- Total tasks:', stats.tasks.total);
    console.log('- Completed tasks:', stats.tasks.completed);
    console.log('- Failed tasks:', stats.tasks.failed);

  } catch (error) {
    console.error('File operations example failed:', error);
  } finally {
    await agent.shutdown();
  }
}

if (require.main === module) {
  fileOperationsExample().catch(console.error);
}