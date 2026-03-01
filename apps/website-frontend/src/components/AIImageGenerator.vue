<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog } from '@tsfullstack/shared-frontend/components';

const emit = defineEmits<{
  complete: [taskId: number];
}>();

const toast = useToast();
const { API } = useAPI();

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

/** 是否可以生成 */
const canGenerate = computed(() => {
  return prompt.value.trim().length > 0 && !isGenerating.value;
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
  } catch (error) {
    console.error('[AIImageGenerator] 加载服务商列表失败:', error);
  }
}

/** 组件挂载时加载服务商列表 */
onMounted(() => {
  loadAvailableProviders();
});

/** 使用模板 */
function useTemplate(template: typeof promptTemplates[0]) {
  prompt.value = template.value;
}

/** 开始生成 */
async function startGeneration() {
  if (!canGenerate.value) return;

  isGenerating.value = true;
  generatedImages.value = [];
  currentTaskId.value = null;
  showResultDialog.value = false;

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
      detail: `成功生成 ${result.imagesCount} 张图片`,
      variant: 'success',
    });

    emit('complete', result.taskId);
  } catch (error) {
    console.error('[AIImageGenerator] 生成失败:', error);

    /** 不应展示给用户的错误关键词 */
    const hiddenKeywords = ['未配置', 'API Key', '配置错误'];

    const errorMessage = error instanceof Error ? error.message : '生成图片时发生错误';

    /** 检查错误消息是否包含不应展示的关键词 */
    const shouldHideError = hiddenKeywords.some(keyword =>
      errorMessage.includes(keyword)
    );

    if (!shouldHideError) {
      toast.add({
        summary: '生成失败',
        detail: errorMessage,
        variant: 'error',
      });
    }
  } finally {
    isGenerating.value = false;
  }
}

/** 选择图片 */
async function selectImage(_imageUrl: string) {
  if (!currentTaskId.value) return;

  try {
    // TODO: 调用 selectAndDownloadImage API
    toast.add({
      summary: '功能开发中',
      detail: '图片下载功能正在开发中',
      variant: 'info',
    });
  } catch (error) {
    console.error('[AIImageGenerator] 下载失败:', error);

    /** 不应展示给用户的错误关键词 */
    const hiddenKeywords = ['未配置', 'API Key', '配置错误'];

    const errorMessage = error instanceof Error ? error.message : '下载图片时发生错误';

    /** 检查错误消息是否包含不应展示的关键词 */
    const shouldHideError = hiddenKeywords.some(keyword =>
      errorMessage.includes(keyword)
    );

    if (!shouldHideError) {
      toast.add({
        summary: '下载失败',
        detail: errorMessage,
        variant: 'error',
      });
    }
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 提示词输入 -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        提示词
      </label>
      <textarea
        v-model="prompt"
        rows="4"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        placeholder="描述你想要生成的图片..."
        :disabled="isGenerating"
      />
    </div>

    <!-- 快捷模板 -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        快捷模板
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="template in promptTemplates"
          :key="template.label"
          type="button"
          class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          :disabled="isGenerating"
          @click="useTemplate(template)"
        >
          {{ template.label }}
        </button>
      </div>
    </div>

    <!-- 参数选择 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- 服务提供商 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          服务商
        </label>
        <select
          v-model="provider"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          :disabled="isGenerating || availableProviders.length === 0"
        >
          <option
            v-for="providerOption in availableProviders"
            :key="providerOption.value"
            :value="providerOption.value"
          >
            {{ providerOption.label }}
          </option>
        </select>
        <p
          v-if="availableProviders.length === 0"
          class="mt-1 text-sm text-gray-500 dark:text-gray-400"
        >
          暂无可用的 AI 服务
        </p>
      </div>

      <!-- 生成数量 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          数量
        </label>
        <select
          v-model="count"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          尺寸
        </label>
        <select
          v-model="size"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          :disabled="isGenerating"
        >
          <option v-for="option in sizeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="flex justify-end">
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
        :disabled="!canGenerate"
        @click="startGeneration"
      >
        <span v-if="isGenerating">生成中...</span>
        <span v-else>生成图片</span>
      </button>
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
            class="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
          />
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              type="button"
              class="px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              @click="selectImage(imageUrl)"
            >
              选择此图片
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>
