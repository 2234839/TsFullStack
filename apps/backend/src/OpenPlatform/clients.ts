import type { OAuthClient } from '../../.zenstack/models';
import type { DbClient } from '../Context/DbService';

/** 日志前缀 */
const LOG_PREFIX = '[OpenPlatform]';

/** 解析 redirectUris JSON 字段为字符串数组（脏数据安全：非法结构视为空列表） */
export function parseRedirectUris(client: Pick<OAuthClient, 'redirectUris'>): string[] {
  const raw: unknown = client.redirectUris;
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
}

/** 回调地址校验：注册列表精确匹配（禁止前缀/通配，防授权码经开放重定向泄露） */
export function redirectUriAllowed(client: Pick<OAuthClient, 'redirectUris'>, redirectUri: string): boolean {
  return parseRedirectUris(client).includes(redirectUri);
}

/** 按 clientId 查询接入应用（含禁用项，调用方自行判定 disabled）；查询失败向上抛 */
export async function findClient(dbClient: DbClient, clientId: string): Promise<OAuthClient | null> {
  try {
    return await dbClient.oAuthClient.findFirst({ where: { clientId } });
  } catch (e) {
    console.error(`${LOG_PREFIX} 查询接入应用失败: ${String(e)}`);
    throw e;
  }
}
