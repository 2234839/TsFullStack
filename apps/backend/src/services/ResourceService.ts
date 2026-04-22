import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { DbClientEffect } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { dbTry, dbPaginatedFindMany } from '../util/dbEffect';
import { MsgError } from '../util/error';
import type { ResourceType } from '../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { DEFAULT_PAGE_SIZE } from '../util/constants';
import type { ResourceWhereInput } from '../../.zenstack/input';

/**
 * 资源服务
 *
 * createResource / listResources / attachFile 仅依赖 DbClientEffect；
 * updateResource / getResource 依赖 AuthContext（需要 auth.user.id 做权限校验）。
 */
export const ResourceService = {
  /**
   * 创建资源
   */
  createResource: (userId: string, data: {
    type: ResourceType;
    title: string;
    description?: string;
    metadata: JsonValue;
    taskId: number;
    tags?: string;
  }) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      const resource = yield* dbTry('[ResourceService]', '创建资源', () =>
        db.resource.create({
          data: {
            userId,
            type: data.type,
            title: data.title,
            description: data.description,
            metadata: data.metadata,
            taskId: data.taskId,
            status: 'pending',
            tags: data.tags,
          },
        }),
      );

      return { id: resource.id };
    }),

  /**
   * 更新资源（需要 AuthContext 做权限校验）
   */
  updateResource: (resourceId: number, data: {
    metadata?: JsonValue;
    status?: string;
    fileId?: number;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 验证权限
      const resource = yield* dbTry('[ResourceService]', '查询资源', () =>
        auth.db.resource.findUnique({ where: { id: resourceId } }),
      );

      if (!resource) {
        throw MsgError.msg('资源不存在');
      }

      if (resource.userId !== auth.user.id) {
        throw MsgError.msg('无权操作此资源');
      }

      // 更新资源
      yield* dbTry('[ResourceService]', '更新资源', () =>
        auth.db.resource.update({ where: { id: resourceId }, data }),
      );
    }),

  /**
   * 获取资源详情（需要 AuthContext 做权限校验）
   */
  getResource: (resourceId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const resource = yield* dbTry('[ResourceService]', '查询资源', () =>
        auth.db.resource.findUnique({
          where: { id: resourceId },
          include: { file: true, task: true },
        }),
      );

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
      const db = yield* DbClientEffect;

      const where: ResourceWhereInput = { userId };

      if (options.type) {
        where.type = options.type as ResourceWhereInput['type'];
      }

      if (options.status) {
        where.status = options.status as ResourceWhereInput['status'];
      }

      return yield* dbPaginatedFindMany('[ResourceService]',
        () => db.resource.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            status: true,
            taskId: true,
            created: true,
            file: { select: { id: true, filename: true, mimetype: true, size: true } },
            task: { select: { id: true, type: true, title: true } },
          },
          skip: options.skip || 0,
          take: options.take || DEFAULT_PAGE_SIZE,
          orderBy: { created: 'desc' },
        }),
        () => db.resource.count({ where }),
        [] as never[],
      );
    }),

  /**
   * 关联文件
   */
  attachFile: (resourceId: number, fileId: number) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      yield* dbTry('[ResourceService]', '关联文件', () =>
        db.resource.update({
          where: { id: resourceId },
          data: { fileId },
        }),
      );
    }),
};
