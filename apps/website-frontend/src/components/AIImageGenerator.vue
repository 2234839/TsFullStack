<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { useTokenStoreSingleton } from '@/stores/token';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import { Button, Textarea } from '@/components/base';
import { getErrorMessage } from '@/utils/error';

/** 不应展示给用户的错误关键词 */
const ERROR_HIDE_KEYWORDS = ['未配置', 'API Key', '配置错误'] as const;

/**
 * 安全地显示错误 toast，过滤掉包含敏感关键词的错误消息
 */
function showSafeError(
  toast: ReturnType<typeof useToast>,
  summary: string,
  fallbackMessage: string,
  error: unknown,
) {
  const message = getErrorMessage(error, fallbackMessage);
  if (ERROR_HIDE_KEYWORDS.some((kw) => message.includes(kw))) return;
  toast.add({ summary, detail: message, variant: 'error' });
}

const emit = defineEmits<{
  complete: [taskId: number];
}>();

const toast = useToast();
const { API } = useAPI();
const tokenStore = useTokenStoreSingleton();

/** 提示词 */
const prompt = ref('');

/** AI 服务提供商 */
const provider = ref<'qwen' | 'dalle' | 'stability'>('qwen');

/** 可用的服务商列表 */
const availableProviders = ref<Array<{ value: string; label: string }>>([]);

/** 生成数量 */
const count = ref(1);

/** 图片尺寸 */
const size = ref('1024x1024');

/** 生成中 */
const isGenerating = ref(false);

/** 当前任务 ID */
const currentTaskId = ref<number | null>(null);

/** 生成的图片 URL */
const generatedImages = ref<string[]>([]);

/** 显示结果对话框 */
const showResultDialog = ref(false);

/** 快捷提示词模板 */
const promptTemplates = [
  { label: '产品展示', value: '一个精美的产品展示图，现代简约风格，白色背景，柔和光照' },
  { label: '文章封面', value: '博客文章封面图，科技感，抽象几何图形，蓝色渐变' },
  { label: '人物头像', value: '专业头像照片，商务风格，微笑，清晰背景' },
  { label: '自然风景', value: '美丽的自然风景，高清，明亮色彩，宁静氛围' },
];

/** 可用的尺寸选项 */
const sizeOptions = [
  { label: '1024x1024', value: '1024x1024' },
  { label: '1024x768', value: '1024x768' },
  { label: '768x1024', value: '768x1024' },
  { label: '512x512', value: '512x512' },
];

/** 尺寸倍数映射（与后端 TokenPricingCalculator.SIZE_MULTIPLIER 保持一致） */
const SIZE_MULTIPLIER: Record<string, number> = {
  '512x512': 0.5,
  '1024x768': 0.75,
  '768x1024': 0.75,
  '1024x1024': 1,
  '1344x768': 1.25,
  '768x1344': 1.25,
  '864x1152': 1.5,
  '1152x864': 1.5,
  '2048x2048': 2,
};

/** 服务商倍数映射（与后端 TokenPricingCalculator.PROVIDER_MULTIPLIER 保持一致） */
const PROVIDER_MULTIPLIER: Record<string, number> = {
  qwen: 1,
  dalle: 2,
  stability: 1.5,
  glm: 1.2,
};

/** 预计消耗代币（与后端公式保持一致：basePrice × count × sizeMult × providerMult） */
const estimatedCost = computed(() => {
  const basePrice = 10;
  const sizeMult = SIZE_MULTIPLIER[size.value] || 1;
  const providerMult = PROVIDER_MULTIPLIER[provider.value] || 1;
  return Math.ceil(basePrice * count.value * sizeMult * providerMult);
});

/** 是否可以生成 */
const canGenerate = computed(() => {
  return prompt.value.trim().length > 0 &&
         !isGenerating.value &&
         tokenStore.balance.value.total >= estimatedCost.value;
});

/** 加载可用的服务商列表 */
async function loadAvailableProviders() {
  try {
    const providers = await API.taskApi.getAvailableProviders();
    availableProviders.value = providers;

    /** 如果当前选择的服务商不可用，切换到第一个可用的 */
    if (providers.length > 0 && providers[0]) {
      const currentProviderAvailable = providers.some((p: { value: string; label: string }) => p.value === provider.value);
      if (!currentProviderAvailable) {
        provider.value = providers[0].value as 'qwen' | 'dalle' | 'stability';
      }
    }
  } catch (error: unknown) {
    toast.error('加载服务商列表失败', getErrorMessage(error));
  }
}

/** 组件挂载时加载服务商列表和代币余额 */
onMounted(() => {
  loadAvailableProviders();
  tokenStore.refreshBalance(true);
});

/** 使用模板 */
function useTemplate(template: typeof promptTemplates[0]) {
  prompt.value = template.value;
}

/** 开始生成 */
async function startGeneration() {
  if (!canGenerate.value) {
    if (tokenStore.balance.value.total < estimatedCost.value) {
      toast.add({
        summary: '代币不足',
        detail: `需要 ${estimatedCost.value} 枚代币，当前余额 ${tokenStore.balance.value.total} 枚`,
        variant: 'error',
      });
    }
    return;
  }

  isGenerating.value = true;
  generatedImages.value = [];
  currentTaskId.value = null;
  showResultDialog.value = false;

  // 乐观扣减余额
  tokenStore.optimisticallyDeduct(estimatedCost.value);

  try {
    const result = await API.taskApi.generateAIImage({
      prompt: prompt.value.trim(),
      provider: provider.value,
      count: count.value,
      size: size.value,
    });

    currentTaskId.value = result.taskId;
    generatedImages.value = result.images;
    showResultDialog.value = true;

    toast.add({
      summary: '生成成功',
      detail: `成功生成 ${result.imagesCount} 张图片，消耗 ${estimatedCost.value} 枚代币`,
      variant: 'success',
    });

    emit('complete', result.taskId);

    // 刷新真实余额（等待刷新完成）
    try {
      await tokenStore.refreshBalance(true);
    } catch {
      // 刷新失败不影响用户体验，下次操作时会重新尝试
    }
  } catch (error: unknown) {

    try { await tokenStore.resetBalance(); } catch { /* 恢复失败继续处理 */ }

    showSafeError(toast, '生成失败', '生成图片时发生错误', error);
  } finally {
    isGenerating.value = false;
  }
}

/** 选择并下载图片到文件系统 */
async function selectImage(imageUrl: string) {
  if (!currentTaskId.value) return;

  try {
    const result = await API.taskApi.selectAndDownloadImage({
      taskId: currentTaskId.value,
      imageUrl,
    });
    toast.add({
      summary: '下载成功',
      detail: `已保存为 ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`,
      variant: 'success',
      life: 3000,
    });
  } catch (error: unknown) {
    showSafeError(toast, '下载失败', '下载图片时发生错误', error);
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 提示词输入 -->
    <div>
      <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
        提示词
      </label>
      <Textarea
        v-model="prompt"
        :rows="4"
        placeholder="描述你想要生成的图片..."
        :disabled="isGenerating"
      />
    </div>

    <!-- 快捷模板 -->
    <div>
      <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
        快捷模板
      </label>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="template in promptTemplates"
          :key="template.label"
          variant="secondary"
          size="sm"
          :disabled="isGenerating"
          @click="useTemplate(template)"
        >
          {{ template.label }}
        </Button>
      </div>
    </div>

    <!-- 参数选择 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- 服务提供商 -->
      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
          服务商
        </label>
        <Select
          v-model="provider"
          :options="availableProviders"
          :disabled="isGenerating || availableProviders.length === 0"
          class="w-full"
        />
        <p
          v-if="availableProviders.length === 0"
          class="mt-1 text-sm text-primary-500 dark:text-primary-400"
        >
          暂无可用的 AI 服务
        </p>
      </div>

      <!-- 生成数量 -->
      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
          数量
        </label>
        <select
          v-model="count"
          class="w-full px-3 py-2 border border-primary-300 dark:border-primary-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-primary-800 text-primary-900 dark:text-primary-100"
          :disabled="isGenerating"
        >
          <option :value="1">1 张</option>
          <option :value="2">2 张</option>
          <option :value="3">3 张</option>
          <option :value="4">4 张</option>
        </select>
      </div>

      <!-- 图片尺寸 -->
      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
          尺寸
        </label>
        <Select
          v-model="size"
          :options="sizeOptions"
          :disabled="isGenerating"
          class="w-full"
        />
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="flex justify-between items-center">
      <!-- 代币余额显示 -->
      <div class="text-sm text-secondary-600 dark:text-secondary-400">
        <span class="font-medium">代币余额:</span>
        <span :class="{
          'text-danger-600 dark:text-danger-400': tokenStore.isLowBalance.value,
          'text-success-600 dark:text-success-400': !tokenStore.isLowBalance.value
        }">
          {{ tokenStore.balance.value.total }} 枚
        </span>
        <span v-if="estimatedCost > 0" class="ml-2 text-secondary-500">
          (预计消耗 {{ estimatedCost }} 枚)
        </span>
      </div>

      <Button
        :disabled="!canGenerate"
        :loading="isGenerating"
        @click="startGeneration"
      >
        {{ isGenerating ? '生成中...' : '生成图片' }}
      </Button>
    </div>

    <!-- 结果对话框 -->
    <Dialog
      v-model:open="showResultDialog"
      title="生成的图片"
    >
      <!-- 图片列表 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="(imageUrl, index) in generatedImages"
          :key="index"
          class="relative group"
        >
          <img
            :src="imageUrl"
            :alt="`Generated image ${index + 1}`"
            class="w-full h-auto rounded-lg border border-primary-200 dark:border-primary-700"
          />
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button
              size="sm"
              @click="selectImage(imageUrl)"
            >
              选择此图片
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
