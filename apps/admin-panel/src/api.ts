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

/**
 * 使用 SuperJSON 处理复杂参数结构的文件上传
 * @param {Array} data - 包含各种参数的数组
 */
function formDataWithSuperJSON(data: any[]) {
  // 创建 FormData 对象
  const formData = new FormData();

  // 提取所有文件并记录它们的路径
  const files: File[] = [];
  const filePaths: string[] = [];

  // 递归函数，提取所有文件并记录路径
  function extractFiles(obj: any, path = ''): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (obj instanceof File) {
      const fileIndex = files.length;
      files.push(obj);
      filePaths.push(path);
      // 返回一个标记，表示这里有一个文件
      return { __isFile: true, __fileIndex: fileIndex };
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => extractFiles(item, `${path}[${index}]`));
    }

    const result = {} as any;
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      result[key] = extractFiles(value, newPath);
    }
    return result;
  }

  // 处理数据，提取文件
  const processedData = data.map((item, index) =>
    extractFiles(item, index === 0 ? '' : `param${index}`),
  );

  // 使用 SuperJSON 序列化处理后的数据
  const serializedData = superjson.stringify(processedData);

  // 添加序列化后的数据到 FormData
  formData.append('data', serializedData);

  // 添加所有文件到 FormData
  files.forEach((file, index) => {
    formData.append(`file_${index}`, file);
  });

  // 添加文件路径信息
  formData.append('filePaths', JSON.stringify(filePaths));

  return formData;
}
