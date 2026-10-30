import { MsgError, extractErrorMessage } from './error';

/**
 * 出站 JSON 接口请求：拆分网络错误 / HTTP 状态错误 / JSON 解析错误三类，
 * 各自带上可定位的错误信息抛出 MsgError，避免单 catch 把所有失败混为一谈
 *
 * @param label 日志前缀（如「爱发电查询」）
 * @param url 请求地址
 * @param init fetch 配置（应已含 withFetchTimeout 的超时信号）
 */
export async function fetchJsonOrThrow(label: string, url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error: unknown) {
    throw MsgError.msg(`${label} 网络请求失败: ${extractErrorMessage(error)}`);
  }

  if (!response.ok) {
    throw MsgError.msg(`${label} HTTP 状态异常: ${response.status} ${response.statusText}`);
  }

  try {
    return await response.json();
  } catch (error: unknown) {
    throw MsgError.msg(`${label} 响应 JSON 解析失败: ${extractErrorMessage(error)}`);
  }
}
