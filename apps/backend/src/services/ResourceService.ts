import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { dbTry, dbPaginatedFindMany } from '../util/dbEffect';
import type { ResourceType } from '../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { DEFAULT_PAGE_SIZE } from '../util/constants';
import type { ResourceWhereInput } from '../../.zenstack/input';

/** 合法的 ResourceType 枚举值集合，用于运行时校验 */
const VALID_RESOURCE_TYPES = new Set<string>(['IMAGE', 'TEXT', 'VIDEO', 'AUDIO', 'FILE']);

/** 合法的 Resource status 值集合，用于运行时校验 */
const VALID_RESOURCE_STATUSES = new Set<string>(['pending', 'processing', 'completed', 'failed']);

/**
 * 校验并返回安全的 ResourceType where 过滤值
 * 若传入值不在合法枚举中则返回 undefined（不添加该过滤条件）
 */
function toResourceTypeFilter(value: string): ResourceWhereInput['type'] | undefined {
  if (VALID_RESOURCE_TYPES.has(value)) {
    return { equals: value as ResourceType } as ResourceWhereInput['type'];
  }
  return undefined;
}

/**
 * 校验并返回安全的 ResourceStatus where 过滤值
 * 若传入值不在合法枚举中则返回 undefined（不添加该过滤条件）
 */
function toResourceStatusFilter(value: string): ResourceWhereInput['status'] | undefined {
  if (VALID_RESOURCE_STATUSES.has(value)) {
    return { equals: value } as ResourceWhereInput['status'];
  }
  return undefined;
}

/**
 * 资源服务
 *
 * 所有方法仅依赖 DbClientEffect（数据库客户端）。
 */
export const ResourceService = {
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
        const typeFilter = toResourceTypeFilter(options.type);
        if (typeFilter) {
          where.type = typeFilter;
        }
      }

      if (options.status) {
        const statusFilter = toResourceStatusFilter(options.status);
        if (statusFilter) {
          where.status = statusFilter;
        }
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
          skip: options.skip ?? 0,
          take: options.take ?? DEFAULT_PAGE_SIZE,
          orderBy: { created: 'desc' },
        }),
        () => db.resource.count({ where }),
      );
    }),

};
