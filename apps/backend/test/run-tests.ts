#!/usr/bin/env tsx

/**
 * API 测试运行器
 * 可以直接运行来测试后端 API，无需前端界面
 */

import { runAITests } from './ai-image.test';

async function main() {
  console.log('\n🚀 启动 API 测试...\n');

  // 检查后端服务是否运行
  const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${API_URL}/api/systemApis/getModelMeta`);
    if (!response.ok) {
      throw new Error(`后端服务未运行: ${API_URL}`);
    }
    console.log(`✅ 后端服务已连接: ${API_URL}\n`);
  } catch (error) {
    console.error(`❌ 无法连接到后端服务: ${API_URL}`);
    console.error('   请确保后端服务正在运行: pnpm dev\n');
    process.exit(1);
  }

  // 运行 AI 图片生成测试
  await runAITests();
}

main().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
