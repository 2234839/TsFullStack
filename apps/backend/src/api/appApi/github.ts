import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { Effect, Option } from 'effect';
import { fail, requireOrFail } from '../../util/error';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AuthContext } from '../../Context/Auth';
import { dbTry } from '../../util/dbEffect';
import { hashPassword } from '../../util/crypto';
import { GithubAuthService } from '../../OAuth/github';
import { genUserSession } from './_genUserSession';
import {
  generateSecureRandomPassword,
  generateFakeEmail,
  setOAuthStateCookie,
  verifyOAuthStateCookie,
} from './_oauthUtil';
import { registerMergeTicket } from './passcode';

/** 日志前缀 */
const LOG_PREFIX = '[GithubApi]';

/**
 * 读取当前登录用户 ID（无鉴权分支不提供 AuthContext，用 serviceOption 安全读取）
 * null 表示未登录
 */
const currentUserId = () =>
  Effect.map(Effect.serviceOption(AuthContext), (opt) => (Option.isSome(opt) ? opt.value.user.id : null));

/** 通过 Github 登录 */
export const githubApi = {
  getAuthorizationUrl() {
    return Effect.gen(function* () {
      const auth = yield* githubAuth;
      const url = yield* auth.getAuthorizationUrl();
      /** state 绑定当前浏览器（httpOnly cookie），回调时校验，防 login CSRF */
      const state = new URL(url).searchParams.get('state') ?? '';
      const reqCtx = yield* ReqCtxService;
      setOAuthStateCookie(reqCtx, 'github', state);
      return url;
    });
  },
  /** 发起 GitHub 绑定（需登录态）：state 标记绑定意图，回调走绑定分支 */
  getBindAuthorizationUrl() {
    return Effect.gen(function* () {
      const userId = yield* currentUserId();
      if (!userId) return yield* fail('请先登录');
      const auth = yield* githubAuth;
      const url = yield* auth.getAuthorizationUrl('bind', userId);
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 发起 GitHub 绑定 userId=${userId}`);
      return url;
    });
  },
  /** 发起 GitHub 合并验证：state 标记合并验证意图，回调只验证身份不改动数据 */
  getMergeAuthorizationUrl() {
    return Effect.gen(function* () {
      const auth = yield* githubAuth;
      const url = yield* auth.getAuthorizationUrl('merge');
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 发起 GitHub 合并验证`);
      return url;
    });
  },
  authenticate(code: string, state?: string) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;
      /** 回调浏览器必须携带发起时种下的 state cookie，防止攻击者预签 state 诱导登录（login CSRF） */
      if (!verifyOAuthStateCookie(reqCtx, 'github', state)) {
        return yield* fail('登录会话已失效，请重新发起登录');
      }
      const auth = yield* githubAuth;
      const { user: githubUser, bind, intent, initiatorUserId } = yield* auth.authenticate(code, state);

      /** 合并验证意图：认证成功即代表被合并账号身份确认，返回其归属供前端发起合并，不建号不发 session */
      if (intent === 'merge') {
        const owner = yield* dbTry(LOG_PREFIX, '查询 GitHub 归属(merge)', () =>
          dbClient.oAuthAccount.findFirst({
            where: { provider: OauthProvider.GITHUB, providerId: String(githubUser.id) },
          }),
        );
        if (!owner) {
          return yield* fail('该 GitHub 未绑定任何账号，无需合并验证');
        }
        reqCtx.log(`${LOG_PREFIX} GitHub 合并验证通过 providerUserId=${githubUser.id}，登记票据`);
        return { mergeVerified: true, mergeTicket: yield* registerMergeTicket('GITHUB', String(githubUser.id)) };
      }

      /** 绑定意图：把 GitHub 身份挂到当前登录账号，不建号不发 session */
      if (bind) {
        const userId = yield* currentUserId();
        if (!userId) return yield* fail('绑定需要先登录');
        /** 发起绑定者与完成回调者必须是同一账号，防止诱导他人完成绑定（CSRF） */
        if (!initiatorUserId || initiatorUserId !== userId) {
          return yield* fail('绑定会话已失效，请重新发起绑定');
        }

        const owner = yield* dbTry(LOG_PREFIX, '查询 GitHub 归属', () =>
          dbClient.oAuthAccount.findFirst({
            where: { provider: OauthProvider.GITHUB, providerId: String(githubUser.id) },
          }),
        );
        if (owner) {
          return yield* fail(
            owner.userId === userId ? '该 GitHub 已绑定当前账号' : '该 GitHub 已绑定其他账号，请先在对方账号解绑',
          );
        }

        yield* dbTry(LOG_PREFIX, '绑定 GitHub', () =>
          dbClient.oAuthAccount.create({
            data: {
              userId,
              provider: OauthProvider.GITHUB,
              providerId: String(githubUser.id),
              profile: githubUser as unknown as JsonValue,
            },
          }),
        );
        reqCtx.log(`${LOG_PREFIX} GitHub 绑定成功 userId=${userId}`);
        return { bound: true };
      }

      let user = yield* dbTry(LOG_PREFIX, '查询用户', () =>
        dbClient.user.findFirst({
          where: {
            oAuthAccount: {
              some: {
                provider: OauthProvider.GITHUB,
                providerId: String(githubUser.id),
              },
            },
          },
          include: { role: true },
        }),
      );

      if (!user) {
        /** 为 OAuth 用户生成随机密码并哈希处理（用户不会通过密码登录，但需要满足数据库约束） */
        const randomPassword = generateSecureRandomPassword();
        const hashedPassword = yield* hashPassword(randomPassword);

        user = yield* dbTry(LOG_PREFIX, '创建用户', () =>
          dbClient.user.create({
            data: {
              email: generateFakeEmail(),
              password: hashedPassword,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.GITHUB,
                  providerId: String(githubUser.id),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  /** GitHubUser → JsonValue: ZenStack profile 字段要求 JsonValue 类型，运行时结构兼容 */
                  profile: githubUser as unknown as JsonValue,
                },
              },
            },
            include: { role: true },
          }),
        );
      }

      /** TypeScript 类型收窄：上面已经确保 user 不为 null */
      user = yield* requireOrFail(user, '用户创建失败');

      const userId = user.id;
      const userSession = yield* genUserSession(userId);
      reqCtx.log(`${LOG_PREFIX} user login by github`, userId);

      return {
        id: userSession.id,
        token: userSession.token,
        expiresAt: userSession.expiresAt,
        userId: userSession.userId,
        created: userSession.created,
        updated: userSession.updated,
        user: (() => {
          const { password: _, ...rest } = user;
          return rest;
        })(),
      };
    });
  },
};

const githubAuth = GithubAuthService;
