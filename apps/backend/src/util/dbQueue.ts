import * as os from 'os';
import * as crypto from 'crypto';
import type { ClientContract } from '@zenstackhq/orm';
import type { Queue as QueueModel } from '../../.zenstack/models';
import { schema } from '../../.zenstack/schema';

export type TaskMap = Record<string, { payload: any; result: any }>;

export interface AddTaskOptions {
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

export interface QueueOptions {
  dbClient: ClientContract<typeof schema>;
  pollingInterval?: number;
  concurrency?: number;
  instanceId?: string;
  stuckTimeoutMs?: number;
}



export class PrismaQueue<T extends TaskMap> {
  public readonly dbClient: ClientContract<typeof schema>;
  private readonly pollingInterval: number;
  private readonly concurrency: number;
  private readonly instanceId: string;
  private readonly stuckTimeoutMs: number;
  private isRunning = false;
  private activeWorkers = 0;
  private workers = new Map<string, (payload: any) => Promise<any>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stuckTaskTimer: NodeJS.Timeout | null = null;

  constructor({ dbClient, pollingInterval = 1000, concurrency = 5, instanceId, stuckTimeoutMs = 30_000 }: QueueOptions) {
    this.dbClient = dbClient;
    this.pollingInterval = pollingInterval;
    this.concurrency = concurrency;
    this.instanceId = instanceId ?? this.generateInstanceId();
    this.stuckTimeoutMs = stuckTimeoutMs;
    console.log(`[Queue] Initialized: ${this.instanceId}`);
  }

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
    return this.dbClient.queue.create({
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
    if (this.stuckTaskTimer) {
      clearTimeout(this.stuckTaskTimer);
      this.stuckTaskTimer = null;
    }
    console.log(`[Queue] Stopped: ${this.instanceId}`);
    return this;
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.dbClient.queue.updateMany({
          where: { status: 'PROCESSING', workerId: this.instanceId },
          data: { updated: new Date() },
        });
      } catch (err) {
        console.error('[Queue] Heartbeat update failed:', err);
      }
    }, 30_000);
  }

  // @ts-ignore
  private async poll() {
    if (!this.isRunning) return;
    if (this.activeWorkers >= this.concurrency) {
      return setTimeout(() => this.poll(), this.pollingInterval);
    }

    try {
      const taskTypes = [...this.workers.keys()];
      if (taskTypes.length === 0) return setTimeout(() => this.poll(), this.pollingInterval);

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

      const updated = await this.dbClient.queue.updateMany({
        where: {
          id: task.id,
          workerId: this.instanceId,
          status: 'PROCESSING',
        },
        data: {
          status: 'COMPLETED',
          result,
          completedAt: new Date(),
          updated: new Date(),
          error: null,
        },
      });

      updated.count > 0
        ? console.log(`[Queue] Task ${task.id} completed`)
        : console.warn(`[Queue] Task ${task.id} update ignored`);
    } catch (err) {
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
            error: `Retry ${current.attempts}/${current.maxAttempts}: ${(err as Error).message}`,
            updated: new Date(),
          },
        });

        console.log(`[Queue] Task ${task.id} will retry at ${runAt.toISOString()}`);
      } else {
        await this.failTask(task.id, (err as Error).message);
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
    console.error(`[Queue] Task ${id} failed: ${reason}`);
  }

  private getBackoff(attempts: number): number {
    return Math.min(Math.pow(2, attempts) * 1000, 60_000);
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

      for (const task of stuckTasks) {
        if (task.attempts < task.maxAttempts) {
          const backoff = this.getBackoff(task.attempts);
          const runAt = new Date(Date.now() + backoff);

          await this.dbClient.queue.updateMany({
            where: { id: task.id, updated: { lt: stuckBefore }, status: 'PROCESSING' },
            data: {
              status: 'PENDING',
              workerId: null,
              runAt,
              error: `Recovered from stuck worker (${task.attempts}/${task.maxAttempts})`,
              updated: new Date(),
            },
          });

          console.warn(`[Queue] Requeued stuck task ${task.id} (worker ${task.workerId})`);
        } else {
          await this.failTask(task.id, 'Max attempts reached after stuck timeout');
        }
      }
    } catch (err) {
      console.error('[Queue] monitorStuckTasks failed:', err);
    }

    this.stuckTaskTimer = setTimeout(() => this.monitorStuckTasks(), 60_000);
  }

  async getStats() {
    const [pending, processing, completed, failed] = await this.dbClient.$transaction([
      this.dbClient.queue.count({ where: { status: 'PENDING' } }),
      this.dbClient.queue.count({ where: { status: 'PROCESSING' } }),
      this.dbClient.queue.count({ where: { status: 'COMPLETED' } }),
      this.dbClient.queue.count({ where: { status: 'FAILED' } }),
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

    const result = await this.dbClient.queue.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: cutoff },
      },
    });

    console.log(`[Queue] Cleaned ${result.count} tasks`);
    return result.count;
  }
}
