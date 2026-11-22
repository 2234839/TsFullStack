<!-- ABOUTME: 通用登录表单 — 从登录页抽出的完整登录能力（账密/记住我/GitHub/LinuxDo OAuth/微信口令），
     登录页与 LoginOverlay 浮层共用；stayOnSuccess 时登录成功只写会话不导航，调用方继续被打断的操作 -->
<template>
  <div class="space-y-5">
    <form class="space-y-4" @submit.prevent="handlePwdSubmit">
      <!-- 用户名/密码 -->
      <div>
        <label for="loginform-username" class="mb-1 block text-sm font-medium text-primary-700 dark:text-primary-200">
          <i class="pi pi-user text-primary-500" />{{ t('用户名') }}
        </label>
        <Input id="loginform-username" v-model="form.username" type="text" required :placeholder="t('请输入用户名')" />
      </div>
      <div>
        <label for="loginform-password" class="mb-1 block text-sm font-medium text-primary-700 dark:text-primary-200">
          <i class="pi pi-lock text-primary-500" />{{ t('密码') }}
        </label>
        <Password
          id="loginform-password"
          v-model="form.password"
          required
          :feedback="false"
          :placeholder="t('请输入密码')"
        />
      </div>

      <!-- 记住我 -->
      <div class="flex items-center">
        <Checkbox v-model="rememberMe" />
        <label for="loginform-remember" class="ml-2 block text-sm text-primary-700 dark:text-primary-200">
          {{ t('记住我') }}
        </label>
      </div>

      <!-- 已登录态提示 -->
      <Button
        v-if="authInfo_isLogin"
        :label="t('已处于登录状态, 点击跳转首页')"
        icon="pi pi-home"
        variant="secondary"
        class="w-full"
        @click="routerUtil.push(routeMap.index, {})"
      />

      <!-- 账密登录提交 -->
      <Button
        type="submit"
        class="w-full"
        :loading="loading"
        icon="pi pi-sign-in"
        :disabled="!isFormValid || loading"
        :label="t('登录')"
      />
    </form>

    <!-- OAuth 登录（整页跳转到提供方，stayOnSuccess 场景请配合草稿持久化） -->
    <div v-if="configuredProviders.length > 0" class="flex items-center justify-between gap-2">
      <Button
        v-if="configuredProviders.includes('github')"
        :label="t('GitHub 登录')"
        icon="pi pi-github"
        :loading="oauthLogin.isLoading.value"
        variant="secondary"
        class="flex-1"
        @click="oauthLogin.execute(0, 'github')"
      />
      <Button
        v-if="configuredProviders.includes('linuxdo')"
        :label="t('LINUX DO 登录')"
        icon="pi pi-globe"
        :loading="oauthLogin.isLoading.value"
        variant="secondary"
        class="flex-1"
        @click="oauthLogin.execute(0, 'linuxdo')"
      />
    </div>

    <!-- 微信口令登录（浮层内轮询完成，不导航） -->
    <Button
      v-if="configuredProviders.includes('wechat')"
      :label="t('微信口令登录')"
      icon="pi pi-comments"
      variant="secondary"
      class="w-full"
      @click="passcodeVisible = true"
    />

    <!-- 微信口令弹层（组件内轮询，终态回调 success） -->
    <WechatPasscodeDialog
      v-model:visible="passcodeVisible"
      :title="t('微信口令登录')"
      :waiting-text="t('验证成功后将自动登录...')"
      :create="() => AppAPI.passcodeApi.createWechatLogin()"
      :check="(ticket: string) => AppAPI.passcodeApi.checkWechatLogin(ticket)"
      @success="onPasscodeResult"
    />
  </div>
</template>

<script setup lang="ts">
import { Button, Checkbox, Input, Password } from '@/components/base';
import WechatPasscodeDialog from '@/components/common/WechatPasscodeDialog.vue';
import { loginGoto } from '@/pages/loginUtil';
import { routeMap, routerUtil } from '@/router';
import { authInfo, authInfo_isLogin, localUserPwd } from '@/storage';
import { useAPI } from '@/api';
import { useAsyncState } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { getErrorMessage } from '@/utils/error';
import { computed, onMounted, ref, shallowRef } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 登录成功后的回跳地址（loginGoto 的 r 参数，stayOnSuccess 时忽略） */
    redirectTo?: string;
    /** 登录成功后留在当前页面（只写会话不导航）：浮层嵌入场景，避免整页跳转丢失用户未保存的编辑内容 */
    stayOnSuccess?: boolean;
  }>(),
  { redirectTo: undefined, stayOnSuccess: false },
);

/** 任一登录方式成功（调用方在此继续被登录打断的操作） */
const emit = defineEmits<{ success: [] }>();

const { t } = useI18n();
const toast = useToast();
const { AppAPI } = useAPI();

const loading = shallowRef(false);
const form = ref({ username: '', password: '' });
const rememberMe = ref(localUserPwd.value.rememberMe);
/** 微信口令弹窗可见性 */
const passcodeVisible = ref(false);
/** 已配置的登录提供者（github/linuxdo/wechat） */
const configuredProviders = ref<string[]>([]);

const isFormValid = computed(() => Boolean(form.value.username && form.value.password));

/** 登录成功统一出口：stayOnSuccess 只写会话，否则走 loginGoto 导航 */
function settleLogin(info: Parameters<typeof loginGoto>[0]) {
  if (props.stayOnSuccess) {
    authInfo.value = info;
    toast.success(t('登录成功'), t('欢迎回来'));
  } else {
    loginGoto(info, { r: props.redirectTo });
    toast.success(t('登录成功'), t('欢迎回来，正在为您跳转...'));
  }
  emit('success');
}

/** OAuth：整页跳转到提供方（外部站点授权无法留在浮层内），回调后经 /oauth/:provider 完成登录 */
const oauthLogin = useAsyncState(
  async (provider: 'github' | 'linuxdo') => {
    if (provider === 'github') {
      location.href = await AppAPI.githubApi.getAuthorizationUrl();
    } else if (provider === 'linuxdo') {
      location.href = await AppAPI.linuxdoApi.getAuthorizationUrl();
    } else {
      provider satisfies never;
    }
  },
  undefined,
  { immediate: false },
);

/** 微信口令终态回调：LOGIN 自动登录，EXPIRED 提示重试 */
function onPasscodeResult(result: Awaited<ReturnType<typeof AppAPI.passcodeApi.checkWechatLogin>>) {
  if (result.status === 'LOGIN') {
    settleLogin(result.login);
  } else if (result.status === 'EXPIRED') {
    toast.error(t('登录失败'), t('口令已过期，请重新发起'));
  }
}

/** 账密登录 */
async function handlePwdSubmit() {
  if (!isFormValid.value || loading.value) return;
  loading.value = true;
  try {
    const res = await AppAPI.system.loginByEmailPwd(form.value.username, form.value.password);
    if (rememberMe.value) {
      localUserPwd.value.username = form.value.username;
      localUserPwd.value.rememberMe = true;
    } else {
      localUserPwd.value.rememberMe = false;
    }
    settleLogin(res);
  } catch (error: unknown) {
    toast.error(t('登录失败'), getErrorMessage(error));
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (localUserPwd.value.rememberMe) {
    form.value.username = localUserPwd.value.username;
  }
  try {
    configuredProviders.value = await AppAPI.oauthProviders();
  } catch {
    configuredProviders.value = [];
  }
});
</script>
