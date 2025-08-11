import { TsAgent } from '../src';

async function httpExample() {
  console.log('=== TsAgent HTTP Example ===\n');

  const config = {
    storage: {
      type: 'json' as const,
      dataDir: './data'
    },
    security: {
      enablePermissions: true,
      allowedTools: ['http_request', 'http_get', 'http_post'],
      maxTaskDuration: 300000,
      safeMode: true
    },
    logging: {
      level: 'info' as const,
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

    // Example 1: Make a GET request
    console.log('1. Making GET request to JSONPlaceholder...');
    const result1 = await agent.executeTask('向 https://jsonplaceholder.typicode.com/posts/1 发送 GET 请求');
    console.log('Result:', result1.success ? '✓ Success' : '✗ Failed');
    if (result1.success && result1.task?.result) {
      console.log('Response status:', result1.task.result.status);
      console.log('Response body length:', result1.task.result.body?.length || 0);
    }
    console.log('');

    // Example 2: Make a POST request
    console.log('2. Making POST request...');
    const result2 = await agent.executeTask('向 https://jsonplaceholder.typicode.com/posts 发送 POST 请求，数据为 { title: "Test", body: "Hello", userId: 1 }');
    console.log('Result:', result2.success ? '✓ Success' : '✗ Failed');
    if (result2.success && result2.task?.result) {
      console.log('Response status:', result2.task.result.status);
    }
    console.log('');

    // Example 3: Get weather information
    console.log('3. Getting weather information...');
    const result3 = await agent.executeTask('获取北京的天气信息');
    console.log('Result:', result3.success ? '✓ Success' : '✗ Failed');
    console.log('');

    // Show task details
    if (result1.task) {
      console.log('Task Details:');
      console.log('- Task ID:', result1.task.id);
      console.log('- Description:', result1.task.description);
      console.log('- Status:', result1.task.status);
      console.log('- Steps:', result1.task.steps.length);
      
      if (result1.task.steps.length > 0) {
        console.log('- Step details:');
        result1.task.steps.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step.toolName} - ${step.status}`);
          if (step.error) {
            console.log(`     Error: ${step.error}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('HTTP example failed:', error);
  } finally {
    await agent.shutdown();
  }
}

if (require.main === module) {
  httpExample().catch(console.error);
}