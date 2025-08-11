import { TsAgent } from '../src';

async function interactiveExample() {
  console.log('=== TsAgent 交互式使用示例 ===\n');

  const config = {
    storage: {
      type: 'json' as const,
      dataDir: './data'
    },
    security: {
      enablePermissions: true,
      allowedTools: ['file_write', 'file_read', 'system_info', 'http_get'],
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
    },
    // 交互式配置
    interactive: {
      enabled: true,           // 启用交互式决策
      confirmBeforeExecution: true,  // 执行前确认
      askForClarification: true,     // 需要澄清时询问
      maxQuestions: 5               // 最大询问次数
    }
  };

  const agent = new TsAgent(config);

  try {
    await agent.initialize();
    console.log('✓ Agent 初始化成功\n');

    // 获取可用工具
    const tools = await agent.getAvailableTools();
    console.log('可用工具:', tools.join(', '), '\n');

    // 示例任务列表
    const tasks = [
      '创建一个测试文件并写入内容',
      '分析当前系统状态',
      '获取一个网页的内容'
    ];

    console.log('=== 任务列表 ===');
    tasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task}`);
    });
    console.log('');

    // 交互式选择任务
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, (answer: string) => {
          resolve(answer);
        });
      });
    };

    const selectedTask = await askQuestion('请选择要执行的任务 (输入数字或自定义任务): ');
    
    let taskDescription = '';
    if (selectedTask.match(/^\d+$/)) {
      const index = parseInt(selectedTask) - 1;
      if (index >= 0 && index < tasks.length) {
        taskDescription = tasks[index];
      }
    } else {
      taskDescription = selectedTask;
    }

    if (!taskDescription) {
      console.log('无效的选择，使用默认任务');
      taskDescription = tasks[0];
    }

    console.log(`\n执行任务: ${taskDescription}`);
    
    // 执行任务
    const result = await agent.executeTask(taskDescription);
    
    console.log('\n=== 执行结果 ===');
    console.log('成功:', result.success);
    console.log('执行时间:', result.executionTime, 'ms');
    console.log('执行步骤:', result.stepsExecuted);
    
    if (result.result) {
      console.log('结果:', JSON.stringify(result.result, null, 2));
    }
    
    if (result.error) {
      console.log('错误:', result.error);
    }

    // 显示统计信息
    const stats = await agent.getStats();
    console.log('\n=== 统计信息 ===');
    console.log('总任务数:', stats.tasks.total);
    console.log('成功任务:', stats.tasks.completed);
    console.log('失败任务:', stats.tasks.failed);
    console.log('可用工具数:', stats.tools.length || 0);

    rl.close();

  } catch (error) {
    console.error('交互式示例失败:', error);
  } finally {
    await agent.shutdown();
  }
}

if (require.main === module) {
  interactiveExample().catch(console.error);
}