/**
 * 全局确认对话框系统
 * 替代 PrimeVue 的 useConfirm
 */
import { ref } from 'vue';

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
  /** 是否默认聚焦接受按钮 */
  defaultFocus?: 'accept' | 'reject';
  /** 触发事件（用于定位弹窗） */
  event?: Event;
  /** 接受按钮属性（兼容 PrimeVue） */
  acceptProps?: {
    label?: string;
    variant?: string;
    icon?: string;
    [key: string]: any;
  };
  /** 拒绝按钮属性（兼容 PrimeVue） */
  rejectProps?: {
    label?: string;
    variant?: string;
    [key: string]: any;
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

/**
 * 确认对话框 composable
 */
export function useConfirm() {
  /**
   * 显示确认对话框
   */
  const require = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      /** 获取触发元素 */
      let targetElement: HTMLElement | undefined;

      if (options.event && options.event.target instanceof HTMLElement) {
        targetElement = options.event.target;
      }

      confirmState.value = {
        ...options,
        show: true,
        targetElement,
        acceptLabel: options.acceptLabel || options.acceptProps?.label || '确认',
        rejectLabel: options.rejectLabel || options.rejectProps?.label || '取消',
        acceptClass: options.acceptProps?.variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : options.acceptClass,
        _accept: async () => {
          confirmState.value.show = false;
          try {
            await options.accept?.();
            resolve(true);
          } catch {
            resolve(false);
          }
        },
        _reject: async () => {
          confirmState.value.show = false;
          try {
            await options.reject?.();
          } catch {}
          resolve(false);
        },
      };
    });
  };

  return {
    require,
    confirmState,
  };
}

/** 导出状态供 Confirm 组件使用 */
export function useConfirmState() {
  return { confirmState };
}
