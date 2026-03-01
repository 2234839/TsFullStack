<script setup lang="ts">
import { ref } from 'vue';
import AIImageGenerator from '@/components/AIImageGenerator.vue';
import { useToast } from '@/composables/useToast';
import { useRouter } from 'vue-router';

const toast = useToast();
const router = useRouter();

/** 生成完成后的任务ID列表 */
const completedTaskIds = ref<number[]>([]);

/** 处理生成完成 */
function handleGenerationComplete(taskId: number) {
  completedTaskIds.value.push(taskId);

  toast.add({
    summary: '任务已完成',
    detail: '图片已生成并保存到资源库',
    variant: 'success',
  });

  // 可选：跳转到资源库查看
  // router.push('/admin/resourceGallery');
}

/** 查看资源库 */
function viewResourceGallery() {
  router.push('/admin/resourceGallery');
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        AI 图片生成
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        使用 AI 生成创意图片，支持多种服务商和自定义参数
      </p>
    </div>

    <!-- 提示信息 -->
    <div class="mb-6 p-4 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-info-600 dark:text-info-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-info-800 dark:text-info-200">
            代币消耗说明
          </h3>
          <div class="mt-1 text-sm text-info-700 dark:text-info-300">
            <p>每生成 1 张图片消耗 <strong>10 枚代币</strong></p>
            <p class="mt-1">生成完成后，图片会自动保存到资源库中</p>
          </div>
        </div>
        <button
          type="button"
          class="ml-4 text-sm text-info-600 dark:text-info-400 hover:text-info-800 dark:hover:text-info-200 font-medium"
          @click="viewResourceGallery"
        >
          查看资源库 →
        </button>
      </div>
    </div>

    <!-- AI 图片生成器 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <AIImageGenerator @complete="handleGenerationComplete" />
    </div>

    <!-- 统计信息 -->
    <div v-if="completedTaskIds.length > 0" class="mt-6 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4">
      <p class="text-sm text-success-800 dark:text-success-200">
        本次会话已完成 {{ completedTaskIds.length }} 个生成任务
      </p>
    </div>
  </div>
</template>
