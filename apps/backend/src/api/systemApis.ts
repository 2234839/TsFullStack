import { Effect } from "effect";
import { ModelMeta } from "../db/model-meta";
import { DbClientEffect } from "../Context/DbService";
import { AuthContext } from "../Context/Auth";
import { dbTry } from "../util/dbEffect";
import { ReqCtxService } from "../Context/ReqCtx";

export const systemApis = {
  getModelMeta() {
    return ModelMeta;
  },

  /**
   * 登出：删除当前登录会话（服务端撤销 session token）
   * 之前登出只清前端 localStorage，token 在服务端仍有效至过期，存在被窃取后无法撤销的风险。
   * 需通过 /api/ 鉴权路径调用（AuthContext 提供当前用户与 session）。
   */
  logout() {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const dbClient = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;

      /** 撤销该用户当前有效的全部会话（简单可靠：避免依赖前端传回 session id） */
      const result = yield* dbTry("[SystemApi]", "撤销用户会话", () =>
        dbClient.userSession.deleteMany({
          where: {
            userId: user.id,
            expiresAt: { gt: new Date() },
          },
        }),
      );

      reqCtx.log("[SystemApi] logout, userId=", user.id, "revoked=", result.count);
      return { success: true as const, revokedSessions: result.count };
    });
  },
};
