import { useAPI } from '@/api';
import { authInfo_isLogin } from '@/storage';
import { ref, watch, type Ref } from 'vue';

/** 1px 透明 GIF（43 字节），加载期占位避免 <img src=""> 闪 broken image */
export const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * 解析文件为可用的展示 URL（签名 URL → fetch → blob → objectURL）。
 *
 * 为什么不把签名 URL 直接当 <img src>：<img> 加载失败时页面无感知，
 * 只会永远裂图且无法呈现错误。走 fetch 拿到错误响应体后如实抛出，
 * 登录态失效的统一处理（LogoutError → logout）在 api.ts 的响应拦截层。
 * 单次下载，blob URL 不会引发二次请求。
 */
export async function resolveFileObjectUrl(fileIdVal: number): Promise<string> {
  const { AppAPIGetUrl, APIGetUrl } = useAPI();
  const target = authInfo_isLogin.value
    ? await APIGetUrl.fileApi.file(fileIdVal)
    : await AppAPIGetUrl.fileApi.file(fileIdVal);

  const res = await fetch(target);
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    /** 后端错误统一走 JSON 信封，读 message 抛给调用方呈现 */
    const body = (await res.json().catch(() => null)) as {
      json?: { error?: { kind?: string; message?: string } };
    } | null;
    throw new Error(body?.json?.error?.message ?? '文件加载失败');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export interface FileUrlState {
  /** 文件访问 URL；加载中为 1px 透明像素占位，加载失败为空字符串（<img> 呈现原生碎图标） */
  url: Ref<string>;
  /** URL 是否正在加载 */
  loading: Ref<boolean>;
  /** 加载是否失败（失败时 url 为空字符串，<img> 显示浏览器原生碎图标） */
  error: Ref<boolean>;
}

/**
 * 根据 fileId 解析文件访问 URL 的组合式函数
 * 请求返回前 url 为 1px 透明像素，返回成功后替换为真实 URL，失败则置空（<img> 呈现原生碎图标）并暴露 error
 */
export function useFileUrl(fileId: () => number | string | undefined | null): FileUrlState {
  const url = ref(TRANSPARENT_PIXEL);
  const loading = ref(false);
  const error = ref(false);

  watch(
    () => fileId(),
    async (id) => {
      if (id === undefined || id === null) {
        url.value = TRANSPARENT_PIXEL;
        error.value = false;
        return;
      }
      loading.value = true;
      error.value = false;
      const fileIdVal = typeof id === 'string' ? Number(id) : id;
      try {
        url.value = await resolveFileObjectUrl(fileIdVal);
      } catch {
        url.value = '';
        error.value = true;
      } finally {
        loading.value = false;
      }
    },
    { immediate: true },
  );

  return { url, loading, error };
}
