import { useAPI } from '@/api';
import { TokenOptions } from '@tsfullstack/backend';

/** RemoteSelect 查询参数 */
interface QueryParams {
  keyword: string;
  skip: number;
  take: number;
}

/** RemoteSelect 查询结果 */
interface QueryResult<T> {
  data: T[];
  total: number;
}

/**
 * 获取代币类型标签
 */
export function getTypeLabel(type: string): string {
  return TokenOptions.TokenTypeLabels[type as keyof typeof TokenOptions.TokenTypeLabels] || type;
}

/**
 * 搜索用户（用于 RemoteSelect 组件）
 * 返回用户 id/email 列表供选择
 */
export async function searchUsers(params: QueryParams): Promise<QueryResult<{ value: string; label: string }>> {
  const { API } = useAPI();
  try {
    const users = await API.db.user.findMany({
      where: { email: { contains: params.keyword } },
      select: { id: true, email: true },
      skip: params.skip,
      take: params.take,
    });

    const count = await API.db.user.count({
      where: { email: { contains: params.keyword } },
    });

    return {
      data: users.map((u) => ({ value: u.id, label: u.email })),
      total: count,
    };
  } catch (error: unknown) {
    return { data: [], total: 0 };
  }
}
