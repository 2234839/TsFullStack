<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-primary-950 to-primary-900 text-white"
  >
    <div class="text-center p-8 bg-primary-900/80 rounded-xl shadow-2xl max-w-125 w-[90%]">
      <template v-if="userInfo.error.value">
        <h1 class="text-2xl mb-4 text-danger-400">{{ t('授权失败') }}</h1>
        <p class="text-base mb-6 text-white/80">{{ t('LINUX DO 授权验证失败，请重试') }}</p>
        <button
          @click="userInfo.execute()"
          class="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          {{ t('重试') }}
        </button>
      </template>
      <template v-else-if="userInfo.isLoading.value">
        <h1 class="text-2xl mb-4 text-primary-400">{{ t('LINUX DO 授权中...') }}</h1>
        <p class="text-base mb-6 text-white/80">{{ t('正在验证您的 LINUX DO 账号，请稍候') }}</p>
        <div
          class="w-12 h-12 rounded-full border-4 border-primary-400/30 border-t-primary-400 animate-spin mx-auto"
        ></div>
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
import { routeMap, routerUtil } from '@/router';
import { useAsyncState } from '@vueuse/core';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { code, state, r } = defineProps<{ code?: string; state?: string; r?: string }>();
const { AppAPI } = useAPI();
const toast = useToast();
const userInfo = useAsyncState(async () => {
  if (!code) return undefined;
  const res = await AppAPI.linuxdoApi.authenticate(code, state);
  /** 合并验证流程：存验证结果后回账号设置页继续合并 */
  if ('mergeVerified' in res && res.mergeVerified) {
    sessionStorage.setItem('mergeVerify', JSON.stringify({ mergeTicket: res.mergeTicket }));
    toast.success(t('身份验证通过'), t('已确认该渠道归属的账号，即将继续合并'));
    routerUtil.push(routeMap.account, {});
    return undefined;
  }
  if (res.bound) {
    /** 绑定流程：不登录跳转，回账号设置页刷新绑定列表 */
    toast.success(t('绑定成功'), t('LINUX DO 已绑定到当前账号'));
    routerUtil.push(routeMap.account, {});
    return undefined;
  }
  loginGoto('token' in res && res.token ? res : undefined, { r });
  toast.success(t('登录成功'), t('欢迎回来，正在为您跳转...'));
  return res;
}, undefined);
</script>
