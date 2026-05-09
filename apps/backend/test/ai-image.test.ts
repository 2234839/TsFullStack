/**
 * AI 图片生成 API 测试用例
 * 测试完整的 AI 图片生成流程
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { setupTestEnvironment, TEST_ACCOUNTS, testAccounts } from './api-test-client';

describe('AI 图片生成 API 测试', () => {
  let userSession: any;
  let authenticatedAPI: any;

  beforeAll(async () => {
    // 设置测试环境
    const setup = await setupTestEnvironment();
    userSession = setup.userSession;
    authenticatedAPI = setup.authenticatedAPI;
  });

  describe('代币管理', () => {
    it('应该能够查询用户的可用代币', async () => {
      const tokens = await authenticatedAPI.apis.testApi?.getAvailableTokens?.({
        userId: userSession.userId,
      });

      expect(tokens).toBeDefined();
      expect(tokens.total).toBeGreaterThan(0);
      expect(tokens.monthly).toBeGreaterThan(0);
      expect(tokens.yearly).toBeGreaterThan(0);
      expect(tokens.permanent).toBeGreaterThan(0);

      console.log(`  💰 可用代币总计: ${tokens.total}`);
      console.log(`     - 月度: ${tokens.monthly}`);
      console.log(`     - 年度: ${tokens.yearly}`);
      console.log(`     - 永久: ${tokens.permanent}`);
    });

    it('应该能够检查代币是否足够', async () => {
      const hasEnough = await authenticatedAPI.apis.testApi?.checkTokens?.({
        userId: userSession.userId,
        amount: 100,
      });

      expect(hasEnough).toBe(true);
    });
  });

  describe('AI 图片生成', () => {
    it('应该能够生成 AI 图片（通义千问）', async () => {
      const prompt = '一只可爱的橘猫，坐在窗台上，阳光洒进来，高清摄影';

      console.log(`  🎨 生成提示词: ${prompt}`);

      const result = await authenticatedAPI.apis.taskApi.generateAIImage({
        prompt,
        provider: 'qwen',
        count: 1,
        size: '1024x1024',
      });

      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      expect(result.imagesCount).toBe(1);
      expect(result.images).toHaveLength(1);

      console.log(`  ✅ 生成成功!`);
      console.log(`     - 任务ID: ${result.taskId}`);
      console.log(`     - 生成数量: ${result.imagesCount}`);
      console.log(`     - 图片URL: ${result.images[0].substring(0, 50)}...`);
    });

    it('应该能够生成多张图片', async () => {
      const prompt = '风景照，山川河流，蓝天白云';

      console.log(`  🎨 生成 ${2} 张图片...`);

      const result = await authenticatedAPI.apis.taskApi.generateAIImage({
        prompt,
        provider: 'qwen',
        count: 2,
        size: '1024x1024',
      });

      expect(result.imagesCount).toBe(2);
      expect(result.images).toHaveLength(2);

      console.log(`  ✅ 成功生成 ${result.imagesCount} 张图片`);
    });

    it('应该能够生成不同尺寸的图片', async () => {
      const sizes = ['1024x1024', '1024x768', '512x512'] as const;

      for (const size of sizes) {
        console.log(`  🎨 生成 ${size} 图片...`);

        const result = await authenticatedAPI.apis.taskApi.generateAIImage({
          prompt: '测试图片',
          provider: 'qwen',
          count: 1,
          size,
        });

        expect(result).toBeDefined();
        console.log(`    ✅ ${size} 生成成功`);
      }
    });

    it('应该拒绝空提示词', async () => {
      await expect(
        authenticatedAPI.apis.taskApi.generateAIImage({
          prompt: '',
          provider: 'qwen',
          count: 1,
        })
      ).rejects.toThrow('提示词不能为空');
    });

    it('应该拒绝超过最大数量', async () => {
      await expect(
        authenticatedAPI.apis.taskApi.generateAIImage({
          prompt: '测试',
          provider: 'qwen',
          count: 10, // 超过最大值 4
        })
      ).rejects.toThrow('单次最多生成 4 张图片');
    });

    it('应该拒绝代币不足的请求', async () => {
      // 先获取当前代币
      const tokens = await authenticatedAPI.apis.testApi?.getAvailableTokens?.({
        userId: userSession.userId,
      });

      // 尝试消耗超过可用代币的数量
      const excessiveAmount = tokens.total + 10000;

      await expect(
        authenticatedAPI.apis.taskApi.generateAIImage({
          prompt: '测试',
          provider: 'qwen',
          count: Math.ceil(excessiveAmount / 10), // 每张图片 10 代币
        })
      ).rejects.toThrow('代币不足');
    });
  });

  describe('任务查询', () => {
    it('应该能够查询任务列表', async () => {
      // 先生成一个任务
      await authenticatedAPI.apis.taskApi.generateAIImage({
        prompt: '测试任务查询',
        provider: 'qwen',
        count: 1,
      });

      // 查询任务列表
      const tasks = await authenticatedAPI.apis.taskApi.listTasks({
        status: 'COMPLETED',
        skip: 0,
        take: 10,
      });

      expect(tasks).toBeDefined();
      expect(tasks.tasks).toBeInstanceOf(Array);
      expect(tasks.tasks.length).toBeGreaterThan(0);

      console.log(`  📋 查询到 ${tasks.tasks.length} 个任务`);
    });

    it('应该能够查询任务详情', async () => {
      // 先生成一个任务
      const generateResult = await authenticatedAPI.apis.taskApi.generateAIImage({
        prompt: '测试任务详情',
        provider: 'qwen',
        count: 1,
      });

      // 查询任务详情
      const task = await authenticatedAPI.apis.taskApi.getTaskDetail({
        taskId: generateResult.taskId,
      });

      expect(task).toBeDefined();
      expect(task.id).toBe(generateResult.taskId);
      expect(task.status).toBeDefined();

      console.log(`  📋 任务详情:`);
      console.log(`     - ID: ${task.id}`);
      console.log(`     - 状态: ${task.status}`);
      console.log(`     - 标题: ${task.title}`);
    });
  });

  describe('资源查询', () => {
    it('应该能够查询资源列表', async () => {
      // 先生成一个任务
      await authenticatedAPI.apis.taskApi.generateAIImage({
        prompt: '测试资源查询',
        provider: 'qwen',
        count: 2,
      });

      // 查询资源列表
      const resources = await authenticatedAPI.apis.taskApi.listResources({
        type: 'IMAGE',
        status: 'completed',
        skip: 0,
        take: 10,
      });

      expect(resources).toBeDefined();
      expect(resources.resources).toBeInstanceOf(Array);
      expect(resources.total).toBeGreaterThan(0);

      console.log(`  📁 查询到 ${resources.resources.length} 个资源（总计 ${resources.total}）`);
    });

    it('应该能够按类型筛选资源', async () => {
      const imageResources = await authenticatedAPI.apis.taskApi.listResources({
        type: 'IMAGE',
        skip: 0,
        take: 10,
      });

      expect(imageResources.resources).toBeDefined();

      // 验证所有资源都是图片类型
      imageResources.resources.forEach((resource: any) => {
        expect(resource.type).toBe('IMAGE');
      });

      console.log(`  📁 图片资源: ${imageResources.resources.length} 个`);
    });
  });

  describe('代币消耗验证', () => {
    it('生成图片后应该正确消耗代币', async () => {
      // 获取生成前的代币
      const beforeTokens = await authenticatedAPI.apis.testApi?.getAvailableTokens?.({
        userId: userSession.userId,
      });

      console.log(`  💰 生成前代币: ${beforeTokens.total}`);

      // 生成 2 张图片（应该消耗 20 代币）
      await authenticatedAPI.apis.taskApi.generateAIImage({
        prompt: '代币消耗测试',
        provider: 'qwen',
        count: 2,
      });

      // 获取生成后的代币
      const afterTokens = await authenticatedAPI.apis.testApi?.getAvailableTokens?.({
        userId: userSession.userId,
      });

      console.log(`  💰 生成后代币: ${afterTokens.total}`);

      // 验证代币消耗
      const consumed = beforeTokens.total - afterTokens.total;
      expect(consumed).toBe(20); // 2 张图片 × 10 代币/张

      console.log(`  ✅ 消耗代币: ${consumed}`);
    });
  });
});

/**
 * 运行测试的主函数
 */
export async function runAITests() {
  console.log('\n========================================');
  console.log('AI 图片生成 API 测试套件');
  console.log('========================================\n');
  console.log('注意: 此测试需要手动执行，不在 vitest 范围内');
}

// 如果直接运行此文件
if (require.main === module) {
  runAITests();
}
