<template>
  <div class="space-y-5">
    <!-- 标题区（可选） -->
    <div v-if="title" class="text-center space-y-1">
      <h2
        class="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-success-600 via-info-600 to-info-600 dark:from-success-400 dark:via-info-400 dark:to-info-400"
      >
        {{ title }}
      </h2>
      <p v-if="subtitle" class="mt-2 text-sm text-primary-600 dark:text-primary-300">{{ subtitle }}</p>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- 用户名/邮箱输入框 -->
      <div>
        <label for="authcard-username" class="block text-sm font-medium mb-1 text-primary-700 dark:text-primary-200">
          <i class="pi pi-user mr-2 text-primary-500 dark:text-primary-300" />{{ t('用户名') }}
        </label>
        <Input id="authcard-username" v-model="form.username" type="text" required :placeholder="t('请输入用户名')" />
      </div>

      <!-- 密码输入框 -->
      <div>
        <label for="authcard-password" class="block text-sm font-medium mb-1 text-primary-700 dark:text-primary-200">
          <i class="pi pi-lock mr-2 text-primary-500 dark:text-primary-300" />{{ t('密码') }}
        </label>
        <Password
          id="authcard-password"
          v-model="form.password"
          required
          :feedback="false"
          :placeholder="t('请输入密码')"
        />
      </div>

      <!-- 记住我（仅登录模式） -->
      <div v-if="mode === 'login'" class="flex items-center">
        <Checkbox v-model="rememberMe" />
        <label for="authcard-remember" class="ml-2 block text-sm text-primary-700 dark:text-primary-200">
          {{ t('记住我') }}
        </label>
      </div>

      <!-- 已登录态提示（仅登录模式） -->
      <Button
        v-if="mode === 'login' && authInfo_isLogin"
        :label="t('已处于登录状态, 点击跳转首页')"
        icon="pi pi-home"
        variant="secondary"
        class="w-full"
        @click="routerUtil.push(routeMap.admin, {})"
      />

      <!-- 提交按钮 -->
      <Button
        type="submit"
        class="w-full"
        :loading="loading"
        :icon="mode === 'verify' ? 'pi pi-check-circle' : 'pi pi-sign-in'"
        :disabled="!isFormValid || loading"
        :label="submitLabel"
      />

      <!-- 底部切换注册（仅登录模式且允许时显示） -->
      <div v-if="mode === 'login' && allowRegister" class="text-center text-xs text-primary-500">
        <p>
          {{ t('还没有账号?') }}
          <a href="#" class="hover:underline text-info-600 dark:text-info-400" @click.prevent="emit('goRegister')">
            {{ t('立即注册') }}
          </a>
        </p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { Button, Checkbox, Input, Password } from '@/components/base';
import { routeMap, routerUtil } from '@/router';
import { authInfo_isLogin, localUserPwd } from '@/storage';
import { loginGoto } from '@/pages/loginUtil';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { getErrorMessage } from '@/utils/error';
import { API } from '@/api';
import { computed, ref, shallowRef } from 'vue';

/** 验证成功时回传给使用方的上下文（含原始凭据，供使用方执行后续动作如账号合并） */
export interface AuthCardVerifiedPayload {
  email: string;
  password: string;
  /** 验证通过的用户（脱敏，不含密码） */
  user: Awaited<ReturnType<typeof API.system.verifyByEmailPwd>>['user'];
}

/** 卡片工作模式：login=登录并发会话跳转；verify=仅验证凭据不发会话 */
const props = withDefaults(
  defineProps<{
    mode?: 'login' | 'verify';
    /** 标题（不传则不渲染标题区） */
    title?: string;
    /** 副标题 */
    subtitle?: string;
    /** 提交按钮文案（默认按模式取「登录」/「验证」） */
    submitLabel?: string;
    /** 登录模式是否显示注册入口 */
    allowRegister?: boolean;
    /** 登录成功后的回跳地址（loginGoto 的 r 参数） */
    redirectTo?: string;
  }>(),
  {
    mode: 'login',
    title: undefined,
    subtitle: undefined,
    submitLabel: undefined,
    allowRegister: false,
    redirectTo: undefined,
  },
);

/** verify 模式：验证成功（含凭据回传）；login 模式：登录成功；goRegister：请求切换到注册 */
const emit = defineEmits<{
  verified: [payload: AuthCardVerifiedPayload];
  success: [];
  goRegister: [];
}>();

const { t } = useI18n();
const toast = useToast();

/** 提交中状态 */
const loading = shallowRef(false);

/** 表单 */
const form = ref({ username: '', password: '' });

/** 记住我（登录模式，读写本地存储） */
const rememberMe = ref(localUserPwd.value.rememberMe);

/** 实际提交按钮文案 */
const actualSubmitLabel = computed(() => props.submitLabel ?? (props.mode === 'verify' ? t('验证身份') : t('登录')));

/** 表单校验：用户名密码均非空 */
const isFormValid = computed(() => Boolean(form.value.username && form.value.password));

/** 提交：login 模式走登录流程，verify 模式仅验证凭据 */
async function handleSubmit() {
  if (!isFormValid.value || loading.value) return;
  loading.value = true;
  try {
    if (props.mode === 'verify') {
      const res = await API.system.verifyByEmailPwd(form.value.username, form.value.password);
      emit('verified', { email: form.value.username, password: form.value.password, user: res.user });
      toast.success(t('验证通过'), t('身份确认成功'));
    } else {
      const res = await API.system.loginByEmailPwd(form.value.username, form.value.password);
      if (rememberMe.value) {
        localUserPwd.value.username = form.value.username;
        localUserPwd.value.password = form.value.password;
        localUserPwd.value.rememberMe = true;
      } else {
        localUserPwd.value.rememberMe = false;
      }
      loginGoto(res, { r: props.redirectTo });
      toast.success(t('登录成功'), t('欢迎回来，正在为您跳转...'));
      emit('success');
    }
  } catch (error: unknown) {
    toast.error(props.mode === 'verify' ? t('验证失败') : t('登录失败'), getErrorMessage(error));
  } finally {
    loading.value = false;
  }
}
</script>
