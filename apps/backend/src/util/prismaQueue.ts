import * as os from 'os';
import * as crypto from 'crypto';
import type { PrismaClient } from '@zenstackhq/runtime';


/** 使用示例
 * ```ts
 * const queue = new PrismaQueue({ prisma });
 *
 * // 注册任务处理器
 * queue.register('sendEmail', async (payload) => {
 *   console.log(`发送邮件到: ${payload.to}`);
 *   // 邮件发送逻辑
 *   return { sent: true };
 * });
 *
 * // 启动队列
 * queue.start();
 *
 * // 添加任务
 * await queue.add('sendEmail', { to: 'user@example.com', subject: '测试' });
 * ```
 */
export class PrismaQueue {
  private prisma: PrismaClient;
  private isRunning: boolean = false;
  private workers: Map<string, (payload: any) => Promise<any>> = new Map();
  private pollingInterval: number;
  private concurrency: number;
  private activeWorkers: number = 0;
  private instanceId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(options: {
    prisma: PrismaClient;
    pollingInterval?: number;
    concurrency?: number;
    instanceId?: string;
    heartbeatInterval?: number;
  }) {
    this.prisma = options.prisma;
    this.pollingInterval = options.pollingInterval || 1000;
    this.concurrency = options.concurrency || 5;

    // 生成唯一的实例ID，用于标识当前实例
    this.instanceId = options.instanceId || this.generateInstanceId();

    console.log(`队列实例已初始化: ${this.instanceId}`);
  }

  /**
   * 生成唯一的实例ID
   */
  private generateInstanceId(): string {
    const hostname = os.hostname();
    const pid = process.pid;
    const random = crypto.randomBytes(4).toString('hex');
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * 添加任务到队列
   */
  async add(
    name: string,
    payload: any,
    options: {
      priority?: number;
      runAt?: Date;
      maxAttempts?: number;
    } = {},
  ) {
    return await this.prisma.queue.create({
      data: {
        name,
        payload: JSON.stringify(payload),
        status: 'PENDING',
        priority: options.priority || 0,
        runAt: options.runAt || new Date(),
        maxAttempts: options.maxAttempts || 3,
      },
    });
  }

  /**
   * 注册任务处理器
   */
  register(name: string, handler: (payload: any) => Promise<any>) {
    this.workers.set(name, handler);
    console.log(`已注册任务处理器: ${name}`);
    return this;
  }

  /**
   * 启动队列处理
   */
  start() {
    if (this.isRunning) return this;

    this.isRunning = true;
    console.log(`队列服务已启动: ${this.instanceId}`);

    // 启动心跳，表明此实例处于活动状态
    this.startHeartbeat();

    // 启动轮询
    this.poll();

    // 启动超时任务检查
    this.checkStuckTasks();

    return this;
  }

  /**
   * 停止队列处理
   */
  stop() {
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    console.log(`队列服务已停止: ${this.instanceId}`);
    return this;
  }

  /**
   * 启动心跳
   * 定期更新实例的最后活动时间，用于检测实例是否存活
   */
  private startHeartbeat() {
    // 每30秒更新一次处理中任务的时间戳
    this.heartbeatInterval = setInterval(async () => {
      try {
        // 更新所有由此实例处理的任务
        await this.prisma.queue.updateMany({
          where: {
            status: 'PROCESSING',
            workerId: this.instanceId,
          },
          data: {
            updated: new Date(), // 更新时间戳作为心跳
          },
        });
      } catch (error) {
        console.error('更新心跳失败:', error);
      }
    }, 30000); // 30秒
  }

  /**
   * 轮询任务
   */
  private async poll() {
    if (!this.isRunning) return;

    // 如果已达到并发上限，等待下一次轮询
    if (this.activeWorkers >= this.concurrency) {
      setTimeout(() => this.poll(), this.pollingInterval);
      return;
    }

    try {
      // 获取所有已注册的任务类型
      const taskTypes = Array.from(this.workers.keys());

      if (taskTypes.length === 0) {
        setTimeout(() => this.poll(), this.pollingInterval);
        return;
      }

      // 使用事务和乐观锁来防止任务抢占
      const task = await this.prisma.$transaction(async (tx) => {
        // 查找可处理的任务
        const task = await tx.queue.findFirst({
          where: {
            name: { in: taskTypes },
            status: 'PENDING',
            runAt: { lte: new Date() },
          },
          orderBy: [{ priority: 'desc' }, { created: 'asc' }],
        });

        if (!task) return null;

        // 尝试更新任务状态，使用乐观锁确保只有一个实例能成功
        const updatedTask = await tx.queue.updateMany({
          where: {
            id: task.id,
            status: 'PENDING', // 确保任务仍处于待处理状态
          },
          data: {
            status: 'PROCESSING',
            workerId: this.instanceId,
            startedAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        // 如果更新影响了0行，说明任务已被其他实例获取
        if (updatedTask.count === 0) return null;

        // 获取更新后的任务
        return await tx.queue.findUnique({
          where: { id: task.id },
        });
      });

      if (task) {
        // 增加活跃工作者计数
        this.activeWorkers++;

        // 异步处理任务
        this.processTask(task).finally(() => {
          // 减少活跃工作者计数
          this.activeWorkers--;
          // 立即检查下一个任务
          setImmediate(() => this.poll());
        });
      } else {
        // 没有任务，等待一段时间再检查
        setTimeout(() => this.poll(), this.pollingInterval);
      }
    } catch (error) {
      console.error('轮询任务出错:', error);
      setTimeout(() => this.poll(), this.pollingInterval);
    }
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: any) {
    const handler = this.workers.get(task.name);

    if (!handler) {
      console.error(`未找到任务处理器: ${task.name}`);
      await this.markTaskFailed(task.id, '未找到任务处理器');
      return;
    }

    try {
      // 解析任务数据
      const payload = JSON.parse(task.payload);

      console.log(`处理任务 ${task.id} (${task.name})`);

      // 执行任务
      const result = await handler(payload);

      // 标记任务为已完成，使用乐观锁确保只有处理该任务的实例能更新它
      const updated = await this.prisma.queue.updateMany({
        where: {
          id: task.id,
          workerId: this.instanceId, // 确保只更新由此实例处理的任务
          status: 'PROCESSING', // 确保任务仍处于处理中状态
        },
        data: {
          status: 'COMPLETED',
          result: result ? JSON.stringify(result) : null,
          completedAt: new Date(),
        },
      });

      if (updated.count > 0) {
        console.log(`任务 ${task.id} 处理完成`);
      } else {
        console.warn(`任务 ${task.id} 状态更新失败，可能已被其他实例处理`);
      }
    } catch (error) {
      console.error(`任务 ${task.id} 处理失败:`, error);

      try {
        // 获取最新的任务状态
        const currentTask = await this.prisma.queue.findUnique({
          where: { id: task.id },
        });

        // 如果任务不存在或不是由此实例处理，则跳过
        if (!currentTask || currentTask.workerId !== this.instanceId) {
          console.warn(`任务 ${task.id} 不是由此实例处理，跳过更新`);
          return;
        }

        // 检查是否需要重试
        if (currentTask.attempts < currentTask.maxAttempts) {
          // 计算退避时间 (指数退避策略)
          const backoff = Math.pow(2, currentTask.attempts) * 1000;
          const runAt = new Date(Date.now() + backoff);

          // 重置任务状态为待处理，等待下次执行
          const updated = await this.prisma.queue.updateMany({
            where: {
              id: task.id,
              workerId: this.instanceId, // 确保只更新由此实例处理的任务
              status: 'PROCESSING', // 确保任务仍处于处理中状态
            },
            data: {
              status: 'PENDING',
              workerId: null,
              runAt,
              error: `尝试 ${currentTask.attempts}/${currentTask.maxAttempts} 失败: ${(error as Error).message}`,
            },
          });

          if (updated.count > 0) {
            console.log(`任务 ${task.id} 将在 ${runAt.toISOString()} 重试`);
          } else {
            console.warn(`任务 ${task.id} 状态更新失败，可能已被其他实例处理`);
          }
        } else {
          // 达到最大重试次数，标记为失败
          await this.markTaskFailed(task.id, (error as Error).message);
        }
      } catch (updateError) {
        console.error(`更新任务 ${task.id} 状态失败:`, updateError);
      }
    }
  }

  /**
   * 标记任务为失败
   */
  private async markTaskFailed(taskId: number, errorMessage: string) {
    try {
      const updated = await this.prisma.queue.updateMany({
        where: {
          id: taskId,
          status: 'PROCESSING',
        },
        data: {
          status: 'FAILED',
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      if (updated.count > 0) {
        console.log(`任务 ${taskId} 已标记为失败`);
      } else {
        console.warn(`任务 ${taskId} 状态更新失败，可能已被其他实例处理`);
      }
    } catch (error) {
      console.error(`标记任务 ${taskId} 为失败状态时出错:`, error);
    }
  }

  /**
   * 检查卡住的任务
   * 处理那些被标记为处理中但长时间未更新的任务
   */
  private async checkStuckTasks() {
    if (!this.isRunning) return;

    try {
      // 查找处理时间超过3分钟且未更新的任务
      // 使用updatedAt而不是startedAt，因为活跃实例会通过心跳更新updatedAt
      const stuckTime = new Date(Date.now() - 3 * 60 * 1000);

      const stuckTasks = await this.prisma.queue.findMany({
        where: {
          status: 'PROCESSING',
          updated: { lt: stuckTime }, // 使用updatedAt检测心跳
        },
      });

      for (const task of stuckTasks) {
        console.log(`发现卡住的任务: ${task.id}, 处理实例: ${task.workerId}`);

        // 检查是否需要重试
        if (task.attempts < task.maxAttempts) {
          // 重置任务状态为待处理
          const updated = await this.prisma.queue.updateMany({
            where: {
              id: task.id,
              status: 'PROCESSING',
              updated: { lt: stuckTime }, // 再次确认任务仍然卡住
            },
            data: {
              status: 'PENDING',
              workerId: null,
              error: `任务处理超时，将重试 (${task.attempts}/${task.maxAttempts})`,
            },
          });

          if (updated.count > 0) {
            console.log(`任务 ${task.id} 已重置为待处理状态`);
          } else {
            console.log(`任务 ${task.id} 状态已变更，跳过重置`);
          }
        } else {
          // 达到最大重试次数，标记为失败
          const updated = await this.prisma.queue.updateMany({
            where: {
              id: task.id,
              status: 'PROCESSING',
              updated: { lt: stuckTime }, // 再次确认任务仍然卡住
            },
            data: {
              status: 'FAILED',
              error: '任务处理超时，达到最大重试次数',
              completedAt: new Date(),
            },
          });

          if (updated.count > 0) {
            console.log(`任务 ${task.id} 已标记为失败`);
          } else {
            console.log(`任务 ${task.id} 状态已变更，跳过标记`);
          }
        }
      }
    } catch (error) {
      console.error('检查卡住任务出错:', error);
    }

    // 每分钟检查一次
    setTimeout(() => this.checkStuckTasks(), 60 * 1000);
  }

  /**
   * 获取队列统计信息
   */
  async getStats() {
    const stats = await this.prisma.$transaction([
      this.prisma.queue.count({ where: { status: 'PENDING' } }),
      this.prisma.queue.count({ where: { status: 'PROCESSING' } }),
      this.prisma.queue.count({ where: { status: 'COMPLETED' } }),
      this.prisma.queue.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      pending: stats[0],
      processing: stats[1],
      completed: stats[2],
      failed: stats[3],
      total: stats.reduce((a, b) => a + b, 0),
      instanceId: this.instanceId,
      activeWorkers: this.activeWorkers,
    };
  }

  /**
   * 清理已完成的任务
   * @param olderThan 清理多少天前的任务
   */
  async cleanup(olderThan: number = 7) {
    const date = new Date();
    date.setDate(date.getDate() - olderThan);

    const result = await this.prisma.queue.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: date },
      },
    });

    console.log(`已清理 ${result.count} 个任务`);
    return result.count;
  }
}
