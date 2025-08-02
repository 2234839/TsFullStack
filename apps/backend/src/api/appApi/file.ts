import { File as FileModel } from '@zenstackhq/runtime/models';
import { Effect } from 'effect';
import { PrismaService } from '../../Context/PrismaService';
import { FileAccessService } from '../../Context/FileAccessService';

export const fileApi = {
  /** 这里同样是为了解决非流式传递导致的内存占用过大问题
   * 通过 FileWarpItem 包装文件路径，http server 层再直接通过路径将文件流式传输给客户端
   * 这样可以避免将整个文件加载到内存中
   */
  file(id: FileModel['id']) {
    return Effect.gen(function* () {
      const { prisma } = yield* PrismaService;
      const fileRow = yield* Effect.promise(() =>
        prisma.file.findUnique({
          where: {
            id,
          },
        }),
      );

      // 使用文件访问服务验证权限并获取安全路径
      const fileWarpItem = yield* FileAccessService.createFileWarpItemEffect(fileRow!, {
        checkOwnership: false,
        publicOnly: true,
      });

      return fileWarpItem as unknown as File;
    });
  },
};
