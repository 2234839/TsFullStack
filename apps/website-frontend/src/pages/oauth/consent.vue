<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-primary-950 to-primary-900 text-white"
  >
    <div class="text-center p-8 bg-primary-900/80 rounded-xl shadow-2xl max-w-125 w-[90%]">
      <template v-if="!params.clientId || !params.redirectUri">
        <h1 class="text-2xl mb-4 text-danger-400">{{ t('请求无效') }}</h1>
        <p class="text-base text-white/80">{{ t('授权链接缺少必要参数') }}</p>
      </template>
      <template v-else-if="!authInfo_isLogin">
        <h1 class="text-2xl mb-4 text-primary-400">{{ t('请先登录') }}</h1>
        <p class="text-base mb-6 text-white/80">{{ t('登录后即可继续授权') }}</p>
        <button
          @click="gotoLogin({ r: currentUrl })"
          class="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          {{ t('去登录') }}
        </button>
      </template>
      <template v-else-if="describe.error.value">
        <h1 class="text-2xl mb-4 text-danger-400">{{ t('应用无效') }}</h1>
        <p class="text-base text-white/80">{{ getErrorMessage(describe.error.value) }}</p>
      </template>
      <template v-else-if="describe.isLoading.value || !describe.state.value">
        <h1 class="text-2xl mb-4 text-primary-400">{{ t('加载中...') }}</h1>
        <div
          class="w-12 h-12 rounded-full border-4 border-primary-400/30 border-t-primary-400 animate-spin mx-auto"
        ></div>
      </template>
      <template v-else>
        <h1 class="text-2xl mb-2">{{ t('授权确认') }}</h1>
        <p class="text-base mb-1 text-white/90">
          {{ t('应用') }} <span class="font-bold text-primary-300">{{ describe.state.value.name }}</span>
          {{ t('请求访问你的账号信息') }}
        </p>
        <p class="text-sm mb-4 text-white/60">{{ t('授权范围') }}：{{ scopeLabel }}</p>
        <div class="flex gap-3 justify-center">
          <button
            :disabled="approving"
            @click="onApprove"
            class="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {{ approving ? t('处理中...') : t('同意授权') }}
          </button>
          <button @click="onDeny" class="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            {{ t('拒绝') }}
          </button>
        </div>
        <p v-if="approveError" class="mt-4 text-sm text-danger-400">{{ approveError }}</p>
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useAPI } from '@/api';
import { authInfo_isLogin } from '@/storage';
import { gotoLogin } from '@/pages/loginUtil';
import { getErrorMessage } from '@/utils/error';
import { useAsyncState } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { computed, ref } from 'vue';

const { t } = useI18n();
const { AppAPI } = useAPI();

/** 授权请求参数：来自接入方拼的 authorize 跳转 URL（标准 OAuth2 query 参数） */
const params = (() => {
  const q = new URLSearchParams(location.search);
  return {
    clientId: q.get('client_id') ?? '',
    redirectUri: q.get('redirect_uri') ?? '',
    state: q.get('state') ?? '',
    scope: q.get('scope') ?? '',
    codeChallenge: q.get('code_challenge') ?? '',
    codeChallengeMethod: q.get('code_challenge_method') ?? '',
  };
})();

/** 当前授权页地址（登录后回跳用，只取站内相对路径部分） */
const currentUrl = computed(() => location.pathname + location.search);

/** 应用展示信息（名称/首页） */
const describe = useAsyncState(async () => {
  if (!params.clientId) return null;
  return AppAPI.openPlatformApi.describeClient(params.clientId);
}, undefined);

/** scope 展示文案（本期只有 profile） */
const scopeLabel = computed(() =>
  params.scope.includes('profile') || !params.scope ? t('昵称、头像等基础信息') : params.scope,
);

/** 确认授权：签发授权码后浏览器重定向回接入方回调地址 */
const approving = ref(false);
const approveError = ref('');
async function onApprove() {
  approving.value = true;
  approveError.value = '';
  try {
    const res = await AppAPI.openPlatformApi.approve({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      state: params.state,
      scope: params.scope,
      codeChallenge: params.codeChallenge || undefined,
      codeChallengeMethod: params.codeChallengeMethod || undefined,
    });
    location.href = res.redirectUrl;
  } catch (e) {
    approveError.value = e instanceof Error ? e.message : t('授权失败，请重试');
  } finally {
    approving.value = false;
  }
}

/** 拒绝授权：直接回退，不打扰接入方 */
function onDeny() {
  history.back();
}
</script>
