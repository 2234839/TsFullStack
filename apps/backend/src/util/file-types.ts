import { File as FileModel } from '../../.zenstack/models';
import { createReadStream } from 'fs';

/**
 * 文件包装项 — 将文件路径和元数据打包传递给 HTTP server 层
 * server 层通过 instanceof FileWrapItem 判断是否走流式传输（而非 superJSON 序列化）
 *
 * 定义在 util/ 而非 api/authApi/file 中，避免 Context 层反向依赖 API 层
 */
export class FileWrapItem {
  constructor(
    public path: string,
    public model: FileModel,
  ) {}
  /** 获取完整文件流 */
  public getFileStream() {
    return createReadStream(this.path);
  }
  /** 获取指定字节范围的文件流（支持 HTTP Range requests） */
  public getFileStreamRange(start: number, end: number) {
    return createReadStream(this.path, { start, end });
  }
}
