<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-primary-950 to-primary-900 text-white">
    <div class="text-center p-8 bg-primary-900/80 rounded-xl shadow-2xl max-w-125 w-[90%]">
      <template v-if="userInfo.error.value">
        <h1 class="text-2xl mb-4 text-danger-400">{{ t('授权失败') }}</h1>
        <p class="text-base mb-6 text-white/80">{{ t('GitHub 授权验证失败，请重试') }}</p>
        <button @click="userInfo.execute()" class="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
          {{ t('重试') }}
        </button>
      </template>
      <template v-else-if="userInfo.isLoading.value">
        <h1 class="text-2xl mb-4 text-primary-400">{{ t('GitHub 授权中...') }}</h1>
        <p class="text-base mb-6 text-white/80">{{ t('正在验证您的 GitHub 账号，请稍候') }}</p>
        <div class="w-12 h-12 rounded-full border-4 border-primary-400/30 border-t-primary-400 animate-spin mx-auto"></div>
      </template>
      <template v-else>
        <h1 class="text-2xl mb-4 text-primary-400">{{ t('授权成功') }}</h1>
        <p>{{ t('授权成功！正在跳转...') }}</p>
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { loginGoto } from '@/pages/loginUtil';
  import { useAsyncState } from '@vueuse/core';
  import { useToast } from '@/composables/useToast';
  import { useI18n } from '@/composables/useI18n';

  const { t } = useI18n();
  const { code, r } = defineProps<{ code?: string; r?: string }>();
  const { AppAPI } = useAPI();
  const toast = useToast();
  const userInfo = useAsyncState(async () => {
    if (!code) return undefined;
    const res = await AppAPI.githubApi.authenticate(code);
    loginGoto(res, { r });
    toast.success(t('登录成功'), t('欢迎回来，正在为您跳转...'));
    return res;
  }, undefined);
</script>
