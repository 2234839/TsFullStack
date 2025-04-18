import { createRPC, type API as __API__, type AppAPI as __AppAPI__ } from 'tsfullstack-backend';
import superjson from 'superjson';
import { authInfo } from './storage';

const baseServer = import.meta.env.DEV ? 'http://localhost:5209' : '';

export const { API } = createRPC<__API__>('apiConsumer', {
  remoteCall: genRemoteCall(`${baseServer}/api/`),
});
export const { API: AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
  remoteCall: genRemoteCall(`${baseServer}/app-api/`),
});
function genRemoteCall(baseUrl: string) {
  function remoteCall(method: string, data: any[]) {
    let body: BodyInit;
    let content_type;
    if (data[0] instanceof File) {
      const formData = new FormData();
      formData.append('file', data[0]);
      body = formData;
      content_type = undefined;
    } else {
      body = superjson.stringify(data);
      content_type = 'application/json';
    }
    console.log('[data]', body, data);
    return fetch(`${baseUrl}${method}`, {
      method: 'POST',
      body,
      headers: content_type
        ? {
            'Content-Type': content_type,
            'x-token-id': authInfo.value?.token ?? '',
          }
        : { 'x-token-id': authInfo.value?.token ?? '' },
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
