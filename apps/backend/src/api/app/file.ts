import { Effect } from 'effect';
import { AuthService } from '../../service/Auth';
import { File as FileModel, FileStatusEnum, StorageType } from '@zenstackhq/runtime/models';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join, resolve } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { MsgError } from '../../util/error';
import { AppConfigService } from '../../service/AppConfigService';
import { ReqCtxService } from '../../service/ReqCtx';
import { createReadStream, createWriteStream } from 'fs';
import { FileWarpItem } from '../api/file';
import { prisma } from '../../db';

export const fileApi = {
  /** 这里同样是为了解决非流式传递导致的内存占用过大问题
   * 通过 FileWarpItem 包装文件路径，http server 层再直接通过路径将文件流式传输给客户端
   * 这样可以避免将整个文件加载到内存中
   */
  file(id: FileModel['id']) {
    return Effect.gen(function* () {
      const fileRow = yield* Effect.promise(() =>
        prisma.file.findUnique({
          where: {
            id,
          },
        }),
      );
      if (fileRow?.status !== FileStatusEnum.public) {
        throw MsgError.msg('File not found or access denied');
      }
      if (!fileRow?.path) {
        throw MsgError.msg('File not found');
      }
      // 读取文件内容,将相对路径转为绝对路径,fastify似乎需要绝对路径
      const filePath = resolve(fileRow.path);

      return new FileWarpItem(
        filePath,
        fileRow,
      ) as unknown as /** 客户端实际接受的是文件而非 FileWarpItem */ File;
    });
  },
};
