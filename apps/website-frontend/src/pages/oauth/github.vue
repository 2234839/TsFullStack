<style scoped>
  .github-auth-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: linear-gradient(135deg, #1e1e2f, #2a2a3a);
    color: #ffffff;
    font-family: 'Arial', sans-serif;
  }
  .github-auth-content {
    text-align: center;
    padding: 2rem;
    background: rgba(30, 30, 47, 0.8);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
  }
  .github-auth-title {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #58a6ff;
  }
  .github-auth-message {
    font-size: 1rem;
    margin-bottom: 1.5rem;
    opacity: 0.8;
  }
  .github-auth-loader {
    display: inline-block;
    width: 50px;
    height: 50px;
    border: 5px solid rgba(88, 166, 255, 0.3);
    border-radius: 50%;
    border-top-color: #58a6ff;
    animation: spin 1s ease-in-out infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
<template>
  <div class="github-auth-container">
    <div class="github-auth-content">
      <h1 class="github-auth-title">GitHub 授权中...</h1>
      <p class="github-auth-message">正在验证您的 GitHub 账号，请稍候</p>
      <div v-if="userInfo.state.value === undefined" class="github-auth-loader"></div>
      <div v-else>
        <p>授权成功！正在跳转...</p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { loginGoto } from '@/pages/loginUtil';
  import { useAsyncState } from '@vueuse/core';
  import { useToast } from '@/composables/useToast';

  const props = defineProps({
    code: String,
    r: String,
  });
  const { AppAPI } = useAPI();
  const toast = useToast();
  const userInfo = useAsyncState(async () => {
    if (!props.code) return undefined;
    const res = await AppAPI.githubApi.authenticate(props.code);
    console.log('[res]', res);
    loginGoto(res, { r: props.r });
    toast.add({
      severity: 'success',
      summary: '登录成功',
      detail: '欢迎回来，正在为您跳转...',
      life: 3000,
    });
    return res;
  }, undefined);
</script>
