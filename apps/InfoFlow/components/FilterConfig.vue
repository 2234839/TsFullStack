<template>
  <div class="space-y-4">
    <!-- 过滤开关 -->
    <div class="flex items-center gap-2">
      <ToggleSwitch
        :modelValue="modelValue?.enable"
        @update:modelValue="handleEnableChange"
        inputId="filter-enable-switch" />
      <label for="filter-enable-switch" class="text-sm text-gray-600 cursor-pointer">
        启用信息过滤
      </label>
    </div>

    <!-- 过滤配置详情 -->
    <div v-if="modelValue?.enable" class="border rounded-lg p-4 space-y-4">
      <!-- 过滤类型选择 -->
      <div>
        <label class="block text-sm font-medium mb-2">过滤类型</label>
        <div class="flex gap-4">
          <div class="flex items-center gap-2">
            <RadioButton
              :modelValue="modelValue?.filterType"
              value="js"
              inputId="js-filter-type"
              @update:modelValue="handleFilterTypeChange" />
            <label for="js-filter-type">JavaScript 过滤</label>
          </div>
          <div class="flex items-center gap-2">
            <RadioButton
              :modelValue="modelValue?.filterType"
              value="ai"
              inputId="ai-filter-type"
              @update:modelValue="handleFilterTypeChange" />
            <label for="ai-filter-type">AI 过滤</label>
          </div>
        </div>
      </div>

      <!-- JavaScript 过滤配置 -->
      <div v-if="modelValue?.filterType === 'js'">
        <label class="block text-sm font-medium mb-2">JavaScript 过滤代码</label>
        <Textarea
          :modelValue="modelValue?.jsFilter?.code"
          @update:modelValue="handleJsCodeChange"
          placeholder="// 编写过滤函数，接收数据项作为参数，返回 true 表示保留，false 表示过滤
// 参数: item (单个数据项)
// 返回: boolean (true: 保留, false: 过滤)
function filterItem(item) {
  // 示例：只保留包含特定关键词的项
  return item.title && item.title.includes('重要');
}"
          rows="6"
          class="w-full font-mono text-sm" />
        <small class="text-gray-500">
          编写一个过滤函数，函数接收一个数据项作为参数，返回 true 表示保留该项，false 表示过滤掉该项。
          函数名为 filterItem，可以使用 JavaScript 的所有特性。
        </small>
      </div>

      <!-- AI 过滤配置 -->
      <div v-if="modelValue?.filterType === 'ai'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">AI 服务提供商</label>
          <div class="flex gap-4">
            <div class="flex items-center gap-2">
              <RadioButton
                :modelValue="modelValue?.aiFilter?.provider"
                value="openai"
                inputId="openai-provider"
                @update:modelValue="handleAiProviderChange" />
              <label for="openai-provider">OpenAI</label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                :modelValue="modelValue?.aiFilter?.provider"
                value="ollama"
                inputId="ollama-provider"
                @update:modelValue="handleAiProviderChange" />
              <label for="ollama-provider">Ollama</label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                :modelValue="modelValue?.aiFilter?.provider"
                value="custom"
                inputId="custom-provider"
                @update:modelValue="handleAiProviderChange" />
              <label for="custom-provider">自定义</label>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">AI 模型</label>
          <InputText
            :modelValue="modelValue?.aiFilter?.model"
            @update:modelValue="handleAiModelChange"
            :placeholder="modelValue?.aiFilter?.provider === 'openai' ? '例如: gpt-4, gpt-3.5-turbo' : '例如: qwen2.5:7b, llama3.2:3b'"
            class="w-full" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">过滤提示词</label>
          <Textarea
            :modelValue="modelValue?.aiFilter?.prompt"
            @update:modelValue="handleAiPromptChange"
            placeholder="请判断以下内容是否值得保留，请从重要性和相关性角度考虑..."
            rows="4"
            class="w-full" />
          <small class="text-gray-500">
            编写用于判断内容是否值得保留的提示词，AI 将根据此提示词对每个数据项进行判断。
            让ai回答 "pass" 则会保留对应的数据项
          </small>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">API 地址</label>
          <InputText
            :modelValue="modelValue?.aiFilter?.apiUrl"
            @update:modelValue="handleAiUrlChange"
            :placeholder="modelValue?.aiFilter?.provider === 'openai' ? 'https://api.openai.com/v1' : '例如: http://localhost:11434'"
            class="w-full" />
          <small v-if="modelValue?.aiFilter?.provider === 'ollama'" class="text-gray-500">
            对于本地的ollama服务，需要配置允许浏览器扩展访问的环境变量：https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-web-origins-to-access-ollama
          </small>
        </div>

        <div v-if="modelValue?.aiFilter?.provider === 'openai'">
          <label class="block text-sm font-medium mb-2">API 密钥</label>
          <InputText
            :modelValue="modelValue?.aiFilter?.apiKey"
            @update:modelValue="handleAiApiKeyChange"
            placeholder="输入 OpenAI API 密钥"
            type="password"
            class="w-full" />
          <small class="text-gray-500">
            您的 API 密钥将安全存储在浏览器扩展中，不会上传到服务器
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilterConfig } from '@/entrypoints/background/service/dbService';
import { InputText, RadioButton, Textarea, ToggleSwitch } from 'primevue'

interface Props {
  modelValue?: FilterConfig;
}

interface Emits {
  (e: 'update:modelValue', value: FilterConfig): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
});

const emit = defineEmits<Emits>();

// 确保配置对象存在
const ensureConfig = (): FilterConfig => {
  const current = props.modelValue;
  if (!current) {
    return {
      enable: false,
      filterType: 'js',
      jsFilter: { code: '' },
      aiFilter: { 
        model: '', 
        prompt: '', 
        apiUrl: 'http://localhost:11434', 
        provider: 'ollama' 
      },
    };
  }

  // 确保所有必需的子属性都存在
  return {
    ...current,
    filterType: current.filterType || 'js',
    jsFilter: current.jsFilter || { code: '' },
    aiFilter: {
      model: current.aiFilter?.model || '',
      prompt: current.aiFilter?.prompt || '',
      apiUrl: current.aiFilter?.apiUrl || (current.aiFilter?.['ollamaUrl' as keyof typeof current.aiFilter] || 'http://localhost:11434'),
      apiKey: current.aiFilter?.apiKey || '',
      provider: current.aiFilter?.provider || 'ollama'
    },
  };
};

// 处理启用/禁用变化
const handleEnableChange = (enabled: boolean) => {
  const config = ensureConfig();
  emit('update:modelValue', { ...config, enable: enabled });
};

// 处理过滤类型变化
const handleFilterTypeChange = (filterType: 'js' | 'ai') => {
  const config = ensureConfig();
  emit('update:modelValue', { ...config, filterType });
};

// 处理 JS 代码变化
const handleJsCodeChange = (code: string | undefined) => {
  const config = ensureConfig();
  emit('update:modelValue', {
    ...config,
    jsFilter: { ...config.jsFilter, code: code || '' },
  });
};

// 处理 AI 服务提供商变化
const handleAiProviderChange = (provider: 'openai' | 'ollama' | 'custom' | undefined) => {
  const config = ensureConfig();
  emit('update:modelValue', {
    ...config,
    aiFilter: {
      model: config.aiFilter?.model || '',
      prompt: config.aiFilter?.prompt || '',
      apiUrl: provider === 'openai' ? 'https://api.openai.com/v1' : config.aiFilter?.apiUrl || 'http://localhost:11434',
      apiKey: config.aiFilter?.apiKey || '',
      provider: provider || 'ollama'
    },
  });
};

// 处理 AI 模型变化
const handleAiModelChange = (model: string | undefined) => {
  const config = ensureConfig();
  emit('update:modelValue', {
    ...config,
    aiFilter: {
      model: model || '',
      prompt: config.aiFilter?.prompt || '',
      apiUrl: config.aiFilter?.apiUrl || 'http://localhost:11434',
      apiKey: config.aiFilter?.apiKey || '',
      provider: config.aiFilter?.provider || 'ollama'
    },
  });
};

// 处理 AI 提示词变化
const handleAiPromptChange = (prompt: string | undefined) => {
  const config = ensureConfig();
  emit('update:modelValue', {
    ...config,
    aiFilter: {
      model: config.aiFilter?.model || '',
      prompt: prompt || '',
      apiUrl: config.aiFilter?.apiUrl || 'http://localhost:11434',
      apiKey: config.aiFilter?.apiKey || '',
      provider: config.aiFilter?.provider || 'ollama'
    },
  });
};

// 处理 AI URL 变化
const handleAiUrlChange = (url: string | undefined) => {
  const config = ensureConfig();
  emit('update:modelValue', {
    ...config,
    aiFilter: {
      model: config.aiFilter?.model || '',
      prompt: config.aiFilter?.prompt || '',
      apiUrl: url || 'http://localhost:11434',
      apiKey: config.aiFilter?.apiKey || '',
      provider: config.aiFilter?.provider || 'ollama'
    },
  });
};

// 处理 AI API 密钥变化
const handleAiApiKeyChange = (apiKey: string | undefined) => {
  const config = ensureConfig();
  emit('update:modelValue', {
    ...config,
    aiFilter: {
      model: config.aiFilter?.model || '',
      prompt: config.aiFilter?.prompt || '',
      apiUrl: config.aiFilter?.apiUrl || 'http://localhost:11434',
      apiKey: apiKey || '',
      provider: config.aiFilter?.provider || 'ollama'
    },
  });
};
</script>