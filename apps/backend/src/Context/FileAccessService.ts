import { Effect } from 'effect';
import { File as FileModel } from '../../.zenstack/models';
import { MsgError } from '../util/error';
import { FilePathService } from './FilePathService';
import { AppConfigService } from './AppConfig';
import { FileWarpItem } from '../api/authApi/file';

/**
 * 文件访问选项
 */
export interface FileAccessOptions {
  /** 是否检查所有权 */
  checkOwnership?: boolean;
  /** 用户ID（用于所有权检查） */
  userId?: string;
  /** 是否只允许公开文件 */
  publicOnly?: boolean;
}

/**
 * 文件访问结果
 */
export interface FileAccessResult {
  fileRow: FileModel;
  validatedPath: string;
}

/**
 * 文件访问服务 - 提供统一的文件访问逻辑
 *
 * 安全设计参考：https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
 *
 * 这个服务作为文件访问的统一入口，实现了：
 * 1. 文件存在性和状态验证
 * 2. 用户权限验证（所有权、公开状态）
 * 3. 安全的路径解析和边界检查（委托给 FilePathService）
 * 4. 防止路径遍历攻击
 *
 * 所有文件访问操作都应该通过这个服务，而不是直接操作文件路径。
 */
export class FileAccessService {

  /**
   * 验证文件访问权限并返回安全的文件路径
   * @param fileRow 文件记录
   * @param options 访问选项
   * @returns 文件访问结果
   *
   * 安全检查流程：
   * 1. 验证文件记录存在性
   * 2. 根据 publicOnly 检查文件状态
   * 3. 根据 checkOwnership 验证用户所有权
   * 4. 使用 FilePathService 生成并验证安全路径
   *
   * 参考：https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
   */
  static validateFileAccess(
    fileRow: FileModel,
    options: FileAccessOptions = {},
    uploadDir?: string
  ): FileAccessResult {
    const {
      checkOwnership = false,
      userId,
      publicOnly = false
    } = options;

    // 验证文件存在性
    if (!fileRow?.path) {
      throw MsgError.msg('File not found');
    }

    // 检查文件状态
    if (publicOnly===true && fileRow.status !== 'public') {
      throw MsgError.msg('File not found or access denied');
    }

    // 检查所有权
    if (checkOwnership===true && userId && fileRow.authorId !== userId) {
      throw MsgError.msg('Access denied: File ownership verification failed');
    }

    // 如果没有提供 uploadDir，则使用默认值（但应该总是提供）
    const finalUploadDir = uploadDir || process.env.UPLOAD_DIR || './uploads';

    const filePath = FilePathService.generateUserFilePath(
      fileRow.authorId,
      fileRow.path,
      finalUploadDir
    );

    // 验证文件访问权限
    const validatedPath = FilePathService.validateFileAccess(
      filePath,
      finalUploadDir,
      fileRow.authorId
    );

    return {
      fileRow,
      validatedPath
    };
  }

  /**
   * 在 Effect 环境中验证文件访问权限
   * @param fileRow 文件记录
   * @param options 访问选项
   * @returns 文件访问结果
   *
   * 这是一个 Effect 包装器，用于在 Effect 上下文中提供 AppConfigService
   */
  static validateFileAccessEffect(
    fileRow: FileModel,
    options: FileAccessOptions = {}
  ) {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      return FileAccessService.validateFileAccess(fileRow, options, appConfig.uploadDir);
    });
  }

  /**
   * 创建文件包装项（用于流式传输）
   * @param fileRow 文件记录
   * @param options 访问选项
   * @param uploadDir 上传目录（可选）
   * @returns FileWarpItem
   *
   * 返回的 FileWarpItem 包含经过安全验证的文件路径，可以安全地用于文件流传输
   */
  static createFileWarpItem(
    fileRow: FileModel,
    options: FileAccessOptions = {},
    uploadDir?: string
  ): FileWarpItem {
    const { validatedPath } = FileAccessService.validateFileAccess(fileRow, options, uploadDir);

    return new FileWarpItem(validatedPath, fileRow);
  }

  /**
   * 在 Effect 环境中创建文件包装项
   * @param fileRow 文件记录
   * @param options 访问选项
   * @returns FileWarpItem
   *
   * 这是一个 Effect 包装器，用于在 Effect 上下文中提供 AppConfigService
   */
  static createFileWarpItemEffect(
    fileRow: FileModel,
    options: FileAccessOptions = {}
  ) {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      return FileAccessService.createFileWarpItem(fileRow, options, appConfig.uploadDir);
    });
  }
}