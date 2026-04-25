<script setup lang="ts">
import { ref } from 'vue';
import AIImageGenerator from '@/components/AIImageGenerator.vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useRouter } from 'vue-router';

const toast = useToast();
const { t } = useI18n();
const router = useRouter();

/** 生成完成后的任务ID列表 */
const completedTaskIds = ref<number[]>([]);

/** 处理生成完成 */
function handleGenerationComplete(taskId: number) {
  completedTaskIds.value.push(taskId);

  toast.success(t('任务已完成'), t('图片已生成并保存到资源库'));

}

/** 查看资源库 */
function viewResourceGallery() {
  router.push('/admin/resourceGallery');
}
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <PageHeader size="large" :subtitle="t('使用 AI 生成创意图片，支持多种服务商和自定义参数')">
      {{ t('AI 图片生成') }}
    </PageHeader>

    <!-- 提示信息 -->
    <div class="mb-6 p-4 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-info-600 dark:text-info-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-info-800 dark:text-info-200">
            {{ t('代币消耗说明') }}
          </h3>
          <div class="mt-1 text-sm text-info-700 dark:text-info-300">
            <p>{{ t('每生成 1 张图片消耗 {count} 枚代币', { count: 10 }) }}</p>
            <p class="mt-1">{{ t('生成完成后，图片会自动保存到资源库中') }}</p>
          </div>
        </div>
        <Button
          variant="text"
          class="ml-4 text-info-600 dark:text-info-400"
          size="sm"
          @click="viewResourceGallery"
        >
          {{ t('查看资源库') }} →
        </Button>
      </div>
    </div>

    <!-- AI 图片生成器 -->
    <div class="bg-white dark:bg-primary-800 rounded-lg shadow p-6">
      <AIImageGenerator @complete="handleGenerationComplete" />
    </div>

    <!-- 统计信息 -->
    <div v-if="completedTaskIds.length > 0" class="mt-6 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4">
      <p class="text-sm text-success-800 dark:text-success-200">
        {{ t('本次会话已完成 {count} 个生成任务', { count: completedTaskIds.length }) }}
      </p>
    </div>
  </div>
</template>
