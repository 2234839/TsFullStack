<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-primary-950 to-primary-900 text-white">
    <div class="text-center p-8 bg-primary-900/80 rounded-xl shadow-2xl max-w-125 w-[90%]">
      <h1 class="text-2xl mb-4 text-primary-400">{{ t('GitHub 授权中...') }}</h1>
      <p class="text-base mb-6 text-white/80">{{ t('正在验证您的 GitHub 账号，请稍候') }}</p>
      <div v-if="userInfo.state.value === undefined" class="w-12 h-12 rounded-full border-4 border-primary-400/30 border-t-primary-400 animate-spin mx-auto"></div>
      <div v-else>
        <p>{{ t('授权成功！正在跳转...') }}</p>
      </div>
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
    toast.add({
      variant: 'success',
      summary: t('登录成功'),
      detail: t('欢迎回来，正在为您跳转...'),
      life: 3000,
    });
    return res;
  }, undefined);
</script>
