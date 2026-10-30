<template>
  <div class="min-h-screen bg-primary-50 dark:bg-primary-950 py-10 px-4">
    <div class="max-w-2xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold">{{ t('账号设置') }}</h1>

      <!-- 登录方式管理 -->
      <Card class="p-6 space-y-4">
        <h2 class="text-lg font-semibold">{{ t('登录方式') }}</h2>

        <!-- 邮箱密码 -->
        <div class="flex items-center justify-between gap-2 py-2 border-b border-primary-100 dark:border-primary-800">
          <div>
            <p class="font-medium">{{ t('邮箱密码') }}</p>
            <p class="text-sm text-primary-500">
              {{ methods?.emailLogin ? methods.email : t('未设置（第三方登录创建的账号）') }}
            </p>
          </div>
          <Tag v-if="methods?.emailLogin" :value="t('可用')" severity="success" />
          <Tag v-else :value="t('不可用')" severity="secondary" />
        </div>

        <!-- 第三方绑定列表 -->
        <div
          v-for="binding in methods?.bindings ?? []"
          :key="binding.provider"
          class="flex items-center justify-between gap-2 py-2 border-b border-primary-100 dark:border-primary-800"
        >
          <div>
            <p class="font-medium">{{ providerLabel(binding.provider) }}</p>
            <p class="text-sm text-primary-500">{{ binding.maskedId }}</p>
          </div>
          <Button
            :label="t('解绑')"
            severity="danger"
            size="small"
            variant="outlined"
            :loading="unbinding === binding.provider"
            @click="unbind(binding.provider)"
          />
        </div>

        <!-- 绑定入口（未绑定的可用渠道） -->
        <div class="flex flex-col gap-2">
          <Button
            v-if="providers.includes('github') && !hasBinding('GITHUB')"
            :label="t('绑定 GitHub')"
            icon="pi pi-github"
            variant="secondary"
            class="w-full"
            @click="bindOAuth('github')"
          />
          <Button
            v-if="providers.includes('linuxdo') && !hasBinding('LINUXDO')"
            :label="t('绑定 LINUX DO')"
            icon="pi pi-globe"
            variant="secondary"
            class="w-full"
            @click="bindOAuth('linuxdo')"
          />
          <Button
            v-if="wechatConfigured && !hasWechatBinding"
            :label="t('绑定微信')"
            icon="pi pi-comments"
            variant="secondary"
            class="w-full"
            @click="bindDialogVisible = true"
          />
        </div>
        <p v-if="!methods" class="text-sm text-primary-400">{{ t('加载中...') }}</p>
      </Card>

      <!-- 账号合并 -->
      <Card class="p-6 space-y-4">
        <h2 class="text-lg font-semibold">{{ t('账号合并') }}</h2>
        <p class="text-sm text-primary-500">
          {{
            t(
              '如果之前用不同方式注册了多个账号，可把当前账号的全部数据（内容、代币、订单等）并入另一个账号。合并后当前账号将被删除，操作不可撤销。',
            )
          }}
        </p>
        <div class="space-y-3">
          <InputText v-model="mergeForm.email" :placeholder="t('目标账号邮箱')" class="w-full" />
          <Password
            v-model="mergeForm.password"
            :placeholder="t('目标账号密码')"
            :feedback="false"
            class="w-full"
            fluid
          />
          <Button
            :label="t('合并并入目标账号')"
            severity="danger"
            icon="pi pi-objects-column"
            :loading="merging"
            :disabled="!mergeForm.email || !mergeForm.password"
            class="w-full"
            @click="merge"
          />
        </div>
      </Card>

      <div class="text-center">
        <Button :label="t('返回首页')" variant="secondary" text @click="routerUtil.push(routeMap.index, {})" />
      </div>
    </div>

    <!-- 微信绑定口令弹窗（复用登录同款组件） -->
    <WechatPasscodeDialog
      v-model:visible="bindDialogVisible"
      :title="t('绑定微信')"
      :waiting-text="t('验证成功后将自动完成绑定...')"
      :create="() => AppAPI.passcodeApi.createWechatBind()"
      :check="(ticket: string) => AppAPI.passcodeApi.checkWechatBind(ticket)"
      @success="onBindResult"
    />
  </div>
</template>

<script setup lang="ts">
import { useAPI } from '@/api';
import WechatPasscodeDialog from '@/components/common/WechatPasscodeDialog.vue';
import { loginGoto } from '@/pages/loginUtil';
import { routeMap, routerUtil } from '@/router';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { getErrorMessage } from '@/utils/error';
import { computed, onMounted, ref } from 'vue';

const { t } = useI18n();
const { AppAPI } = useAPI();
const toast = useToast();

/** 登录方式总览（null=加载中） */
const methods = ref<Awaited<ReturnType<typeof AppAPI.passcodeApi.myLoginMethods>> | null>(null);

/** 是否配置了微信公众号（决定是否显示绑定微信按钮） */
const wechatConfigured = ref(false);

/** 已配置的 OAuth 提供者列表（github/linuxdo） */
const providers = ref<string[]>([]);

/** 绑定弹窗 */
const bindDialogVisible = ref(false);

/** 解绑中的 provider */
const unbinding = ref<string | null>(null);

/** 合并表单 */
const mergeForm = ref({ email: '', password: '' });
const merging = ref(false);

/** 是否已绑定微信 */
const hasWechatBinding = computed(() => methods.value?.bindings.some((b) => b.provider === 'WECHAT') ?? false);

/** 是否已绑定某渠道 */
function hasBinding(provider: 'GITHUB' | 'LINUXDO' | 'WECHAT') {
  return methods.value?.bindings.some((b) => b.provider === provider) ?? false;
}

/** provider 显示名 */
function providerLabel(provider: string) {
  const map: Record<string, string> = { GITHUB: 'GitHub', LINUXDO: 'LINUX DO', WECHAT: t('微信') };
  return map[provider] ?? provider;
}

/** 刷新登录方式总览 */
async function refreshMethods() {
  try {
    methods.value = await AppAPI.passcodeApi.myLoginMethods();
  } catch (error: unknown) {
    toast.error(t('加载失败'), getErrorMessage(error));
  }
}

/** 解绑 */
async function unbind(provider: 'GITHUB' | 'LINUXDO' | 'WECHAT') {
  unbinding.value = provider;
  try {
    await AppAPI.passcodeApi.unbind(provider);
    toast.success(t('解绑成功'), t('已解除绑定'));
    await refreshMethods();
  } catch (error: unknown) {
    toast.error(t('解绑失败'), getErrorMessage(error));
  } finally {
    unbinding.value = null;
  }
}

/** 绑定弹窗终态回调 */
function onBindResult(result: { status: string }) {
  if (result.status === 'BOUND') {
    toast.success(t('绑定成功'), t('微信已绑定到当前账号'));
    refreshMethods();
  } else if (result.status === 'EXPIRED') {
    toast.error(t('绑定失败'), t('口令已过期，请重新发起'));
  }
}

/** 合并入目标账号：成功后直接切换到目标账号登录态 */
async function merge() {
  merging.value = true;
  try {
    const res = await AppAPI.passcodeApi.mergeIntoAccount(mergeForm.value.email, mergeForm.value.password);
    loginGoto(res.login, {});
    toast.success(t('合并成功'), t('已并入目标账号，正在跳转...'));
  } catch (error: unknown) {
    toast.error(t('合并失败'), getErrorMessage(error));
  } finally {
    merging.value = false;
  }
}

/** 发起 OAuth 绑定（跳转授权页，state 由后端标记绑定意图） */
async function bindOAuth(provider: 'github' | 'linuxdo') {
  try {
    const url =
      provider === 'github'
        ? await AppAPI.githubApi.getBindAuthorizationUrl()
        : await AppAPI.linuxdoApi.getBindAuthorizationUrl();
    location.href = url;
  } catch (error: unknown) {
    toast.error(t('发起失败'), getErrorMessage(error));
  }
}

onMounted(async () => {
  await refreshMethods();
  try {
    const list = await AppAPI.oauthProviders();
    wechatConfigured.value = list.includes('wechat');
    providers.value = list;
  } catch {
    wechatConfigured.value = false;
    providers.value = [];
  }
});
</script>
