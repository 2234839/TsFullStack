import { useAPI } from '@/api';
import { $Enums } from '@tsfullstack/backend';

/**
 * 文件上传 composable，提供覆盖式上传能力
 *
 * 覆盖式上传：上传新文件 → 设为 public → 删除旧文件 → 返回新文件元数据
 */
export function useFileUpload() {
  const { API } = useAPI();

  /**
   * 上传文件并设为公开
   * @returns 新文件的 ShareFileJSON 格式数据
   */
  async function uploadPublic(file: File | Blob, filename?: string) {
    const uploadFile = file instanceof File
      ? file
      : new File([file], filename ?? 'untitled', { type: file.type });

    const { id } = await API.fileApi.upload(uploadFile);
    const result = await API.fileApi.updateFileStatus(id, $Enums.FileStatusEnum.public);
    return {
      ...result,
      created: result.created.toISOString(),
      updated: result.updated.toISOString(),
    };
  }

  /**
   * 覆盖式上传：上传新文件 → 设为 public → 删除旧文件
   * @returns 新文件的 ShareFileJSON 格式数据
   */
  async function overwriteUpload(oldFileId: number, newFile: File | Blob, filename?: string) {
    const result = await uploadPublic(newFile, filename);
    await API.fileApi.delete(oldFileId);
    return result;
  }

  return { uploadPublic, overwriteUpload };
}
