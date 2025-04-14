import { createRPC, type API as __API__, type AppAPI as __AppAPI__ } from 'tsfullstack-backend';
import superjson from 'superjson';

export const { API } = createRPC<__API__>('apiConsumer', {
  remoteCall: genRemoteCall('http://localhost:5209/api/'),
});
export const { API: AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
  remoteCall: genRemoteCall('http://localhost:5209/app-api/'),
});
function genRemoteCall(baseUrl: string) {
  function remoteCall(method: string, data: any[]) {
    let body: ReadableStream | string;
    // 如果第一参数是 ReadableStream 的时候，直接使用 ReadableStream 作为 body，不用考虑其他参数，因为这种情况只支持一个参数
    let content_type;
    if (data[0] instanceof ReadableStream) {
      body = data[0];
      content_type = 'application/octet-stream';
    } else {
      body = superjson.stringify(data);
      content_type = 'application/json';
    }
    return fetch(`${baseUrl}${method}`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': content_type,
      },
      // @ts-expect-error 在 node 运行的时候需要声明双工模式才能正确发送 ReadableStream，TODO 需要验证浏览器端可以这样运行吗
      duplex: 'half', // 关键：显式声明半双工模式
    })
      .then((res) => res.json())
      .then((r) => {
        const res = superjson.deserialize(r) as any;
        if (res.error) {
          console.log('[err]', res);
          throw res.error;
        }
        return res.result;
      });
  }
  return remoteCall;
}
