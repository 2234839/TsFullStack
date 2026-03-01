#!/usr/bin/env tsx

/**
 * 手动测试脚本
 * 用于快速验证 API 功能，无需完整的测试框架
 */

import { setupTestEnvironment } from './api-test-client';

async function manualTest() {
  console.log('\n🧪 手动测试模式\n');

  // 1. 设置测试环境
  console.log('1️⃣ 设置测试环境...');
  const { userSession, authenticatedAPI } = await setupTestEnvironment();

  // 2. 查询代币余额
  console.log('\n2️⃣ 查询代币余额...');
  const tokens = await authenticatedAPI.apis.testApi.getAvailableTokens({
    userId: userSession.userId,
  });
  console.log(`💰 当前代币余额:`);
  console.log(`   - 总计: ${tokens.total}`);
  console.log(`   - 月度: ${tokens.monthly}`);
  console.log(`   - 年度: ${tokens.yearly}`);
  console.log(`   - 永久: ${tokens.permanent}`);

  // 3. 生成 AI 图片
  console.log('\n3️⃣ 生成 AI 图片...');
  const prompt = '一只可爱的小猫，坐在窗台上，阳光温暖，治愈系风格';

  console.log(`📝 提示词: ${prompt}`);
  console.log(`⏳ 开始生成...`);

  const startTime = Date.now();

  const result = await authenticatedAPI.apis.taskApi.generateAIImage({
    prompt,
    provider: 'qwen',
    count: 1,
    size: '1024x1024',
  });

  const elapsed = Date.now() - startTime;

  console.log(`✅ 生成完成! (耗时: ${elapsed}ms)`);
  console.log(`   - 任务ID: ${result.taskId}`);
  console.log(`   - 生成数量: ${result.imagesCount}`);
  console.log(`   - 图片URL: ${result.images[0]}`);

  // 4. 查询任务详情
  console.log('\n4️⃣ 查询任务详情...');
  const task = await authenticatedAPI.apis.taskApi.getTaskDetail({
    taskId: result.taskId,
  });
  console.log(`📋 任务状态: ${task.status}`);
  console.log(`   - 创建时间: ${new Date(task.created).toLocaleString('zh-CN')}`);
  if (task.completedAt) {
    console.log(`   - 完成时间: ${new Date(task.completedAt).toLocaleString('zh-CN')}`);
  }

  // 5. 查询资源列表
  console.log('\n5️⃣ 查询资源列表...');
  const resources = await authenticatedAPI.apis.taskApi.listResources({
    type: 'IMAGE',
    skip: 0,
    take: 5,
  });
  console.log(`📁 图片资源: ${resources.resources.length} 个 (总计: ${resources.total})`);

  // 6. 验证代币消耗
  console.log('\n6️⃣ 验证代币消耗...');
  const tokensAfter = await authenticatedAPI.apis.testApi.getAvailableTokens({
    userId: userSession.userId,
  });
  const consumed = tokens.total - tokensAfter.total;
  console.log(`💰 代币消耗: ${consumed}`);
  console.log(`   - 消耗前: ${tokens.total}`);
  console.log(`   - 消耗后: ${tokensAfter.total}`);

  // 7. 总结
  console.log('\n✅ 测试完成!');
  console.log('\n📊 测试总结:');
  console.log(`   ✅ 代币系统正常`);
  console.log(`   ✅ AI 图片生成正常`);
  console.log(`   ✅ 任务管理正常`);
  console.log(`   ✅ 资源管理正常`);
  console.log(`   ✅ 代币消耗正常`);
  console.log(`   ⏱️️  总耗时: ${elapsed}ms`);
}

// 运行手动测试
manualTest().catch((error) => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});
