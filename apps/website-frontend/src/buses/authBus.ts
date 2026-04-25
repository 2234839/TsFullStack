/**
 * 认证事件总线
 * 处理登出、登录等认证相关事件
 */

import { type MsgErrorOpValues } from '@tsfullstack/backend';

/** 认证事件监听器 */
type AuthEventListener = () => void;

class AuthBus {
  /** 事件监听器集合 */
  private listeners: Map<string, Set<AuthEventListener>> = new Map();

  /**
   * 订阅认证事件
   * @param event 事件类型（使用后端 MsgError.op_* 常量）
   * @param listener 事件监听器
   * @returns 取消订阅函数
   */
  subscribe(event: MsgErrorOpValues, listener: AuthEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(listener);

    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * 发布认证事件
   * @param event 事件类型（使用后端 MsgError.op_* 常量）
   */
  publish(event: string): void {
    const listeners = this.listeners.get(event);
    if (listeners && listeners.size > 0) {
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (_error: unknown) {
          /** 静默处理监听器异常 */
        }
      });
    }
  }
}

/** 导出单例 */
export const authBus = new AuthBus();
