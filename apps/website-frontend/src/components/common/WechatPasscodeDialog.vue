<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    @click.self="close"
  >
    <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-primary-950 shadow-2xl p-6 space-y-4">
      <div class="text-center space-y-1">
        <h3 class="text-lg font-bold">{{ title }}</h3>
        <p class="text-sm text-primary-500">{{ t('关注公众号并回复口令，即可完成验证') }}</p>
      </div>
      <!-- 口令展示 -->
      <div class="text-center">
        <div
          class="text-4xl font-extrabold tracking-[0.4em] tabular-nums py-3 rounded-xl bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
        >
          {{ state.code }}
        </div>
        <p class="mt-2 text-xs text-primary-400">{{ t('口令 5 分钟内有效，剩余') }} {{ state.remainSec }}s</p>
      </div>
      <!-- 公众号引导 -->
      <div v-if="state.qrUrl" class="flex flex-col items-center gap-1">
        <img
          :src="state.qrUrl"
          :alt="state.name"
          class="w-40 h-40 object-contain rounded-lg border border-primary-200 dark:border-primary-800"
        />
        <p class="text-xs text-primary-500">{{ t('扫码关注') }}「{{ state.name }}」</p>
      </div>
      <p class="text-center text-xs text-primary-400">{{ waitingText }}</p>
      <Button :label="t('取消')" variant="secondary" class="w-full" @click="close" />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { status: string }">
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { getErrorMessage } from '@/utils/error';
import { ref, watch, onUnmounted } from 'vue';

/** 发起口令的返回结构（createWechatLogin / createWechatBind 同形） */
interface PasscodeCreateResult {
  code: string;
  ticket: string;
  expiresAt: string | Date;
  official: { name: string; qrUrl: string | null };
}

/** 轮询结果：PENDING/EXPIRED 之外即为终态（LOGIN/BOUND），原样抛给父组件 */

const props = defineProps<{
  visible: boolean;
  /** 弹窗标题 */
  title: string;
  /** 验证成功后的等待文案 */
  waitingText: string;
  /** 发起口令（登录或绑定各自调后端） */
  create: () => Promise<PasscodeCreateResult>;
  /** 轮询验证结果（泛型 T 保留后端精确联合类型，父组件可安全窄化） */ check: (ticket: string) => Promise<T>;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  /** 终态结果（LOGIN/BOUND/EXPIRED），父组件按 status 窄化处理 */
  success: [result: T];
}>();

const { t } = useI18n();
const toast = useToast();

const state = ref({
  code: '',
  ticket: '',
  remainSec: 0,
  name: '',
  qrUrl: null as string | null,
});

/** 轮询定时器 */
let timer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function close() {
  stopPolling();
  emit('update:visible', false);
}

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      stopPolling();
      return;
    }
    try {
      const res = await props.create();
      state.value = {
        code: res.code,
        ticket: res.ticket,
        remainSec: Math.max(0, Math.floor((new Date(res.expiresAt).getTime() - Date.now()) / 1000)),
        name: res.official.name,
        qrUrl: res.official.qrUrl,
      };
      /** 轮询：每 2s 查一次，终态（成功/过期）抛给父组件 */
      timer = setInterval(async () => {
        if (state.value.remainSec <= 0) {
          close();
          toast.error(t('操作失败'), t('口令已过期，请重新发起'));
          return;
        }
        state.value.remainSec = Math.max(0, state.value.remainSec - 2);
        const result = await props.check(state.value.ticket);
        if (result.status === 'PENDING') return;
        close();
        emit('success', result);
      }, 2000);
    } catch (error: unknown) {
      close();
      toast.error(t('发起失败'), getErrorMessage(error));
    }
  },
);

onUnmounted(stopPolling);
</script>
