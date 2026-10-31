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
          <div class="flex items-center gap-2">
            <Tag v-if="methods?.passwordLoginDisabled" :value="t('已禁用')" severity="warn" />
            <Tag v-else-if="methods?.emailLogin" :value="t('可用')" severity="success" />
            <Tag v-else :value="t('不可用')" severity="secondary" />
            <Button
              v-if="methods?.emailLogin"
              :label="methods.passwordLoginDisabled ? t('恢复') : t('禁用')"
              size="small"
              :variant="methods.passwordLoginDisabled ? 'secondary' : 'danger'"
              @click="openPwdSwitchDialog(!methods.passwordLoginDisabled)"
            />
          </div>
        </div>

        <p v-if="methods?.passwordLoginDisabled" class="text-xs text-amber-600 dark:text-amber-400">
          {{ t('已禁用账号密码登录，只能通过上方绑定的第三方渠道登录（类似可信设备授权）') }}
        </p>

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
            variant="danger"
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
              '如果你有多个账号（例如某个渠道已被另一个账号占用），可验证那个账号的凭据，把它的全部数据（内容、代币、订单、第三方绑定等）并入当前账号。被合并账号将被删除，操作不可撤销。',
            )
          }}
        </p>
        <Button
          :label="t('合并其他账号到当前账号')"
          severity="danger"
          icon="pi pi-objects-column"
          class="w-full"
          @click="mergeDialogVisible = true"
        />
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
      :create="() => API.accountApi.createWechatBind()"
      :check="(ticket: string) => AppAPI.passcodeApi.checkWechatBind(ticket)"
      @success="onBindResult"
    />

    <!-- 账号合并弹窗：先验证目标账号身份，再执行合并 -->
    <div
      v-if="mergeDialogVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="mergeDialogVisible = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white dark:bg-primary-950 shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold">{{ t('验证被合并账号') }}</h3>
          <Button icon="pi pi-times" variant="text" rounded @click="mergeDialogVisible = false" />
        </div>
        <p class="text-sm text-primary-500">
          {{ t('用要被合并账号的任意一种登录方式验证身份，验证通过后该账号数据将全部并入当前账号，且不可撤销。') }}
        </p>
        <!-- 渠道验证（与登录页同款渠道） -->
        <div class="flex flex-col gap-2">
          <Button
            v-if="providers.includes('github')"
            :label="t('用 GitHub 验证')"
            icon="pi pi-github"
            variant="secondary"
            class="w-full"
            @click="mergeVerifyOAuth('github')"
          />
          <Button
            v-if="providers.includes('linuxdo')"
            :label="t('用 LINUX DO 验证')"
            icon="pi pi-globe"
            variant="secondary"
            class="w-full"
            @click="mergeVerifyOAuth('linuxdo')"
          />
          <Button
            v-if="providers.includes('wechat')"
            :label="t('用微信口令验证')"
            icon="pi pi-comments"
            variant="secondary"
            class="w-full"
            @click="mergeWechatVisible = true"
          />
        </div>
        <div class="flex items-center gap-3">
          <div class="h-px flex-1 bg-primary-200 dark:bg-primary-700"></div>
          <span class="text-xs text-primary-400">{{ t('或用账号密码') }}</span>
          <div class="h-px flex-1 bg-primary-200 dark:bg-primary-700"></div>
        </div>
        <AuthCard mode="verify" :submit-label="t('验证并合并')" @verified="onVerifiedForMerge" />
      </div>
    </div>

    <!-- 密码登录开关确认弹窗 -->
    <div
      v-if="pwdSwitchVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="pwdSwitchVisible = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-primary-950 shadow-2xl p-6 space-y-4">
        <h3 class="text-lg font-bold">
          {{ pwdSwitchTarget ? t('禁用账号密码登录') : t('恢复账号密码登录') }}
        </h3>
        <p class="text-sm text-primary-500">
          {{
            pwdSwitchTarget
              ? t('禁用后只能通过第三方渠道登录（类似可信设备授权）。恢复时需要验证当前密码。')
              : t('恢复后将可重新使用邮箱密码登录。')
          }}
        </p>
        <Input v-model="pwdSwitchPassword" :placeholder="t('请输入当前密码确认')" @keyup.enter="submitPwdSwitch" />
        <div class="flex gap-2">
          <Button :label="t('取消')" variant="secondary" class="flex-1" @click="pwdSwitchVisible = false" />
          <Button
            :label="t('确认')"
            :variant="pwdSwitchTarget ? 'danger' : 'primary'"
            class="flex-1"
            :loading="pwdSwitchLoading"
            :disabled="!pwdSwitchPassword"
            @click="submitPwdSwitch"
          />
        </div>
      </div>
    </div>

    <!-- 微信合并验证口令弹窗 -->
    <WechatPasscodeDialog
      v-model:visible="mergeWechatVisible"
      :title="t('微信合并验证')"
      :waiting-text="t('验证通过后将确认该微信归属的账号...')"
      :create="() => AppAPI.passcodeApi.createWechatMergeVerify()"
      :check="(ticket: string) => AppAPI.passcodeApi.checkWechatMergeVerify(ticket)"
      @success="onWechatMergeVerified"
    />
  </div>
</template>

<script setup lang="ts">
import { useAPI } from '@/api';
import WechatPasscodeDialog from '@/components/common/WechatPasscodeDialog.vue';
import AuthCard, { type AuthCardVerifiedPayload } from '@/components/common/AuthCard.vue';
import { routeMap, routerUtil } from '@/router';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { getErrorMessage } from '@/utils/error';
import { computed, onMounted, ref } from 'vue';

const { t } = useI18n();
const { API, AppAPI } = useAPI();
const toast = useToast();

/** 登录方式总览（null=加载中） */
const methods = ref<Awaited<ReturnType<typeof API.accountApi.myLoginMethods>> | null>(null);

/** 是否配置了微信公众号（决定是否显示绑定微信按钮） */
const wechatConfigured = ref(false);

/** 已配置的 OAuth 提供者列表（github/linuxdo） */
const providers = ref<string[]>([]);

/** 绑定弹窗 */
const bindDialogVisible = ref(false);

/** 解绑中的 provider */
const unbinding = ref<string | null>(null);

/** 合并弹窗 */
const mergeDialogVisible = ref(false);

/** 微信合并验证弹窗 */
const mergeWechatVisible = ref(false);

/** 合并表单 */
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
    methods.value = await API.accountApi.myLoginMethods();
  } catch (error: unknown) {
    toast.error(t('加载失败'), getErrorMessage(error));
  }
}

/** 解绑 */
async function unbind(provider: 'GITHUB' | 'LINUXDO' | 'WECHAT') {
  unbinding.value = provider;
  try {
    await API.accountApi.unbind(provider);
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

/** 被合并账号验证通过（账号密码方式）：凭据传给后端执行合并，成功后刷新登录方式列表 */
async function onVerifiedForMerge(payload: AuthCardVerifiedPayload) {
  merging.value = true;
  try {
    await API.accountApi.mergeIntoAccount(payload.email, payload.password);
    toast.success(t('合并成功'), t('该账号数据已并入当前账号'));
    await refreshMethods();
  } catch (error: unknown) {
    toast.error(t('合并失败'), getErrorMessage(error));
  } finally {
    merging.value = false;
    mergeDialogVisible.value = false;
  }
}

/** 发起 OAuth 合并验证（跳转授权页，state 标记 merge 意图，回调只验身份不改数据） */
async function mergeVerifyOAuth(provider: 'github' | 'linuxdo') {
  try {
    const url =
      provider === 'github'
        ? await AppAPI.githubApi.getMergeAuthorizationUrl()
        : await AppAPI.linuxdoApi.getMergeAuthorizationUrl();
    location.href = url;
  } catch (error: unknown) {
    toast.error(t('发起失败'), getErrorMessage(error));
  }
}

/** 微信合并验证通过：用一次性票据执行合并 */
async function onWechatMergeVerified(result: { status: string; mergeTicket?: string }) {
  if (result.status !== 'VERIFIED' || !result.mergeTicket) return;
  await doMergeByTicket(result.mergeTicket);
}

/** 凭渠道验证票据执行合并（票据由服务端在渠道验证通过后签发，一次性） */
async function doMergeByTicket(mergeTicket: string) {
  merging.value = true;
  try {
    await API.accountApi.mergeByMergeTicket(mergeTicket);
    toast.success(t('合并成功'), t('该账号数据已并入当前账号'));
    await refreshMethods();
  } catch (error: unknown) {
    toast.error(t('合并失败'), getErrorMessage(error));
  } finally {
    merging.value = false;
    mergeDialogVisible.value = false;
  }
}

/** 页面加载时消费 OAuth 回调带回的合并验证票据 */
function consumeMergeVerifyFromSession() {
  const raw = sessionStorage.getItem('mergeVerify');
  if (!raw) return;
  sessionStorage.removeItem('mergeVerify');
  try {
    const { mergeTicket } = JSON.parse(raw) as { mergeTicket: string };
    mergeDialogVisible.value = true;
    doMergeByTicket(mergeTicket);
  } catch {
    /** 解析失败忽略，不影响页面 */
  }
}

/** 发起 OAuth 绑定（跳转授权页，state 由后端标记绑定意图）。
 * 渠道被其他账号占用报错时，引导走「合并其他账号」流程把对方数据并过来 */
async function bindOAuth(provider: 'github' | 'linuxdo') {
  try {
    const url = await API.accountApi.getBindAuthorizationUrl(provider);
    location.href = url;
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (msg.includes('已绑定其他账号')) {
      toast.warn(t('渠道被占用'), `${msg}，可在下方「合并其他账号到当前账号」把该账号数据并入后再绑定`);
      mergeDialogVisible.value = true;
    } else {
      toast.error(t('发起失败'), msg);
    }
  }
}

/** 禁用/恢复密码登录弹窗 */
const pwdSwitchVisible = ref(false);

/** 目标开关状态 */
const pwdSwitchTarget = ref(false);

/** 密码确认输入 */
const pwdSwitchPassword = ref('');

/** 开关提交中 */
const pwdSwitchLoading = ref(false);

/** 打开确认弹窗 */
function openPwdSwitchDialog(disabled: boolean) {
  pwdSwitchTarget.value = disabled;
  pwdSwitchPassword.value = '';
  pwdSwitchVisible.value = true;
}

/** 提交开关 */
async function submitPwdSwitch() {
  pwdSwitchLoading.value = true;
  try {
    await API.accountApi.setPasswordLoginDisabled(pwdSwitchTarget.value, pwdSwitchPassword.value);
    toast.success(
      pwdSwitchTarget.value ? t('已禁用密码登录') : t('已恢复密码登录'),
      pwdSwitchTarget.value ? t('此后仅可通过第三方渠道登录') : t('现在可使用账号密码登录'),
    );
    pwdSwitchVisible.value = false;
    await refreshMethods();
  } catch (error: unknown) {
    toast.error(t('操作失败'), getErrorMessage(error));
  } finally {
    pwdSwitchLoading.value = false;
  }
}

onMounted(async () => {
  consumeMergeVerifyFromSession();
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
