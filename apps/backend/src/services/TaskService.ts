import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { MsgError } from '../util/error';
import { TokenService } from './TokenService';
import { TaskStatus } from '../../.zenstack/models';

/**
 * 任务服务
 */
export const TaskService = {
  /**
   * 创建任务
   */
  createTask: (userId: string, data: {
    type: string;
    title: string;
    description?: string;
    inputParams: any;
    tokenCost: number;
    tags?: string;
  }): Effect.Effect<
    { id: number; tokenCost: number },
    Error,
    AuthContext
  > =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 创建任务
      const task = yield* Effect.tryPromise({
        try: () =>
          auth.db.task.create({
            data: {
              userId,
              type: data.type as any,
              title: data.title,
              description: data.description,
              inputParams: data.inputParams as any,
              tokenCost: data.tokenCost,
              status: TaskStatus.PENDING,
              tags: data.tags,
            },
          }),
        catch: (error) => {
          console.error('[TaskService] 创建任务失败:', error);
          throw MsgError.msg('创建任务失败');
        },
      });

      return {
        id: task.id,
        tokenCost: task.tokenCost,
      };
    }),

  /**
   * 开始任务
   */
  startTask: (taskId: number): Effect.Effect<
    void,
    Error,
    AuthContext
  > =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      yield* Effect.tryPromise({
        try: () =>
          auth.db.task.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.PROCESSING,
              startedAt: new Date(),
            },
          }),
        catch: (error) => {
          console.error('[TaskService] 更新任务状态失败:', error);
          throw MsgError.msg('更新任务状态失败');
        },
      });
    }),

  /**
   * 完成任务
   */
  completeTask: (taskId: number, outputResult: any): Effect.Effect<
    void,
    Error,
    AuthContext
  > =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      yield* Effect.tryPromise({
        try: () =>
          auth.db.task.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.COMPLETED,
              completedAt: new Date(),
              outputResult: outputResult as any,
            },
          }),
        catch: (error) => {
          console.error('[TaskService] 完成任务失败:', error);
          throw MsgError.msg('完成任务失败');
        },
      });
    }),

  /**
   * 失败任务
   */
  failTask: (taskId: number, error: string) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      yield* Effect.tryPromise({
        try: () =>
          auth.db.task.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.FAILED,
              completedAt: new Date(),
              error,
            },
          }),
        catch: (err) => {
          console.error('[TaskService] 失败任务失败:', err);
          throw MsgError.msg('更新任务状态失败');
        },
      });
    }),

  /**
   * 获取任务详情
   */
  getTask: (taskId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const task = yield* Effect.tryPromise({
        try: () =>
          auth.db.task.findUnique({
            where: { id: taskId },
            include: {
              transactions: true,
              resources: true,
            },
          }),
        catch: (error) => {
          console.error('[TaskService] 查询任务失败:', error);
          throw MsgError.msg('查询任务失败');
        },
      });

      if (!task) {
        throw MsgError.msg('任务不存在');
      }

      if (task.userId !== auth.user.id) {
        throw MsgError.msg('无权访问此任务');
      }

      return task;
    }),

  /**
   * 获取用户任务列表
   */
  listTasks: (userId: string, options: {
    status?: string;
    type?: string;
    skip?: number;
    take?: number;
  } = {}) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const where: any = {
        userId,
      };

      if (options.status) {
        where.status = options.status;
      }

      if (options.type) {
        where.type = options.type;
      }

      const [tasks, total] = yield* Effect.all([
        Effect.tryPromise({
          try: () =>
            auth.db.task.findMany({
              where,
              include: {
                transactions: true,
                resources: true,
              },
              skip: options.skip || 0,
              take: options.take || 20,
              orderBy: { created: 'desc' },
            }),
          catch: () => {
            console.error('[TaskService] 查询任务列表失败');
            return [];
          },
        }),
        Effect.tryPromise({
          try: () => auth.db.task.count({ where }),
          catch: () => 0,
        }),
      ]);

      return { tasks, total };
    }),
};
