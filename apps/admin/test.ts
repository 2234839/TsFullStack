import { createRPC, type API } from 'tsfullstack-backend';

async function main() {
  const { API, RC } = await createRPC<API>('apiConsumer', {
    remoteCall(method, data) {
      let body: ReadableStream | string;
      // 如果第一参数是 ReadableStream 的时候，直接使用 ReadableStream 作为 body，不用考虑其他参数，因为这种情况只支持一个参数
      let content_type;
      if (data[0] instanceof ReadableStream) {
        body = data[0];
        content_type = 'application/octet-stream';
      } else {
        body = JSON.stringify(data);
        content_type = 'application/json';
      }
      return fetch(`http://localhost:5209/api/${method}`, {
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
          if (r.error) {
            console.log('[r]', r);
            throw new Error();
          }
          return r.result;
        });
    },
  });
  RC('',[])
  const r = await API.a.b(2);
  console.log('[r2]', r);
}
main();
