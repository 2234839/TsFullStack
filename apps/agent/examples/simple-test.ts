// 简单测试脚本
import { TsAgent } from '../src';

async function simpleTest() {
  console.log('=== TsAgent 简单测试 ===\n');

  const config = {
    storage: {
      type: 'json' as const,
      dataDir: './data',
    },
    security: {
      enablePermissions: true,
      allowedTools: ['file_write', 'file_read', 'system_info'],
      maxTaskDuration: 300000,
      safeMode: true,
    },
    logging: {
      level: 'info' as const,
      enableConsole: true,
      enableFile: false,
    },
    tools: {
      directory: './tools',
      autoLoad: false,
      timeout: 30000,
    },
  };

  const agent = new TsAgent(config);

  try {
    await agent.initialize();
    console.log('✓ Agent 初始化成功\n');

    // 显示可用工具
    const tools = await agent.getAvailableTools();
    console.log('可用工具:', tools.join(', '), '\n');

    // 执行简单任务
    console.log('执行任务: 创建一个测试文件');
    const result = await agent.executeTask('创建一个名为 ./data/test.txt 的文件，内容为 "Hello from TsAgent!"');

    console.log('\n=== 执行结果 ===');
    console.log('✅ 成功:', result.success);
    console.log('⏱️  执行时间:', result.executionTime, 'ms');
    console.log('📊 执行步骤:', result.stepsExecuted);

    if (result.output) {
      console.log('📋 结果:', JSON.stringify(result.output, null, 2));
    }

    if (result.error) {
      console.log('❌ 错误:', result.error);
    }

    // 检查文件是否创建
    console.log('\n=== 检查文件 ===');
    const fs = require('fs');
    if (fs.existsSync('./data/test.txt')) {
      console.log('✅ 文件创建成功');
      console.log('文件内容:', fs.readFileSync('./data/test.txt', 'utf8'));
      // 清理测试文件
      fs.unlinkSync('./data/test.txt');
      console.log('🧹 测试文件已清理');
    } else {
      console.log('❌ 文件创建失败');
    }

    // 显示统计信息
    const stats = await agent.getStats();
    console.log('\n=== 统计信息 ===');
    console.log('📈 总任务数:', stats.tasks.total);
    console.log('✅ 成功任务:', stats.tasks.completed);
    console.log('❌ 失败任务:', stats.tasks.failed);
    console.log('🛠️  可用工具数:', stats.tools.length || 0);

    console.log('\n=== 健康检查 ===');
    const health = await agent.healthCheck();
    console.log('状态:', health.status);
    console.log('检查结果:', health.checks);
  } catch (error) {
    console.error('❌ 执行失败:', error);
  } finally {
    await agent.shutdown();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  simpleTest().catch(console.error);
}

export { simpleTest };
