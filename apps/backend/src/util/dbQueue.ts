import * as os from 'os';
import * as crypto from 'crypto';
import type { ClientContract } from '@zenstackhq/orm';
import type { Queue as QueueModel } from '../../.zenstack/models';
import { schema } from '../../.zenstack/schema';
import type { DbClient } from '../Context/DbService';
import { extractErrorMessage } from './error';

export type TaskMap = Record<string, { payload: unknown; result: unknown }>;

/** 队列运行时常量 */
const HEARTBEAT_INTERVAL_MS = 30_000;
const STUCK_TIMEOUT_MS = 60_000;
const MONITOR_INTERVAL_MS = 60_000;
/** 指数退避最大延迟（1分钟） */
const MAX_BACKOFF_MS = 60_000;
/** 默认队列轮询间隔（毫秒） */
const DEFAULT_POLLING_INTERVAL_MS = 1000;
/** 指数退避基础延迟（1秒） */
const BACKOFF_BASE_MS = 1000;

/** 日志前缀 */
const LOG_PREFIX = '[Queue]';
/** 默认最大重试次数 */
const DEFAULT_MAX_ATTEMPTS = 3;
/** 默认队列并发数 */
const DEFAULT_QUEUE_CONCURRENCY = 5;

export interface AddTaskOptions {
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

export interface QueueOptions {
  dbClient: DbClient | ClientContract<typeof schema>;
  pollingInterval?: number;
  concurrency?: number;
  instanceId?: string;
  stuckTimeoutMs?: number;
}



export class PrismaQueue<T extends TaskMap> {
  public readonly dbClient: DbClient | ClientContract<typeof schema>;
  private readonly pollingInterval: number;
  private readonly concurrency: number;
  private readonly instanceId: string;
  private stuckTimeoutMs: number;
  private isRunning = false;
  private activeWorkers = 0;
  /** 动态任务处理器映射 — 运行时类型由 register<K> 泛型保证 */
  private workers = new Map<string, (payload: unknown) => Promise<unknown>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stuckTaskTimer: NodeJS.Timeout | null = null;

  constructor({ dbClient, pollingInterval = DEFAULT_POLLING_INTERVAL_MS, concurrency = DEFAULT_QUEUE_CONCURRENCY, instanceId, stuckTimeoutMs = STUCK_TIMEOUT_MS }: QueueOptions) {
    this.dbClient = dbClient;
    this.pollingInterval = pollingInterval;
    this.concurrency = concurrency;
    this.instanceId = instanceId ?? this.generateInstanceId();
    this.stuckTimeoutMs = stuckTimeoutMs;
    console.log(`${LOG_PREFIX} Initialized: ${this.instanceId}`);
  }

  public newType<T extends TaskMap>() {
    /** 类型擦除再恢复：运行时实例不变，仅通过泛型参数重新约束 register/add 的类型安全 */
    return this as unknown as PrismaQueue<T>;
  }

  private generateInstanceId(): string {
    return `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  }

  register<K extends keyof T>(
    name: K,
    handler: (payload: T[K]['payload']) => Promise<T[K]['result']>,
  ) {
    this.workers.set(name as string, handler as (payload: unknown) => Promise<unknown>);
    console.log(`${LOG_PREFIX} Registered handler: ${name as string}`);
    return this;
  }

  async add<K extends keyof T>(name: K, payload: T[K]['payload'], options: AddTaskOptions = {}) {
    return this.dbClient.queue.create({
      data: {
        name: name as string,
        payload: payload as never, // ZenStack payload 字段要求严格类型，动态队列通过注册时泛型保证类型安全
        status: 'PENDING',
        priority: options.priority ?? 0,
        runAt: options.runAt ?? new Date(),
        maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      },
    });
  }

  start() {
    if (this.isRunning) return this;
    this.isRunning = true;
    this.startHeartbeat();
    this.poll();
    this.monitorStuckTasks();
    return this;
  }

  stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.stuckTaskTimer) {
      clearTimeout(this.stuckTaskTimer);
      this.stuckTaskTimer = null;
    }
    console.log(`${LOG_PREFIX} Stopped: ${this.instanceId}`);
    return this;
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.dbClient.queue.updateMany({
          where: { status: 'PROCESSING', workerId: this.instanceId },
          data: { updated: new Date() },
        });
      } catch (error: unknown) {
        console.error(`${LOG_PREFIX} Heartbeat update failed:`, error);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    if (this.activeWorkers >= this.concurrency) {
      void setTimeout(() => this.poll(), this.pollingInterval);
      return;
    }

    try {
      const taskTypes = [...this.workers.keys()];
      if (taskTypes.length === 0) {
        void setTimeout(() => this.poll(), this.pollingInterval);
        return;
      }

      // @ts-expect-error -- tx 类型因 DbClient | ClientContract 联合类型导致推导失败，但运行时类型正确
      const task = await this.dbClient.$transaction(async (tx) => {
        const candidate = await tx.queue.findFirst({
          where: {
            name: { in: taskTypes },
            status: 'PENDING',
            runAt: { lte: new Date() },
          },
          orderBy: [{ priority: 'desc' }, { created: 'asc' }],
        });

        if (!candidate) return null;

        const updated = await tx.queue.updateMany({
          where: { id: candidate.id, status: 'PENDING' },
          data: {
            status: 'PROCESSING',
            workerId: this.instanceId,
            startedAt: new Date(),
            attempts: { increment: 1 },
            updated: new Date(),
            error: null,
          },
        });

        if (updated.count === 0) return null;

        return tx.queue.findUnique({ where: { id: candidate.id } });
      });

      if (task) {
        this.activeWorkers++;
        /** Prisma 原始类型 → QueueModel: $transaction 内的 tx 类型因联合类型推导失败，运行时结构一致 */
        this.processTask(task as unknown as QueueModel).finally(() => {
          this.activeWorkers--;
          setImmediate(() => this.poll());
        });
      } else {
        void setTimeout(() => this.poll(), this.pollingInterval);
      }
    } catch (error: unknown) {
      console.error(`${LOG_PREFIX} Polling error:`, error);
      setTimeout(() => this.poll(), this.pollingInterval);
    }
  }

  private async processTask(task: QueueModel) {
    const handler = this.workers.get(task.name);
    if (!handler) {
      await this.failTask(task.id, `No handler for task ${task.name}`);
      return;
    }

    try {
      const payload = task.payload as T[keyof T]['payload'];
      const result = await handler(payload);

      const updated = await this.dbClient.queue.updateMany({
        where: {
          id: task.id,
          workerId: this.instanceId,
          status: 'PROCESSING',
        },
        data: {
          status: 'COMPLETED',
          result: result as never, // ZenStack result 字段要求严格类型，动态队列通过注册时泛型保证类型安全
          completedAt: new Date(),
          updated: new Date(),
          error: null,
        },
      });

      if (updated.count === 0) {
        console.warn(`${LOG_PREFIX} Task ${task.id} update ignored`);
      }
    } catch (error: unknown) {
      const current = await this.dbClient.queue.findUnique({ where: { id: task.id } });
      if (!current || current.workerId !== this.instanceId) return;

      if (current.attempts < current.maxAttempts) {
        const backoff = this.getBackoff(current.attempts);
        const runAt = new Date(Date.now() + backoff);

        await this.dbClient.queue.updateMany({
          where: {
            id: task.id,
            workerId: this.instanceId,
            status: 'PROCESSING',
          },
          data: {
            status: 'PENDING',
            workerId: null,
            runAt,
            error: `Retry ${current.attempts}/${current.maxAttempts}: ${extractErrorMessage(error)}`,
            updated: new Date(),
          },
        });

        // 重试已调度，静默处理
      } else {
        await this.failTask(task.id, extractErrorMessage(error));
      }
    }
  }

  private async failTask(id: number, reason: string) {
    await this.dbClient.queue.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        error: reason,
        completedAt: new Date(),
        updated: new Date(),
      },
    });
    console.error(`${LOG_PREFIX} Task ${id} failed: ${reason}`);
  }

  private getBackoff(attempts: number): number {
    return Math.min(Math.pow(2, attempts) * BACKOFF_BASE_MS, MAX_BACKOFF_MS);
  }

  private async monitorStuckTasks() {
    if (!this.isRunning) return;

    const stuckBefore = new Date(Date.now() - this.stuckTimeoutMs);

    try {
      const stuckTasks = await this.dbClient.queue.findMany({
        where: {
          status: 'PROCESSING',
          updated: { lt: stuckBefore },
        },
      });

      // 拆分为 retry 和 fail 两组，避免串行逐个 await
      const toRetry: typeof stuckTasks = [];
      const toFail: typeof stuckTasks = [];
      // 取当前时间作为批量重试的统一 runAt（backoff 差异很小，简化处理）
      const batchRunAt = new Date();

      for (const task of stuckTasks) {
        if (task.attempts < task.maxAttempts) {
          toRetry.push(task);
        } else {
          toFail.push(task);
        }
      }

      // 批量重试：使用 updateMany 一次更新所有需要重试的任务
      if (toRetry.length > 0) {
        const retryIds = toRetry.map((t) => t.id);
        await this.dbClient.queue.updateMany({
          where: {
            id: { in: retryIds },
            status: 'PROCESSING',
          },
          data: {
            status: 'PENDING',
            workerId: null,
            runAt: batchRunAt,
            error: `Batch recovered ${toRetry.length} stuck tasks`,
            updated: new Date(),
          },
        });
        console.warn(`${LOG_PREFIX} Batch requeued ${toRetry.length} stuck tasks`);
      }

      // 批量失败 — 单次 updateMany 替代逐个 failTask（与 toRetry 同样的批量策略）
      if (toFail.length > 0) {
        const failIds = toFail.map((t) => t.id);
        await this.dbClient.queue.updateMany({
          where: { id: { in: failIds }, status: 'PROCESSING' },
          data: {
            status: 'FAILED',
            error: `Max attempts reached after stuck timeout (${toFail.length} tasks)`,
            completedAt: new Date(),
            updated: new Date(),
          },
        });
        console.error(`${LOG_PREFIX} Batch failed ${toFail.length} stuck tasks`);
      }
    } catch (error: unknown) {
      console.error(`${LOG_PREFIX} monitorStuckTasks failed:`, error);
    }

    this.stuckTaskTimer = setTimeout(() => this.monitorStuckTasks(), MONITOR_INTERVAL_MS);
  }
}
