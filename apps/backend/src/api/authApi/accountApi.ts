import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { AppConfigService } from '../../Context/AppConfig';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AuthContext } from '../../Context/Auth';
import { fail, tryOrFail } from '../../util/error';
import { comparePassword } from '../../util/crypto';
import { PasscodeService } from '../../services/PasscodeService';
import { registerMergeTicket, consumeMergeTicket, type PasscodeOfficialView } from '../appApi/passcode';
import { githubApi } from '../appApi/github';
import { linuxdoApi } from '../appApi/linuxdo';
import { OauthProvider } from '../../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[AccountApi]';

/** 防密码验证爆破：随机延迟毫秒数 */
const VERIFY_DELAY_MS = 500;

/** 防爆破随机延迟 */
function randomDelay() {
  return Effect.promise(() => new Promise((r) => setTimeout(r, VERIFY_DELAY_MS + Math.random() * VERIFY_DELAY_MS)));
}

/** 已绑定登录方式视图 */
export interface BindingView {
  provider: 'GITHUB' | 'LINUXDO' | 'WECHAT';
  /** 第三方标识脱敏展示 */
  maskedId: string;
  createdAt: Date;
}

/** 当前账号登录方式总览 */
export interface MyLoginMethodsView {
  /** 邮箱密码登录是否可用（伪邮箱 @oauth.local 不可用） */
  emailLogin: boolean;
  /** 用户主动禁用了密码登录（仅渠道登录，类似可信设备授权） */
  passwordLoginDisabled: boolean;
  email: string;
  bindings: BindingView[];
}

/**
 * 账号管理 API —— 需要登录态的账号安全操作（/api/ 鉴权路径）。
 * 匿名流程（登录、OAuth 回调、口令轮询）在 app-api 的 passcodeApi。
 */
export const accountApi = {
  /**
   * 查询当前账号的登录方式总览。
   */
  myLoginMethods() {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const db = yield* DbClientEffect;
      const full = yield* tryOrFail(`${LOG_PREFIX} 查询用户登录方式`, () =>
        db.user.findUnique({ where: { id: user.id }, include: { oAuthAccount: true } }),
      );
      if (!full) return yield* fail('用户不存在');

      const view: MyLoginMethodsView = {
        emailLogin: !full.email.endsWith('@oauth.local'),
        passwordLoginDisabled: full.passwordLoginDisabled,
        email: full.email,
        bindings: full.oAuthAccount.map((acc) => ({
          provider: acc.provider,
          maskedId: acc.providerId.length > 6 ? `${acc.providerId.slice(0, 4)}****` : '****',
          createdAt: acc.created,
        })),
      };
      return view;
    });
  },

  /**
   * 解绑当前账号的一个第三方登录方式。
   * 保护：解绑后必须至少保留一种可用登录方式（其他绑定，或未禁用的真实邮箱密码）。
   */
  unbind(provider: 'GITHUB' | 'LINUXDO' | 'WECHAT') {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const db = yield* DbClientEffect;
      const full = yield* tryOrFail(`${LOG_PREFIX} 查询用户`, () =>
        db.user.findUnique({ where: { id: user.id }, include: { oAuthAccount: true } }),
      );
      if (!full) return yield* fail('用户不存在');

      const rest = full.oAuthAccount.filter((acc) => acc.provider !== provider);
      const emailLoginUsable = !full.email.endsWith('@oauth.local') && !full.passwordLoginDisabled;
      if (rest.length === 0 && !emailLoginUsable) {
        return yield* fail('解绑后将没有任何登录方式，请先绑定其他渠道或恢复密码登录');
      }

      yield* tryOrFail(`${LOG_PREFIX} 解绑 ${provider}`, () =>
        db.oAuthAccount.deleteMany({ where: { userId: user.id, provider } }),
      );
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 解绑 ${provider} userId=${user.id}`);
    });
  },

  /** 发起微信绑定：purpose=BIND，payload 记录发起者 userId，匿名轮询接口凭票据完成绑定 */
  createWechatBind() {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const appConfig = yield* AppConfigService;
      if (!appConfig.wechat) {
        return yield* fail('微信公众号未配置，微信绑定不可用');
      }

      /** 检查当前账号是否已绑微信（一个账号绑一个微信即可） */
      const db = yield* DbClientEffect;
      const existed = yield* tryOrFail(`${LOG_PREFIX} 查询已有微信绑定`, () =>
        db.oAuthAccount.findFirst({ where: { userId: user.id, provider: OauthProvider.WECHAT } }),
      );
      if (existed) return yield* fail('当前账号已绑定微信，请先解绑后再绑定新的');

      const record = yield* PasscodeService.create('WECHAT_OFFICIAL', 'BIND', { userId: user.id });

      /** 公众号引导：任一空间后台上传过公众号码即用其路由，否则回退 config 的外部 URL */
      const space = yield* tryOrFail(`${LOG_PREFIX} 查询公众号引导`, () =>
        db.groupSpace.findFirst({
          where: { officialQrImagePath: { not: null } },
          orderBy: { sortOrder: 'asc' },
        }),
      );
      const official: PasscodeOfficialView = {
        name: space?.officialName || appConfig.groupEntry?.officialAccountName || '公众号',
        qrUrl: space ? `/group/official-qr/${space.name}.png` : (appConfig.groupEntry?.officialAccountQrUrl ?? null),
      };

      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 发起微信绑定 userId=${user.id}`);
      return { code: record.code, ticket: record.ticket, expiresAt: record.expiresAt, official };
    });
  },

  /**
   * 发起第三方渠道绑定授权跳转（github/linuxdo 统一入口）。
   */
  getBindAuthorizationUrl(provider: 'github' | 'linuxdo') {
    return Effect.gen(function* () {
      return yield* provider === 'github' ? githubApi.getBindAuthorizationUrl() : linuxdoApi.getBindAuthorizationUrl();
    });
  },

  /**
   * 账号合并（邮箱密码方式验证被合并账号）：凭据验证通过后只合并登录关系（OAuth 绑定），
   * 被合并账号成为无法登录的幽灵账号，业务数据不自动迁移（需要时找管理员处理）。
   * 被合并账号禁用密码登录时密码不作为有效验证因子。
   */
  mergeIntoAccount(mergedEmail: string, mergedPassword: string) {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const db = yield* DbClientEffect;
      const merged = yield* tryOrFail(`${LOG_PREFIX} 查询被合并账号`, () =>
        db.user.findUnique({ where: { email: mergedEmail } }),
      );

      /** 防爆破：无论账号存在与否都消耗随机时间 */
      yield* randomDelay();
      if (!merged) return yield* fail('被合并账号不存在');
      if (merged.id === user.id) return yield* fail('不能合并当前账号自己');
      if (merged.passwordLoginDisabled) {
        return yield* fail('该账号用户已禁用密码登录，密码不再作为有效验证因子');
      }

      const passwordOk = yield* comparePassword(mergedPassword, merged.password);
      if (!passwordOk) return yield* fail('被合并账号密码错误');

      return yield* executeMerge(user.id, merged.id);
    });
  },

  /**
   * 凭一次性合并票据执行合并：票据由渠道验证成功时服务端签发（app-api 匿名回调），
   * 原子消费后用票据内携带的渠道身份定位被合并账号。
   * 安全性：服务端不信任前端传入的 providerId（可枚举伪造），只认渠道验证后发出的票据。
   */
  mergeByMergeTicket(mergeTicket: string) {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const identity = consumeMergeTicket(mergeTicket);
      if (!identity) return yield* fail('合并票据无效或已过期，请重新验证');

      const db = yield* DbClientEffect;
      const binding = yield* tryOrFail(`${LOG_PREFIX} 查询渠道身份归属`, () =>
        db.oAuthAccount.findFirst({
          where: { provider: identity.provider, providerId: identity.providerId },
        }),
      );
      if (!binding) return yield* fail('该渠道未绑定任何账号');
      if (binding.userId === user.id) return yield* fail('该渠道已绑定当前账号，无需合并');

      return yield* executeMerge(user.id, binding.userId);
    });
  },

  /**
   * 设置禁用/恢复账号密码登录（类似可信设备授权）：
   * - 禁用：必须至少绑定一个第三方渠道
   * - 任何开关操作都验证当前密码，确保本人操作
   */
  setPasswordLoginDisabled(disabled: boolean, password: string) {
    return Effect.gen(function* () {
      const { user } = yield* AuthContext;
      const db = yield* DbClientEffect;
      const full = yield* tryOrFail(`${LOG_PREFIX} 查询用户(密码开关)`, () =>
        db.user.findUnique({ where: { id: user.id }, include: { oAuthAccount: true } }),
      );
      if (!full) return yield* fail('用户不存在');
      if (full.passwordLoginDisabled === disabled) return { status: 'OK' as const };

      yield* randomDelay();
      const passwordOk = yield* comparePassword(password, full.password);
      if (!passwordOk) return yield* fail('密码错误');

      if (disabled) {
        if (full.email.endsWith('@oauth.local')) {
          return yield* fail('OAuth 创建的账号本就无密码登录，无需设置');
        }
        if (full.oAuthAccount.length === 0) {
          return yield* fail('请先绑定至少一个第三方登录渠道，否则禁用后将无法登录');
        }
      }

      yield* tryOrFail(`${LOG_PREFIX} 更新密码登录开关`, () =>
        db.user.update({ where: { id: user.id }, data: { passwordLoginDisabled: disabled } }),
      );
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 密码登录开关 disabled=${disabled} userId=${user.id}`);
      return { status: 'OK' as const };
    });
  },
};

/**
 * 合并事务执行体：只合并登录关系，不做业务数据迁移。
 * 源账号的 OAuth 绑定迁给当前账号后，源账号变成幽灵账号——删除全部会话、禁用密码登录，
 * 之后无法通过任何方式登录；其历史业务数据原地保留，确实需要迁移数据时由管理员在后台处理。
 */
function executeMerge(targetUserId: string, sourceUserId: string) {
  return Effect.gen(function* () {
    const db = yield* DbClientEffect;
    const target = yield* tryOrFail(`${LOG_PREFIX} 查询当前账号(接收方)`, () =>
      db.user.findUnique({
        where: { id: targetUserId },
        include: { oAuthAccount: true },
      }),
    );
    if (!target) return yield* fail('当前账号不存在');
    const source = yield* tryOrFail(`${LOG_PREFIX} 查询被合并账号`, () =>
      db.user.findUnique({
        where: { id: sourceUserId },
        include: { oAuthAccount: true },
      }),
    );
    if (!source) return yield* fail('被合并账号不存在');

    /**
     * 事务内只做登录关系迁移（源 → 目标），不做业务数据迁移：
     * - OAuthAccount 同 provider 已被目标绑定时丢弃源的该条（目标优先）
     * - 源账号会话全部失效 + 禁用密码登录，成为无法登录的幽灵账号
     * - 业务数据（token/task/order 等）原地保留在幽灵账号上；确实需要迁移数据时由管理员在后台处理，
     *   避免以后新建表时遗漏这里的迁移清单导致数据丢失
     */
    yield* tryOrFail(`${LOG_PREFIX} 执行合并事务`, () =>
      db.$transaction(async (tx) => {
        const targetProviders = new Set(target.oAuthAccount.map((acc) => acc.provider));
        const sourceAccounts = source.oAuthAccount;
        const keepAccounts = sourceAccounts.filter((acc) => !targetProviders.has(acc.provider));
        const dropAccountIds = sourceAccounts.filter((acc) => targetProviders.has(acc.provider)).map((acc) => acc.id);
        if (dropAccountIds.length > 0) {
          await tx.oAuthAccount.deleteMany({ where: { id: { in: dropAccountIds } } });
        }
        if (keepAccounts.length > 0) {
          await tx.oAuthAccount.updateMany({
            where: { id: { in: keepAccounts.map((a) => a.id) } },
            data: { userId: target.id },
          });
        }

        await tx.userSession.deleteMany({ where: { userId: source.id } });
        await tx.user.update({
          where: { id: source.id },
          data: { passwordLoginDisabled: true },
        });
      }),
    );

    const reqCtx = yield* ReqCtxService;
    reqCtx.log(
      `${LOG_PREFIX} 登录关系合并 ${source.id} -> ${target.id}（当前账号为接收方，源账号成为幽灵账号，数据未迁移）`,
    );
    return { status: 'MERGED' as const };
  });
}
