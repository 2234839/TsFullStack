import type { PrismaQueue } from './prismaQueue';

type ScheduleTriggerTask = {
  scheduleTrigger: {
    payload: { taskKey: string };
    result: any;
  };
};

type NextRunFn = (lastRun: Date) => Date;

export class QueueScheduler<T extends ScheduleTriggerTask> {
  public queue: PrismaQueue<T>;
  private taskKey: string;
  private handler: () => Promise<T['scheduleTrigger']['result']>;
  private nextRunFn: NextRunFn;
  private isRunning = false;

  /**
   * @param queue - 你的 PrismaQueue 实例，必须支持 scheduleTrigger 任务类型
   * @param taskKey - 定时任务唯一标识
   * @param handler - 定时任务触发时调用的异步函数
   * @param nextRunFn - 计算下一次执行时间函数，传入上次执行时间，返回下一次执行时间
   */
  constructor(
    queue: PrismaQueue<any>,
    taskKey: string,
    handler: () => Promise<T['scheduleTrigger']['result']>,
    nextRunFn: NextRunFn,
  ) {
    this.queue = queue;
    this.taskKey = taskKey;
    this.handler = handler;
    this.nextRunFn = nextRunFn;

    this.queue.register('scheduleTrigger', async (payload) => {
      if (payload.taskKey !== this.taskKey) return;

      // 执行用户传入的业务处理函数
      const res = await this.handler();

      // 续期任务
      const nextRun = this.nextRunFn(new Date());
      await this.queue.add('scheduleTrigger', { taskKey: this.taskKey }, { runAt: nextRun });
      return res;
    });
  }

  /** 启动定时任务调度，首次调度时间必须指定 */
  async start(firstRunAt: Date) {
    if (this.isRunning) return;
    this.isRunning = true;

    // 启动队列（如果没启动）
    this.queue.start();

    // 添加首次调度任务（如果不存在）
    const existing = await this.queue.prisma.queue.findFirst({
      where: {
        name: 'scheduleTrigger',
        status: 'PENDING',
        payload: { path: 'taskKey', equals: this.taskKey },
      },
    });

    if (!existing) {
      await this.queue.add('scheduleTrigger', { taskKey: this.taskKey }, { runAt: firstRunAt });
    }
  }

  /** 停止调度（只是调用队列的停止） */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.queue.stop();
  }
}
