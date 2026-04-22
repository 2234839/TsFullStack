import { File as FileModel } from '../../../.zenstack/models';
import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { FileAccessService } from '../../Context/FileAccessService';
import { dbTryOrDefault } from '../../util/dbEffect';
import { MsgError } from '../../util/error';

export const fileApi = {
  /** 这里同样是为了解决非流式传递导致的内存占用过大问题
   * 通过 FileWrapItem 包装文件路径，http server 层再直接通过路径将文件流式传输给客户端
   * 这样可以避免将整个文件加载到内存中
   */
  file(id: FileModel['id']) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const fileRow = yield* dbTryOrDefault('[FileApi]', '查询文件', () =>
        dbClient.file.findUnique({
          where: { id },
        }),
        null,
      );

      if (!fileRow) throw MsgError.msg('文件不存在');

      const fileWarpItem = yield* FileAccessService.createFileWrapItemEffect(fileRow, {
        checkOwnership: false,
        publicOnly: true,
      });

      return fileWarpItem as unknown as File;
    });
  },
};
