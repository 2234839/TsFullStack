import { useAPI } from "@/api";
import { $Enums } from "@tsfullstack/backend";
import type { ShareCrypto } from "@/utils/shareCrypto";

/**
 * 文件上传 composable，提供覆盖式上传能力
 *
 * 覆盖式上传：上传新文件 → 设为 public → 删除旧文件 → 返回新文件元数据
 */
export function useFileUpload() {
  const { API } = useAPI();

  /**
   * 上传文件并设为公开
   * @param cryptoInstance 可选的加密实例，传入则在上传前加密文件内容
   * @returns 新文件的 ShareFileJSON 格式数据
   */
  async function uploadPublic(file: File | Blob, filename?: string, cryptoInstance?: ShareCrypto) {
    let uploadFile =
      file instanceof File ? file : new File([file], filename ?? "untitled", { type: file.type });

    /** 如果传入了加密实例，先加密文件二进制内容 */
    if (cryptoInstance) {
      const arrayBuffer = await uploadFile.arrayBuffer();
      const encryptedBuffer = await cryptoInstance.encryptBytes(arrayBuffer);
      /** 保留原始 mimetype，这样前端可以根据 mimetype 判断文件类型（文本/图片/视频等） */
      uploadFile = new File([encryptedBuffer], uploadFile.name, {
        type: uploadFile.type,
      });
    }

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
  async function overwriteUpload(
    oldFileId: number,
    newFile: File | Blob,
    filename?: string,
    cryptoInstance?: ShareCrypto,
  ) {
    const result = await uploadPublic(newFile, filename, cryptoInstance);
    await API.fileApi.delete(oldFileId);
    return result;
  }

  return { uploadPublic, overwriteUpload };
}
