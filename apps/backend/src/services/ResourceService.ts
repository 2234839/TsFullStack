import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { MsgError } from '../util/error';

/**
 * 资源服务
 */
export const ResourceService = {
  /**
   * 创建资源
   */
  createResource: (userId: string, data: {
    type: string;
    title: string;
    description?: string;
    metadata: any;
    taskId: number;
    tags?: string;
  }): Effect.Effect<
    { id: number },
    Error,
    AuthContext
  > =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const resource = yield* Effect.tryPromise({
        try: () =>
          auth.db.resource.create({
            data: {
              userId,
              type: data.type as any,
              title: data.title,
              description: data.description,
              metadata: data.metadata as any,
              taskId: data.taskId,
              status: 'pending',
              tags: data.tags,
            },
          }),
        catch: (error) => {
          console.error('[ResourceService] 创建资源失败:', error);
          throw MsgError.msg('创建资源失败');
        },
      });

      return { id: resource.id };
    }),

  /**
   * 更新资源
   */
  updateResource: (resourceId: number, data: {
    metadata?: any;
    status?: string;
    fileId?: number;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 验证权限
      const resource = yield* Effect.tryPromise({
        try: () =>
          auth.db.resource.findUnique({
            where: { id: resourceId },
          }),
        catch: () => null,
      });

      if (!resource) {
        throw MsgError.msg('资源不存在');
      }

      if (resource.userId !== auth.user.id) {
        throw MsgError.msg('无权操作此资源');
      }

      // 更新资源
      yield* Effect.tryPromise({
        try: () =>
          auth.db.resource.update({
            where: { id: resourceId },
            data: data as any,
          }),
        catch: (error) => {
          console.error('[ResourceService] 更新资源失败:', error);
          throw MsgError.msg('更新资源失败');
        },
      });
    }),

  /**
   * 获取资源详情
   */
  getResource: (resourceId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const resource = yield* Effect.tryPromise({
        try: () =>
          auth.db.resource.findUnique({
            where: { id: resourceId },
            include: {
              file: true,
              task: true,
            },
          }),
        catch: (error) => {
          console.error('[ResourceService] 查询资源失败:', error);
          throw MsgError.msg('查询资源失败');
        },
      });

      if (!resource) {
        throw MsgError.msg('资源不存在');
      }

      if (resource.userId !== auth.user.id && resource.status !== 'public') {
        throw MsgError.msg('无权访问此资源');
      }

      return resource;
    }),

  /**
   * 获取用户资源列表
   */
  listResources: (userId: string, options: {
    type?: string;
    status?: string;
    skip?: number;
    take?: number;
  } = {}) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const where: any = {
        userId,
      };

      if (options.type) {
        where.type = options.type;
      }

      if (options.status) {
        where.status = options.status;
      }

      const [resources, total] = yield* Effect.all([
        Effect.tryPromise({
          try: () =>
            auth.db.resource.findMany({
              where,
              include: {
                file: true,
                task: true,
              },
              skip: options.skip || 0,
              take: options.take || 20,
              orderBy: { created: 'desc' },
            }),
          catch: () => {
            console.error('[ResourceService] 查询资源列表失败');
            return [];
          },
        }),
        Effect.tryPromise({
          try: () => auth.db.resource.count({ where }),
          catch: () => 0,
        }),
      ]);

      return { resources, total };
    }),

  /**
   * 关联文件
   */
  attachFile: (resourceId: number, fileId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      yield* Effect.tryPromise({
        try: () =>
          auth.db.resource.update({
            where: { id: resourceId },
            data: { fileId },
          }),
        catch: (error) => {
          console.error('[ResourceService] 关联文件失败:', error);
          throw MsgError.msg('关联文件失败');
        },
      });
    }),
};
