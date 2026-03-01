/**
 * Toast 事件总线
 * 使用发布-订阅模式，支持消息积攒和延迟消费
 */

interface ToastMessage {
  variant?: 'success' | 'error' | 'info' | 'warn';
  summary: string;
  detail?: string;
  life?: number;
}

type ToastListener = (message: ToastMessage) => void;

class ToastBus {
  /** 已发布但还未被消费的消息队列 */
  private messageQueue: ToastMessage[] = [];

  /** 当前活跃的监听器 */
  private listeners: Set<ToastListener> = new Set();

  /** 用于去重的最近消息（相同detail的消息只保留最新一条） */
  private latestMessages: Map<string, ToastMessage> = new Map();

  /**
   * 发布消息
   * 即使没有监听器，消息也会被保存到队列中等待消费
   */
  publish(message: ToastMessage): void {
    // 对于登录失效消息，使用去重逻辑
    if (message.detail?.includes('用户登录状态失效')) {
      const key = 'login-error';
      const existing = this.latestMessages.get(key);

      if (existing) {
        // 如果已有相同消息，延长时间而不是新增
        const currentLife = existing.life || 3000;
        const newLife = (message.life || 3000) + currentLife - 3000; // 累加额外时间

        this.latestMessages.set(key, {
          ...existing,
          life: newLife,
        });

        console.log('[ToastBus] 延长登录失效消息时间:', newLife);
      } else {
        // 新消息，记录并发布
        this.latestMessages.set(key, message);
        this._addToQueue(message);
      }
    } else {
      // 其他消息直接发布
      this._addToQueue(message);
    }
  }

  /**
   * 订阅消息
   * 订阅时立即消费队列中已存在的消息
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);

    // 立即消费队列中已存在的消息
    this._consumeQueue(listener);

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 将消息添加到队列并通知所有监听器
   */
  private _addToQueue(message: ToastMessage): void {
    this.messageQueue.push(message);
    console.log('[ToastBus] 消息已加入队列:', message);

    // 立即通知所有监听器
    this._notifyListeners(message);
  }

  /**
   * 消费队列中的消息
   */
  private _consumeQueue(listener: ToastListener): void {
    for (const message of this.messageQueue) {
      listener(message);
    }
  }

  /**
   * 通知所有监听器
   */
  private _notifyListeners(message: ToastMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('[ToastBus] 监听器执行出错:', error);
      }
    });
  }

  /**
   * 清空消息队列
   */
  clear(): void {
    this.messageQueue = [];
    this.latestMessages.clear();
    console.log('[ToastBus] 队列已清空');
  }
}

/** 导出单例 */
export const toastBus = new ToastBus();
