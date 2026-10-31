import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { dbTryOrDefault } from '../../util/dbEffect';

const LOG_PREFIX = '[ShareApi]';

export const shareApi = {
  /**
   * 查询分享详情
   * @param key 不可预测的 UUID key（防枚举遍历）。
   * 旧版纯数字自增 id 链接已下线（可枚举遍历他人分享），存量旧链接直接失效。
   */
  detail(key: string) {
    return Effect.flatMap(DbClientEffect, (dbClient) =>
      dbTryOrDefault(
        LOG_PREFIX,
        '查询分享信息',
        () =>
          dbClient.userData.findFirst({
            where: {
              appId: 'shareInfo',
              key,
            },
          }),
        null,
      ),
    );
  },
};
