import { normalize, join, sep } from 'path/posix';
import { MsgError } from '../util/error';

/**
 * 安全的文件路径服务
 *
 * 安全设计参考：https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
 *
 * 这个服务实现了多层防护来防止路径遍历攻击：
 * 1. 输入验证（ID 格式验证，只允许安全字符）
 * 2. 拒绝 null 字节（用于绕过扩展名检查）
 * 3. 路径规范化（处理 . 和 ..）
 * 4. 严格的边界检查（防止路径遍历）
 */
export class FilePathService {
  static readonly ALLOWED_CHARS = /^[a-zA-Z0-9._-]+$/;
  
  /**
   * 生成安全的用户文件路径
   * @param userId 用户ID
   * @param fileId 文件ID
   * @param baseDir 基础目录
   * @returns 安全的文件路径
   *
   * 安全措施：
   * - 验证 ID 格式，只允许安全字符
   * - 使用 path.join 构建路径
   * - 规范化路径并验证边界
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
    // 使用 sep 防止 /uploads-backup 攻绕过检查
    const normalizedBaseDir = normalize(baseDir);
    if (!normalizedPath.startsWith(normalizedBaseDir + sep)) {
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
   *
   * 安全措施：
   * - 拒绝 null 字节
   * - 验证路径在基础目录内
   * - 验证用户只能访问自己的文件
   *
   * 注意：不需要 URL 解码，因为：
   * 1. 最终去向是 fs 模块，它不会自动解码 URL 编码
   * 2. 如果路径中包含 %20 这样的字符，fs 会按字面意思处理
   *
   * 参考：https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
   */
  static validateFileAccess(
    requestedPath: string,
    baseDir: string,
    userId: string
  ): string {
    // 拒绝 null 字节（用于绕过扩展名检查）
    if (requestedPath.includes('\0')) {
      throw MsgError.msg('Null bytes not allowed');
    }

    // 规范化路径
    const normalizedPath = normalize(requestedPath);
    const normalizedBaseDir = normalize(baseDir);

    // 验证路径在基础目录内
    if (!normalizedPath.startsWith(normalizedBaseDir + sep)) {
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
   *
   * 验证规则：
   * - 必须是非空字符串
   * - 长度不超过 100 个字符（防止 DoS）
   * - 只包含字母、数字、点、下划线、连字符
   *
   * 参考：https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
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
   *
   * 安全措施：
   * - 拒绝 null 字节
   * - 移除路径分隔符和危险字符
   * - 防止隐藏文件攻击（以 . 开头的文件）
   * - 限制文件名长度
   *
   * 参考：https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
   */
  static sanitizeFilename(originalFilename: string): string {
    if (!originalFilename || typeof originalFilename !== 'string') {
      throw MsgError.msg('Invalid filename');
    }

    // 拒绝 null 字节（用于绕过扩展名检查）
    if (originalFilename.includes('\0')) {
      throw MsgError.msg('Null bytes not allowed in filename');
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