/**
 * 全局确认对话框系统
 * 替代 PrimeVue 的 useConfirm
 */
import { ref, readonly } from 'vue';
import { useI18n } from '@/composables/useI18n';

interface ConfirmOptions {
  /** 确认消息 */
  message?: string;
  /** 标题 */
  header?: string;
  /** 图标 */
  icon?: string;
  /** 接受按钮的标签 */
  acceptLabel?: string;
  /** 拒绝按钮的标签 */
  rejectLabel?: string;
  /** 接受按钮的类名 */
  acceptClass?: string;
  /** 拒绝按钮的类名 */
  rejectClass?: string;
  /** 触发事件（用于定位弹窗） */
  event?: Event;
  /** 接受按钮属性（兼容 PrimeVue） */
  acceptProps?: {
    label?: string;
    variant?: string;
    icon?: string;
    [key: string]: unknown;
  };
  /** 拒绝按钮属性（兼容 PrimeVue） */
  rejectProps?: {
    label?: string;
    variant?: string;
    [key: string]: unknown;
  };
  /** 接受回调 */
  accept?: () => void | Promise<void>;
  /** 拒绝回调 */
  reject?: () => void | Promise<void>;
}

interface ConfirmState extends ConfirmOptions {
  /** 是否显示 */
  show: boolean;
  /** 触发元素（当传入 event 时使用） */
  targetElement?: HTMLElement;
  /** 回调函数（内部使用） */
  _accept?: () => void;
  _reject?: () => void;
}

/** 全局确认对话框状态 */
const confirmState = ref<ConfirmState>({
  show: false,
});

/** 当前未完成确认的 reject 回调，用于并发调用时自动拒绝前一个 */
let pendingReject: ((value: false) => void) | null = null;

/**
 * 确认对话框 composable
 */
export function useConfirm() {
  const { t } = useI18n();

  /**
   * 显示确认对话框
   */
  const require = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      /** 如果有未完成的确认框，先拒绝它 */
      if (pendingReject) {
        pendingReject(false);
        pendingReject = null;
      }

      /** 获取触发元素 */
      let targetElement: HTMLElement | undefined;

      if (options.event && options.event.target instanceof HTMLElement) {
        targetElement = options.event.target;
      }

      confirmState.value = {
        ...options,
        show: true,
        targetElement,
        acceptLabel: options.acceptLabel || options.acceptProps?.label || t('确认'),
        rejectLabel: options.rejectLabel || options.rejectProps?.label || t('取消'),
        acceptClass: options.acceptProps?.variant === 'danger' ? 'bg-danger-600 hover:bg-danger-700 text-white' : options.acceptClass,
        _accept: async () => {
          pendingReject = null;
          confirmState.value.show = false;
          try {
            await options.accept?.();
            resolve(true);
          } catch (e: unknown) { console.warn('[useConfirm] accept callback error:', e); resolve(false); }
        },
        _reject: async () => {
          pendingReject = null;
          confirmState.value.show = false;
          try {
            await options.reject?.();
          } catch (e: unknown) { console.warn('[useConfirm] reject callback error:', e); }
          resolve(false);
        },
      };

      pendingReject = resolve;
    });
  };

  return {
    require,
    confirmState: readonly(confirmState),
  };
}

/** 导出状态供 Confirm 组件使用 */
export function useConfirmState() {
  return { confirmState: readonly(confirmState) };
}
