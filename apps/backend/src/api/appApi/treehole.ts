import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AuthContext } from '../../Context/Auth';
import { dbTryOrDefault, dbPaginatedFindMany } from '../../util/dbEffect';
import type { ContentVisibility } from '../../../.zenstack/models';
import type { PostWhereInput } from '../../../.zenstack/input';

/**
 * 树洞帖子列表查询参数
 */
export interface TreeholePostsQuery {
  /** 分页跳过数量 */
  skip: number;
  /** 分页获取数量 */
  take: number;
  /** 可见性过滤 */
  visibility?: ContentVisibility | ContentVisibility[];
  /** 搜索关键词（标题或内容） */
  keyword?: string;
  /** 是否只获取主题帖（不包含回复） */
  onlyRoot?: boolean;
  /** 父帖子 ID（用于获取某个帖子的回复） */
  parentId?: number | null;
  /** 按作者ID过滤（"我的帖子"场景） */
  authorId?: string;
}

/**
 * 树洞帖子作者信息（仅包含公开字段）
 */
export interface TreeholeAuthor {
  id: string;
  nickname: string | null;
}

/**
 * 树洞帖子数据
 */
export interface TreeholePost {
  id: number;
  title: string;
  content: string;
  visibility: ContentVisibility;
  created: Date;
  updated: Date;
  authorId: string;
  author: TreeholeAuthor;
  parentId: number | null;
  /** 直属子回复数量 */
  _count: {
    replies: number;
  };
}

/**
 * 树洞帖子列表查询结果
 */
export interface TreeholePostsResult {
  /** 帖子列表 */
  posts: TreeholePost[];
  /** 总数 */
  total: number;
  /** 是否有更多数据 */
  hasMore: boolean;
}

/**
 * 树洞 API
 * 使用无权限检查的数据库客户端，直接返回必要的公开字段
 */
export const treeholeApi = {
  /**
   * 查询树洞帖子列表
   * 合并了分页查询和总数查询，减少前端请求次数
   */
  queryPosts(params: TreeholePostsQuery) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const ctx = yield* ReqCtxService;

      /** 分页参数边界校验 */
      const skip = Math.max(0, Math.floor(params.skip) || 0);
      const MAX_TAKE = 100;
      const take = Math.min(MAX_TAKE, Math.max(1, Math.floor(params.take) || 10));

      ctx.log('[Treehole] queryPosts, skip=' + skip + ', take=' + take + ', hasKeyword=' + !!params.keyword);

      // 构建查询条件
      const where: PostWhereInput = {};

      // 可见性过滤
      if (params.visibility) {
        if (Array.isArray(params.visibility)) {
          where.visibility = { in: params.visibility };
        } else {
          where.visibility = params.visibility;
        }
      }

      // 是否只获取主题帖
      if (params.onlyRoot) {
        where.parentId = null;
      }

      // 父帖子过滤
      if (params.parentId !== undefined) {
        where.parentId = params.parentId;
      }

      // 作者过滤（"我的帖子"，IDOR 防护：仅允许查询自己的帖子）
      if (params.authorId) {
        const ctx = yield* ReqCtxService;
        const auth = yield* AuthContext;
        /** 强制 authorId 只能是当前登录用户，防止枚举他人帖子 */
        where.authorId = auth.user.id;
      }

      // 搜索关键词
      const keyword = params.keyword?.trim();
      if (keyword) {
        where.OR = [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
        ];
      }

      // 使用分页查询辅助函数并行执行 findMany + count
      const { items: posts, total } = yield* dbPaginatedFindMany('[Treehole]',
        () => dbClient.post.findMany({
          where,
          orderBy: [{ created: 'desc' }],
          skip: skip,
          take: take,
          select: {
            id: true,
            title: true,
            content: true,
            visibility: true,
            created: true,
            updated: true,
            authorId: true,
            parentId: true,
            author: {
              select: { id: true, nickname: true },
            },
          },
        }),
        () => dbClient.post.count({ where }),
      );

      // 提取当前帖子列表的 ID，一次性查询这些帖子的回复数统计
      const postIds = posts.map((post) => post.id);
      const replyCounts = yield* dbTryOrDefault('[Treehole]', '查询回复统计', () =>
        dbClient.post.groupBy({
          by: ['parentId'],
          where: { parentId: { in: postIds } },
          _count: { parentId: true },
        }),
        [],
      );

      // 将回复数统计映射为 Map，方便查找
      const replyCountMap = new Map<number, number>();
      for (const stat of replyCounts) {
        if (stat.parentId) {
          replyCountMap.set(stat.parentId, stat._count.parentId);
        }
      }

      // 为每个帖子附加回复数
      const postsWithCounts = posts.map((post) => ({
        ...post,
        _count: {
          replies: replyCountMap.get(post.id) || 0,
        },
      }));

      return {
        posts: postsWithCounts,
        total,
        hasMore: skip + posts.length < total,
      } as TreeholePostsResult;
    });
  },

  /**
   * 根据 ID 获取单个帖子及其所有回复（树形结构）
   * 用于展开某个主题帖的所有回复
   */
  getPostTree(postId: number) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const ctx = yield* ReqCtxService;

      ctx.log('[Treehole] getPostTree', postId);

      // 并行执行查询：帖子和回复数统计
      const [post, replyCount] = yield* Effect.all([
        dbTryOrDefault('[Treehole]', '查询帖子详情', () =>
          dbClient.post.findUnique({
            where: { id: postId },
            select: {
              id: true,
              title: true,
              content: true,
              visibility: true,
              created: true,
              updated: true,
              authorId: true,
              parentId: true,
              author: {
                select: { id: true, nickname: true },
              },
            },
          }),
          null,
        ),
        dbTryOrDefault('[Treehole]', '查询帖子回复数', () =>
          dbClient.post.count({
            where: { parentId: postId },
          }), 0),
      ] as const);

      if (!post) {
        return null;
      }

      // 为帖子附加回复数
      return {
        ...post,
        _count: {
          replies: replyCount,
        },
      } as TreeholePost;
    });
  },
};
