import { TsAgent } from '../src';

async function multimediaExample() {
  console.log('=== TsAgent 多媒体功能示例 ===\\n');

  const config = {
    storage: {
      type: 'json' as const,
      dataDir: './data'
    },
    security: {
      enablePermissions: true,
      allowedTools: [
        'image_analysis', 'image_generation', 'ocr',
        'video_generation', 'video_analysis', 'video_script'
      ],
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
      timeout: 60000
    }
  };

  const agent = new TsAgent(config);

  try {
    await agent.initialize();
    console.log('✓ Agent 初始化成功\\n');

    // 获取可用工具
    const tools = await agent.getAvailableTools();
    console.log('可用工具:', tools.join(', '), '\\n');

    // 示例1: 图像分析
    console.log('1. 图像分析示例...');
    const result1 = await agent.executeTask('分析一张图片中的内容，识别其中的物体和文字');
    console.log('结果:', result1.success ? '✓ 成功' : '✗ 失败');
    console.log('');

    // 示例2: 图像生成
    console.log('2. 图像生成示例...');
    const result2 = await agent.executeTask('生成一张美丽的日落风景图片');
    console.log('结果:', result2.success ? '✓ 成功' : '✗ 失败');
    console.log('');

    // 示例3: OCR文字识别
    console.log('3. OCR文字识别示例...');
    const result3 = await agent.executeTask('从图片中提取所有文字内容');
    console.log('结果:', result3.success ? '✓ 成功' : '✗ 失败');
    console.log('');

    // 示例4: 视频生成
    console.log('4. 视频生成示例...');
    const result4 = await agent.executeTask('生成一个展示猫咪玩耍的短视频');
    console.log('结果:', result4.success ? '✓ 成功' : '✗ 失败');
    console.log('');

    // 示例5: 视频脚本生成
    console.log('5. 视频脚本生成示例...');
    const result5 = await agent.executeTask('为"如何制作拿铁咖啡"生成一个60秒的视频脚本');
    console.log('结果:', result5.success ? '✓ 成功' : '✗ 失败');
    console.log('');

    // 显示统计信息
    const stats = await agent.getStats();
    console.log('统计信息:');
    console.log('- 总任务数:', stats.tasks.total);
    console.log('- 成功任务:', stats.tasks.completed);
    console.log('- 失败任务:', stats.tasks.failed);
    console.log('- 可用工具数:', stats.tools.length || 0);

  } catch (error) {
    console.error('多媒体示例失败:', error);
  } finally {
    await agent.shutdown();
  }
}

if (require.main === module) {
  multimediaExample().catch(console.error);
}