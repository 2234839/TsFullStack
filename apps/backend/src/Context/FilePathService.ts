import { normalize, join } from 'path/posix';
import { MsgError } from '../util/error';

export class FilePathService {
  static readonly ALLOWED_CHARS = /^[a-zA-Z0-9._-]+$/;
  
  /**
   * 生成安全的用户文件路径
   * @param userId 用户ID
   * @param fileId 文件ID
   * @param baseDir 基础目录
   * @returns 安全的文件路径
   */
  static generateUserFilePath(userId: string, fileId: string, baseDir: string): string {
    // 验证用户ID和文件ID格式
    if (!FilePathService.validateId(userId) || !FilePathService.validateId(fileId)) {
      throw MsgError.msg('Invalid user or file ID format');
    }

    // 构建用户专属目录路径: baseDir/userId/fileId
    const userDir = join(baseDir, userId);
    const filePath = join(userDir, fileId);

    // 规范化路径，防止路径遍历
    const normalizedPath = normalize(filePath);
    
    // 确保路径在基础目录内
    if (!normalizedPath.startsWith(normalize(baseDir))) {
      throw MsgError.msg('Invalid file path');
    }

    return normalizedPath;
  }

  /**
   * 验证文件访问权限
   * @param requestedPath 请求的路径
   * @param baseDir 基础目录
   * @param userId 用户ID
   * @returns 验证结果
   */
  static validateFileAccess(
    requestedPath: string,
    baseDir: string,
    userId: string
  ): string {
    // 规范化路径
    const normalizedPath = normalize(requestedPath);
    const normalizedBaseDir = normalize(baseDir);

    // 验证路径在基础目录内
    if (!normalizedPath.startsWith(normalizedBaseDir)) {
      throw MsgError.msg('Access denied: Invalid path');
    }

    // 验证路径包含用户ID，确保只能访问自己的文件
    const relativePath = normalizedPath.substring(normalizedBaseDir.length);
    const pathSegments = relativePath.split('/').filter(Boolean);
    
    if (pathSegments.length === 0 || pathSegments[0] !== userId) {
      throw MsgError.msg('Access denied: File ownership verification failed');
    }

    return normalizedPath;
  }

  /**
   * 验证ID格式安全性
   * @param id 要验证的ID
   * @returns 是否安全
   */
  private static validateId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    if (id.length > 100) return false; // 防止过长的ID
    return FilePathService.ALLOWED_CHARS.test(id);
  }

  /**
   * 生成安全的文件名
   * @param originalFilename 原始文件名
   * @returns 安全的文件名
   */
  static sanitizeFilename(originalFilename: string): string {
    if (!originalFilename || typeof originalFilename !== 'string') {
      throw MsgError.msg('Invalid filename');
    }

    // 移除路径分隔符和危险字符
    const sanitized = originalFilename
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/^\./, '_') // 防止隐藏文件
      .substring(0, 255); // 限制长度

    if (!sanitized) {
      throw MsgError.msg('Invalid filename after sanitization');
    }

    return sanitized;
  }
}