import { useAPI } from "@/api";
import { authInfo_isLogin } from "@/storage";
import { ref, watch, type Ref } from "vue";

/** 1px 透明 GIF（43 字节），加载期占位避免 <img src=""> 闪 broken image */
export const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
  const { AppAPIGetUrl, APIGetUrl } = useAPI();

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
      const fileIdVal = typeof id === "string" ? Number(id) : id;
      try {
        url.value = authInfo_isLogin.value
          ? await APIGetUrl.fileApi.file(fileIdVal)
          : await AppAPIGetUrl.fileApi.file(fileIdVal);
      } catch {
        url.value = "";
        error.value = true;
      } finally {
        loading.value = false;
      }
    },
    { immediate: true },
  );

  return { url, loading, error };
}
