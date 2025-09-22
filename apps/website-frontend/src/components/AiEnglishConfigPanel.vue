<template>
  <div class="flex flex-col gap-4 p-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">{{ $t('AI 配置') }}</h3>
      <Tag severity="info" value="混合模式" />
    </div>

    <!-- 说明信息 -->
    <div class="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
      <p class="mb-2"><strong>混合模式说明：</strong></p>
      <ul class="space-y-1 text-xs">
        <li>• 优先使用您配置的AI服务</li>
        <li>• 当您的配置不可用时，自动切换到后台代理服务</li>
        <li>• 无需配置也可直接使用后台提供的AI服务</li>
        <li>• 支持多个AI提供商的负载均衡</li>
      </ul>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">{{ $t('Base URL') }}</label>
        <InputText
          v-model="config.baseURL"
          placeholder="https://api.openai.com/v1"
          class="w-full" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">{{ $t('API Key') }}</label>
        <Password
          v-model="config.apiKey"
          placeholder="sk-..."
          :feedback="false"
          toggleMask
          class="w-full" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">{{ $t('模型') }}</label>
        <InputText v-model="config.model" placeholder="gpt-3.5-turbo" class="w-full" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">{{ $t('最大Token数') }}</label>
        <InputNumber v-model="config.maxTokens" :min="100" :max="4000" :step="100" class="w-full" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">{{ $t('温度参数') }}</label>
        <InputNumber
          v-model="config.temperature"
          :min="0"
          :max="2"
          :step="0.1"
          :maxFractionDigits="2"
          class="w-full" />
      </div>
    </div>

    <div class="flex gap-2 justify-end">
      <Button :label="$t('重置')" severity="secondary" @click="resetConfig" />
      <Button :label="$t('保存')" @click="saveConfig" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useOpenAIConfig } from '@/storage';
  import Button from 'primevue/button';
  import InputNumber from 'primevue/inputnumber';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Tag from 'primevue/tag';
  import { reactive, watch } from 'vue';

  const emit = defineEmits<{
    save: [];
    cancel: [];
  }>();
  const openAIConfig = useOpenAIConfig();
  const config = reactive({
    baseURL: openAIConfig.value.baseURL,
    apiKey: openAIConfig.value.apiKey,
    model: openAIConfig.value.model,
    maxTokens: openAIConfig.value.maxTokens,
    temperature: openAIConfig.value.temperature,
  });

  const saveConfig = () => {
    openAIConfig.value = { ...config };
    emit('save');
  };

  const resetConfig = () => {
    Object.assign(config, {
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      maxTokens: 2000,
      temperature: 0.7,
    });
    openAIConfig.value = { ...config };
  };

  watch(
    () => openAIConfig.value,
    (newConfig) => {
      Object.assign(config, newConfig);
    },
    { deep: true },
  );
</script>
