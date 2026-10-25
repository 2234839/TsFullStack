#!/usr/bin/env tsx

/**
 * 简化的 API 测试脚本
 * 快速验证后端功能是否正常
 */

import { createRPC, type API } from '../src/lib';
import type { AppAPI } from '../src/api/appApi';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5209';

console.log('\n🧪 API 功能验证测试\n');
console.log(`📡 后端地址: ${API_BASE_URL}\n`);

// 创建 RPC 客户端
const { API: apiClient } = createRPC<AppAPI>('apiConsumer', {
  remoteCall: async (method: string, data: any[]) => {
    const url = `${API_BASE_URL}/api/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return response.json();
  },
});

// 类型断言，方便使用
const API = apiClient as any;

async function testAPI() {
  try {
    // 1. 测试系统 API
    console.log('1️⃣ 测试系统连接...');
    const modelMeta = await API.systemApis.getModelMeta();
    console.log(`   ✅ 系统正常，模型数量: ${Object.keys(modelMeta.models).length}\n`);

    // 2. 注册/登录测试用户
    console.log('2️⃣ 创建测试用户...');
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'test123456';

    try {
      await API.authApi.register({
        email: testEmail,
        password: testPassword,
        username: 'testuser',
      });
      console.log(`   ✅ 注册成功: ${testEmail}\n`);
    } catch (error: any) {
      // 可能已存在，尝试登录
      console.log(`   ℹ️  用户可能已存在，尝试登录...\n`);
    }

    // 登录
    const loginResult = await API.authApi.passwordLogin({
      email: testEmail,
      password: testPassword,
    });
    console.log(`   ✅ 登录成功`);
    console.log(`   - 用户ID: ${loginResult.user.id}`);
    console.log(`   - Token: ${loginResult.token.substring(0, 30)}...\n`);

    // 3. 测试 AI 图片生成（注意：这会消耗代币）
    console.log('3️⃣ 测试 AI 图片生成...');
    console.log(`   📝 提示词: 一只可爱的小猫`);

    const generateResult = await API.apis.taskApi.generateAIImage({
      prompt: '一只可爱的小猫，卡通风格，简洁明快',
      provider: 'qwen',
      count: 1,
      size: '1024x1024',
    });

    console.log(`   ✅ 生成成功!`);
    console.log(`   - 任务ID: ${generateResult.taskId}`);
    console.log(`   - 生成数量: ${generateResult.imagesCount}`);
    console.log(`   - 图片URL: ${generateResult.images[0].substring(0, 60)}...\n`);

    // 4. 测试任务查询
    console.log('4️⃣ 测试任务查询...');
    const task = await API.apis.taskApi.getTaskDetail({
      taskId: generateResult.taskId,
    });
    console.log(`   ✅ 任务状态: ${task.status}`);
    console.log(`   - 任务标题: ${task.title}\n`);

    // 5. 测试资源查询
    console.log('5️⃣ 测试资源查询...');
    const resources = await API.apis.taskApi.listResources({
      type: 'IMAGE',
      skip: 0,
      take: 5,
    });
    console.log(`   ✅ 资源查询成功`);
    console.log(`   - 图片资源数量: ${resources.resources.length} (总计: ${resources.total})\n`);

    // 总结
    console.log('========================================');
    console.log('✅ 所有测试通过!');
    console.log('========================================\n');
    console.log('📊 测试结果总结:');
    console.log('   ✅ 系统连接正常');
    console.log('   ✅ 用户认证正常');
    console.log('   ✅ AI 图片生成正常');
    console.log('   ✅ 任务管理正常');
    console.log('   ✅ 资源管理正常');
    console.log('\n🎉 后端 API 功能完全正常！\n');
  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ 测试失败!');
    console.error('========================================\n');
    console.error('错误详情:', error.message);
    if (error.message?.includes('API Key')) {
      console.error('\n💡 提示: 请确保在 .env 文件中配置了 QWEN_API_KEY');
    }
    process.exit(1);
  }
}

testAPI();
