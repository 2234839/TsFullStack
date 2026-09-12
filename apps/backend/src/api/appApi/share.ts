import { Effect } from "effect";
import { DbClientEffect } from "../../Context/DbService";
import { dbTryOrDefault } from "../../util/dbEffect";

const LOG_PREFIX = "[ShareApi]";

export const shareApi = {
  /**
   * 查询分享详情
   * @param idOrKey 新链接为不可预测的 UUID key（防枚举遍历）；纯数字时兼容旧版自增 id 链接（存量分享不失效）
   */
  detail(idOrKey: string) {
    return Effect.flatMap(DbClientEffect, (dbClient) =>
      dbTryOrDefault(
        LOG_PREFIX,
        "查询分享信息",
        () =>
          dbClient.userData.findFirst({
            where: {
              appId: "shareInfo",
              OR: [{ key: idOrKey }, ...(/^\d+$/.test(idOrKey) ? [{ id: Number(idOrKey) }] : [])],
            },
          }),
        null,
      ),
    );
  },
};
