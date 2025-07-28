<template>
  <div class="flex flex-col gap-4 p-4">
    <h3 class="text-lg font-medium">{{ $t('AI 配置') }}</h3>

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
