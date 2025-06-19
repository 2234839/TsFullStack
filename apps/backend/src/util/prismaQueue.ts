import * as os from 'os';
import * as crypto from 'crypto';
import type { PrismaClient } from '@zenstackhq/runtime';
import type { Queue as QueueModel } from '@prisma/client';

// 不再使用索引签名约束TaskMap，而是普通泛型映射类型
export type TaskMap = Record<string, { payload: any; result: any }>;

export interface AddTaskOptions {
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

export interface QueueOptions {
  prisma: PrismaClient;
  pollingInterval?: number;
  concurrency?: number;
  instanceId?: string;
}
/**
 * 基于数据库的 ts 类型友好队列，使用范例：
 * ```typescript
 * type MyTasks = {
 *   sendEmail: {
 *     payload: { to: string; subject: string };
 *     result: { sent: boolean };
 *   };
 * };
 *
 * const queue = new PrismaQueue<MyTasks>({ prisma });
 * // 复用原来的队列实例，但是拥有新的任务类型定义
 * const queue2 = queue.newType<{
 *   otherTask: {
 *     payload: { to: string; subject: string };
 *     result: { sent: boolean };
 *   };
 * }>();
 *
 * // 注册任务
 * queue.register('sendEmail', async (payload) => {
 *   console.log(`Send email to ${payload.to}, subject: ${payload.subject}`);
 *   return { sent: true };
 * });
 * queue2.register('otherTask', async (payload) => {
 *   console.log(`Other task to ${payload.to}, subject: ${payload.subject}`);
 *   return { sent: true };
 * });
 * // 启动队列
 * queue.start();
 * // 添加任务
 * queue.add('sendEmail', { to: 'alice@example.com', subject: '欢迎 Alice' });
 * ```
 */
export class PrismaQueue<T extends TaskMap> {
  private readonly prisma: PrismaClient;
  private readonly pollingInterval: number;
  private readonly concurrency: number;
  private readonly instanceId: string;
  private isRunning = false;
  private activeWorkers = 0;
  private workers = new Map<string, (payload: any) => Promise<any>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor({ prisma, pollingInterval = 1000, concurrency = 5, instanceId }: QueueOptions) {
    this.prisma = prisma;
    this.pollingInterval = pollingInterval;
    this.concurrency = concurrency;
    this.instanceId = instanceId ?? this.generateInstanceId();
    console.log(`[Queue] Initialized: ${this.instanceId}`);
  }
  /** 类型辅助函数，复用队列实例，但是拥有新的任务类型定义 */
  public newType<T extends TaskMap>() {
    return this as unknown as PrismaQueue<T>;
  }

  private generateInstanceId(): string {
    return `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  }

  register<K extends keyof T>(
    name: K,
    handler: (payload: T[K]['payload']) => Promise<T[K]['result']>,
  ) {
    this.workers.set(name as string, handler as (payload: any) => Promise<any>);
    console.log(`[Queue] Registered handler: ${name as string}`);
    return this;
  }

  async add<K extends keyof T>(name: K, payload: T[K]['payload'], options: AddTaskOptions = {}) {
    return this.prisma.queue.create({
      data: {
        name: name as string,
        payload,
        status: 'PENDING',
        priority: options.priority ?? 0,
        runAt: options.runAt ?? new Date(),
        maxAttempts: options.maxAttempts ?? 3,
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
    console.log(`[Queue] Stopped: ${this.instanceId}`);
    return this;
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.prisma.queue
        .updateMany({
          where: { status: 'PROCESSING', workerId: this.instanceId },
          data: { updated: new Date() },
        })
        .catch((err) => console.error('[Queue] Heartbeat failed:', err));
    }, 30_000);
  }

  private async poll() {
    if (!this.isRunning) return;
    if (this.activeWorkers >= this.concurrency) {
      return setTimeout(() => this.poll(), this.pollingInterval);
    }

    try {
      const taskTypes = [...this.workers.keys()];
      if (taskTypes.length === 0) return setTimeout(() => this.poll(), this.pollingInterval);

      const task = await this.prisma.$transaction(async (tx) => {
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
          },
        });

        if (updated.count === 0) return null;

        return tx.queue.findUnique({ where: { id: candidate.id } });
      });

      if (task) {
        this.activeWorkers++;
        this.processTask(task).finally(() => {
          this.activeWorkers--;
          setImmediate(() => this.poll());
        });
      } else {
        setTimeout(() => this.poll(), this.pollingInterval);
      }
    } catch (err) {
      console.error('[Queue] Polling error:', err);
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

      const updated = await this.prisma.queue.updateMany({
        where: {
          id: task.id,
          workerId: this.instanceId,
          status: 'PROCESSING',
        },
        data: {
          status: 'COMPLETED',
          result,
          completedAt: new Date(),
        },
      });

      updated.count > 0
        ? console.log(`[Queue] Task ${task.id} completed`)
        : console.warn(`[Queue] Task ${task.id} update ignored`);
    } catch (err) {
      await this.handleFailure(task, err);
    }
  }

  private async handleFailure(task: QueueModel, err: unknown) {
    const current = await this.prisma.queue.findUnique({ where: { id: task.id } });
    if (!current || current.workerId !== this.instanceId) return;

    if (current.attempts < current.maxAttempts) {
      const backoff = this.getBackoff(current.attempts);
      const runAt = new Date(Date.now() + backoff);

      await this.prisma.queue.updateMany({
        where: {
          id: task.id,
          workerId: this.instanceId,
          status: 'PROCESSING',
        },
        data: {
          status: 'PENDING',
          workerId: null,
          runAt,
          error: `Retry ${current.attempts}/${current.maxAttempts}: ${(err as Error).message}`,
        },
      });

      console.log(`[Queue] Task ${task.id} will retry at ${runAt.toISOString()}`);
    } else {
      await this.failTask(task.id, (err as Error).message);
    }
  }

  private async failTask(id: number, reason: string) {
    await this.prisma.queue.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        error: reason,
        completedAt: new Date(),
      },
    });

    console.error(`[Queue] Task ${id} failed: ${reason}`);
  }

  private getBackoff(attempts: number): number {
    return Math.min(Math.pow(2, attempts) * 1000, 60_000);
  }

  private async monitorStuckTasks() {
    if (!this.isRunning) return;
    const stuckBefore = new Date(Date.now() - 180_000);

    try {
      const stuckTasks = await this.prisma.queue.findMany({
        where: {
          status: 'PROCESSING',
          updated: { lt: stuckBefore },
        },
      });

      for (const task of stuckTasks) {
        if (task.attempts < task.maxAttempts) {
          await this.prisma.queue.updateMany({
            where: { id: task.id, updated: { lt: stuckBefore }, status: 'PROCESSING' },
            data: {
              status: 'PENDING',
              workerId: null,
              error: `Timeout recovery (${task.attempts}/${task.maxAttempts})`,
            },
          });
          console.warn(`[Queue] Task ${task.id} reset due to timeout`);
        } else {
          await this.failTask(task.id, 'Timeout and max attempts reached');
        }
      }
    } catch (err) {
      console.error('[Queue] Stuck task check failed:', err);
    }

    setTimeout(() => this.monitorStuckTasks(), 60_000);
  }

  async getStats() {
    const [pending, processing, completed, failed] = await this.prisma.$transaction([
      this.prisma.queue.count({ where: { status: 'PENDING' } }),
      this.prisma.queue.count({ where: { status: 'PROCESSING' } }),
      this.prisma.queue.count({ where: { status: 'COMPLETED' } }),
      this.prisma.queue.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed,
      instanceId: this.instanceId,
      activeWorkers: this.activeWorkers,
    };
  }

  async cleanup(olderThanDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.queue.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: cutoff },
      },
    });

    console.log(`[Queue] Cleaned ${result.count} tasks`);
    return result.count;
  }
}
