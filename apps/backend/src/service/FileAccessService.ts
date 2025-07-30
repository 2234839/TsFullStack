import { Effect } from 'effect';
import { File as FileModel } from '@zenstackhq/runtime/models';
import { MsgError } from '../util/error';
import { FilePathService } from '../service/FilePathService';
import { AppConfigService } from './AppConfigService';
import { FileWarpItem } from '../api/api/file';

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
 */
export class FileAccessService {
  
  /**
   * 验证文件访问权限并返回安全的文件路径
   * @param fileRow 文件记录
   * @param options 访问选项
   * @returns 文件访问结果
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
    if (publicOnly && fileRow.status !== 'public') {
      throw MsgError.msg('File not found or access denied');
    }

    // 检查所有权
    if (checkOwnership && userId && fileRow.authorId !== userId) {
      throw MsgError.msg('Access denied: File ownership verification failed');
    }

    // 如果不是公开文件且不是所有者，拒绝访问
    if (!publicOnly && fileRow.status !== 'public') {
      if (!checkOwnership || !userId || fileRow.authorId !== userId) {
        throw MsgError.msg('Access denied: File ownership verification failed');
      }
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