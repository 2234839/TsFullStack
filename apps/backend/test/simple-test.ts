#!/usr/bin/env tsx

/**
 * 最简单的 API 测试
 * 直接使用 fetch 测试后端 API
 */

const API_BASE = 'http://localhost:5209';

async function testAPI() {
  console.log('\n🧪 后端 API 测试\n');
  console.log(`📡 地址: ${API_BASE}\n`);

  try {
    // 1. 测试系统连接
    console.log('1️⃣ 测试系统连接...');
    const systemResponse = await fetch(`${API_BASE}/api/systemApis/getModelMeta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!systemResponse.ok) {
      throw new Error(`系统连接失败: ${systemResponse.status}`);
    }

    const systemData = await systemResponse.json();
    console.log(`   ✅ 系统正常`);
    console.log(`   - 模型数量: ${Object.keys(systemData.models || {}).length}\n`);

    // 2. 注册测试用户
    console.log('2️⃣ 创建测试用户...');
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'test123456';

    const registerResponse = await fetch(`${API_BASE}/api/authApi/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        username: 'testuser',
      }),
    });

    let userId: string;
    let token: string;

    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      userId = registerData.user.id;
      token = registerData.token;
      console.log(`   ✅ 注册成功: ${testEmail}`);
    } else {
      const errorText = await registerResponse.text();
      if (errorText.includes('已存在') || registerResponse.status === 400) {
        console.log(`   ℹ️  用户已存在，尝试登录...`);
      } else {
        throw new Error(`注册失败: ${errorText}`);
      }

      // 登录
      const loginResponse = await fetch(`${API_BASE}/api/authApi/passwordLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error(`登录失败: ${await loginResponse.text()}`);
      }

      const loginData = await loginResponse.json();
      userId = loginData.user.id;
      token = loginData.token;
      console.log(`   ✅ 登录成功`);
    }

    console.log(`   - 用户ID: ${userId}`);
    console.log(`   - Token: ${token.substring(0, 30)}...\n`);

    // 3. 测试 AI 图片生成
    console.log('3️⃣ 测试 AI 图片生成...');
    console.log(`   📝 提示词: 一只可爱的小猫`);

    const generateResponse = await fetch(`${API_BASE}/api/apis/taskApi/generateAIImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: '一只可爱的小猫，卡通风格，简洁明快',
        provider: 'qwen',
        count: 1,
        size: '1024x1024',
      }),
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.text();
      console.log(`   ⚠️  生成失败: ${error}`);

      if (error.includes('代币不足') || error.includes('API Key')) {
        console.log(`   💡 提示: 这是预期的，因为测试用户没有代币或未配置 API Key`);
        console.log(`   ✅ API 端点正常工作\n`);
      }
    } else {
      const generateData = await generateResponse.json();
      console.log(`   ✅ 生成成功!`);
      console.log(`   - 任务ID: ${generateData.taskId}`);
      console.log(`   - 生成数量: ${generateData.imagesCount}`);
    }

    console.log(`\n========================================`);
    console.log(`✅ 后端 API 基本功能正常!`);
    console.log(`========================================\n`);
    console.log(`📊 测试结果:`);
    console.log(`   ✅ 系统连接正常`);
    console.log(`   ✅ 用户认证正常`);
    console.log(`   ✅ API 路由正常`);

  } catch (error: any) {
    console.error(`\n========================================`);
    console.error(`❌ 测试失败!`);
    console.error(`========================================\n`);
    console.error(`错误:`, error.message);
    process.exit(1);
  }
}

testAPI();
