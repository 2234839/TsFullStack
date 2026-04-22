import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { DbClientEffect } from '../Context/DbService';
import { dbTry, dbPaginatedFindMany } from '../util/dbEffect';
import { MsgError } from '../util/error';
import type { JsonValue } from '@zenstackhq/orm';
import { TaskStatus, TaskType } from '../../.zenstack/models';
import type { TaskWhereInput } from '../../.zenstack/input';
import { DEFAULT_PAGE_SIZE } from '../util/constants';

/**
 * 任务服务
 *
 * 大部分方法仅依赖 DbClientEffect（数据库客户端），
 * 只有 getTask 依赖 AuthContext（需要 auth.user.id 做权限校验）。
 */
export const TaskService = {
  /**
   * 创建任务
   */
  createTask: (userId: string, data: {
    type: TaskType;
    title: string;
    description?: string;
    inputParams: JsonValue;
    tokenCost: number;
    tags?: string;
  }) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      const task = yield* dbTry('[TaskService]', '创建任务', () =>
        db.task.create({
          data: {
            userId,
            type: data.type,
            title: data.title,
            description: data.description,
            inputParams: data.inputParams,
            tokenCost: data.tokenCost,
            status: TaskStatus.PENDING,
            tags: data.tags,
          },
        }),
      );

      return {
        id: task.id,
        tokenCost: task.tokenCost,
      };
    }),

  /**
   * 原子状态转换：使用 updateMany + 状态条件消除竞态条件
   * 旧模式 findUnique → check → update 在并发时可能两个请求同时通过检查
   * 新模式 updateMany(where: { status: expected }) 通过 count 判断是否成功
   */
  transitionStatus: (
    taskId: number,
    expectedStatus: TaskStatus,
    newStatus: TaskStatus,
    extraData?: Record<string, JsonValue | Date | null | undefined>,
  ) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      const result = yield* dbTry('[TaskService]', '状态转换', () =>
        db.task.updateMany({
          where: { id: taskId, status: expectedStatus },
          data: { status: newStatus, ...extraData },
        }),
      );

      if (result.count === 0) {
        const task = yield* dbTry('[TaskService]', '查询任务', () =>
          db.task.findUnique({
            where: { id: taskId },
            select: { status: true },
          }),
        );

        if (!task) {
          throw MsgError.msg('任务不存在');
        }
        throw MsgError.msg(`任务状态错误：无法从 ${task.status} 转换为 ${newStatus}`);
      }
    }),

  /** 只能从 PENDING → PROCESSING */
  startTask: (taskId: number) =>
    TaskService.transitionStatus(taskId, TaskStatus.PENDING, TaskStatus.PROCESSING, { startedAt: new Date() }),

  /** 只能从 PROCESSING → COMPLETED */
  completeTask: (taskId: number, outputResult: JsonValue) =>
    TaskService.transitionStatus(taskId, TaskStatus.PROCESSING, TaskStatus.COMPLETED, {
      completedAt: new Date(),
      outputResult,
    }),

  /** 只能从 PROCESSING → FAILED */
  failTask: (taskId: number, error: string) =>
    TaskService.transitionStatus(taskId, TaskStatus.PROCESSING, TaskStatus.FAILED, {
      completedAt: new Date(),
      error,
    }),

  /**
   * 获取任务详情（需要 AuthContext 做权限校验）
   */
  getTask: (taskId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const task = yield* dbTry('[TaskService]', '查询任务', () =>
        auth.db.task.findUnique({
          where: { id: taskId },
          include: {
            transactions: true,
            resources: true,
          },
        }),
      );

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
    status?: TaskStatus;
    type?: TaskType;
    skip?: number;
    take?: number;
  } = {}) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      const where: TaskWhereInput = { userId };

      if (options.status) {
        where.status = options.status;
      }

      if (options.type) {
        where.type = options.type;
      }

      return yield* dbPaginatedFindMany('[TaskService]',
        () => db.task.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            status: true,
            tokenCost: true,
            externalTaskId: true,
            created: true,
            updated: true,
          },
          skip: options.skip || 0,
          take: options.take || DEFAULT_PAGE_SIZE,
          orderBy: { created: 'desc' },
        }),
        () => db.task.count({ where }),
        [] as never[],
      );
    }),
};
