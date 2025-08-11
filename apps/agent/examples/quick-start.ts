// TsAgent 快速开始示例
import { TsAgent } from '../src';

async function quickStart() {
  console.log('=== TsAgent 快速开始 ===\n');

  // 1. 基础配置（无交互模式）
  const basicConfig = {
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

  // 2. 交互式配置（推荐）
  const interactiveConfig = {
    ...basicConfig,
    interactive: {
      enabled: true,                    // 启用交互式决策
      confirmBeforeExecution: true,     // 执行前确认
      askForClarification: true,        // 需要澄清时询问
      maxQuestions: 5                   // 最大询问次数
    }
  };

  console.log('请选择运行模式:');
  console.log('1. 基础模式（自动执行）');
  console.log('2. 交互模式（推荐，可以控制执行过程）');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const choice = await new Promise<string>((resolve) => {
    rl.question('请选择 (1 或 2): ', (answer: string) => {
      resolve(answer.trim());
    });
  });

  const config = choice === '2' ? interactiveConfig : basicConfig;
  const agent = new TsAgent(config);

  try {
    await agent.initialize();
    console.log('✓ Agent 初始化成功\n');

    // 显示可用工具
    const tools = await agent.getAvailableTools();
    console.log('可用工具:', tools.join(', '), '\n');

    // 简单任务示例
    console.log('=== 建议的任务示例 ===');
    console.log('1. 创建一个测试文件');
    console.log('2. 查看系统信息');
    console.log('3. 获取网页内容');
    console.log('4. 自定义任务');

    const taskChoice = await new Promise<string>((resolve) => {
      rl.question('请选择任务 (1-4) 或输入自定义任务: ', (answer: string) => {
        resolve(answer.trim());
      });
    });

    let taskDescription = '';
    switch (taskChoice) {
      case '1':
        taskDescription = '创建一个名为 test.txt 的文件，内容为 "Hello from TsAgent!"';
        break;
      case '2':
        taskDescription = '获取当前系统信息';
        break;
      case '3':
        taskDescription = '获取 https://httpbin.org/get 的内容';
        break;
      case '4':
        taskDescription = await new Promise<string>((resolve) => {
          rl.question('请输入自定义任务描述: ', (answer: string) => {
            resolve(answer.trim());
          });
        });
        break;
      default:
        taskDescription = taskChoice;
    }

    console.log(`\n执行任务: ${taskDescription}`);
    
    if (config.interactive?.enabled) {
      console.log('💡 交互模式已启用，Agent 会在执行过程中询问您的确认\n');
    }

    // 执行任务
    const result = await agent.executeTask(taskDescription);
    
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

    // 显示统计信息
    const stats = await agent.getStats();
    console.log('\n=== 统计信息 ===');
    console.log('📈 总任务数:', stats.tasks.total);
    console.log('✅ 成功任务:', stats.tasks.completed);
    console.log('❌ 失败任务:', stats.tasks.failed);
    console.log('🛠️  可用工具数:', stats.tools.length || 0);

    if (config.interactive?.enabled) {
      const interactiveStats = agent.getInteractiveStats();
      console.log('🗣️  交互统计:', interactiveStats);
    }

    console.log('\n=== 下一步建议 ===');
    console.log('• 查看完整使用指南: USAGE.md');
    console.log('• 运行其他示例: pnpm example:files, pnpm example:http');
    console.log('• 运行多媒体功能: pnpm example:multimedia');
    console.log('• 运行测试: pnpm test');

  } catch (error) {
    console.error('❌ 执行失败:', error);
  } finally {
    await agent.shutdown();
    rl.close();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  quickStart().catch(console.error);
}

export { quickStart };