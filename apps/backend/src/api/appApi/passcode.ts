import { Effect, Option } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { AppConfigService } from '../../Context/AppConfig';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AuthContext } from '../../Context/Auth';
import { fail, tryOrFail, requireOrFail } from '../../util/error';
import { comparePassword } from '../../util/crypto';
import { PasscodeService } from '../../services/PasscodeService';
import { genUserSession } from './_genUserSession';
import { generateSecureRandomPassword, generateFakeEmail } from './_oauthUtil';
import { hashPassword } from '../../util/crypto';
import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import type { User, Role, UserSession } from '../../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[PasscodeApi]';

/** 防口令/密码验证爆破：随机延迟毫秒数 */
const VERIFY_DELAY_MS = 500;

/**
 * 读取当前登录用户 ID（app-api 无鉴权分支不提供 AuthContext，用 serviceOption 安全读取）
 * null 表示未登录
 */
const currentUserId = () =>
  Effect.map(Effect.serviceOption(AuthContext), (opt) => (Option.isSome(opt) ? opt.value.user.id : null));

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
  email: string;
  bindings: BindingView[];
}

/** 轮询状态结果（未完成验证时） */
export interface PasscodePendingView {
  status: 'PENDING' | 'EXPIRED';
  /** 过期时间（前端倒计时用） */
  expiresAt: Date;
}

/** 登录成功结果（与 loginByEmailPwd 返回同形） */
export interface PasscodeLoginView extends UserSession {
  user: Omit<User & { role: Role[] }, 'password'>;
}

/** 创建口令时附带的公众号引导信息 */
export interface PasscodeOfficialView {
  /** 公众号名称 */
  name: string;
  /** 公众号二维码地址（后台上传优先，回退 config） */
  qrUrl: string | null;
}

/**
 * 口令 API —— 通道无关的验证底座对外接口（无需登录态）。
 * 安全模型：ticket 是 secret，仅发起方持有；code 一次性、5 分钟过期、通道内唯一。
 */
export const passcodeApi = {
  /**
   * 发起微信口令登录：生成 6 位口令 + 轮询票据，附带公众号引导信息。
   * 未配置 wechat 时报错（前端据此隐藏入口）。
   */
  createWechatLogin(): Effect.Effect<
    { code: string; ticket: string; expiresAt: Date; official: PasscodeOfficialView },
    Error,
    AppConfigService | ReqCtxService
  > {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      if (!appConfig.wechat) {
        return yield* fail('微信公众号未配置，口令登录不可用');
      }
      const record = yield* PasscodeService.create('WECHAT_OFFICIAL', 'LOGIN');

      /** 公众号引导：任一空间后台上传过公众号码即用其路由，否则回退 config 的外部 URL */
      const db = yield* DbClientEffect;
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
      reqCtx.log(`${LOG_PREFIX} 发起微信口令登录 id=${record.id}`);
      return { code: record.code, ticket: record.ticket, expiresAt: record.expiresAt, official };
    });
  },

  /**
   * 轮询验证状态：VERIFIED 时原子消费并完成登录（绑定/创建用户 + 发 session）。
   * 返回值二态：pending（未完成）或 login（登录成功，与 loginByEmailPwd 同形）。
   */
  checkWechatLogin(
    ticket: string,
  ): Effect.Effect<
    PasscodePendingView | { status: 'LOGIN'; login: PasscodeLoginView },
    Error,
    AppConfigService | ReqCtxService
  > {
    return Effect.gen(function* () {
      const record = yield* PasscodeService.findByTicket(ticket);
      if (!record) return yield* fail('口令不存在或已失效');

      if (record.status !== 'CONSUMED' && record.expiresAt.getTime() < Date.now()) {
        return { status: 'EXPIRED', expiresAt: record.expiresAt };
      }
      if (record.status === 'PENDING') {
        return { status: 'PENDING', expiresAt: record.expiresAt };
      }
      if (record.status === 'CONSUMED') {
        /** 已被并发请求消费：本票据的登录结果只能拿一次，后到者视为失效 */
        return yield* fail('口令已使用，请重新发起');
      }

      /** VERIFIED：原子消费，消费成功者独享登录结果 */
      const consumed = yield* PasscodeService.consume(ticket);
      if (!consumed || !consumed.channelIdentity) {
        return yield* fail('口令已被使用，请重新发起');
      }
      const openid = consumed.channelIdentity;

      const db = yield* DbClientEffect;
      let user = yield* tryOrFail(`${LOG_PREFIX} 查询微信绑定用户`, () =>
        db.user.findFirst({
          where: {
            oAuthAccount: { some: { provider: OauthProvider.WECHAT, providerId: openid } },
          },
          include: { role: true },
        }),
      );

      if (!user) {
        /** 首次微信登录：创建账号并绑定（与 GitHub OAuth 同款流程） */
        const hashedPassword = yield* hashPassword(generateSecureRandomPassword());
        user = yield* tryOrFail(`${LOG_PREFIX} 创建微信用户`, () =>
          db.user.create({
            data: {
              email: generateFakeEmail(),
              password: hashedPassword,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.WECHAT,
                  providerId: openid,
                  profile: { channel: 'WECHAT_OFFICIAL' } as unknown as JsonValue,
                },
              },
            },
            include: { role: true },
          }),
        );
      }
      user = yield* requireOrFail(user, '用户创建失败');

      const session = yield* genUserSession(user.id);
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 微信口令登录成功 userId=${user.id}`);

      const { password: _pwd, ...userWithoutPassword } = user;
      return { status: 'LOGIN', login: { ...session, user: userWithoutPassword } };
    });
  },

  /**
   * 查询当前账号的登录方式总览（需登录态）。
   */
  myLoginMethods(): Effect.Effect<MyLoginMethodsView, Error, AppConfigService | ReqCtxService> {
    return Effect.gen(function* () {
      const userId = yield* currentUserId();
      if (!userId) return yield* fail('请先登录');

      const db = yield* DbClientEffect;
      const user = yield* tryOrFail(`${LOG_PREFIX} 查询用户登录方式`, () =>
        db.user.findUnique({ where: { id: userId }, include: { oAuthAccount: true } }),
      );
      if (!user) return yield* fail('用户不存在');

      const view: MyLoginMethodsView = {
        emailLogin: !user.email.endsWith('@oauth.local'),
        email: user.email,
        bindings: user.oAuthAccount.map((acc) => ({
          provider: acc.provider,
          maskedId: acc.providerId.length > 6 ? `${acc.providerId.slice(0, 4)}****` : '****',
          createdAt: acc.created,
        })),
      };
      return view;
    });
  },

  /**
   * 发起微信绑定（需登录态）：当前账号发起，purpose=BIND，payload 记录发起者 userId。
   */
  createWechatBind(): Effect.Effect<
    { code: string; ticket: string; expiresAt: Date; official: PasscodeOfficialView },
    Error,
    AppConfigService | ReqCtxService
  > {
    return Effect.gen(function* () {
      const userId = yield* currentUserId();
      if (!userId) return yield* fail('请先登录');

      const appConfig = yield* AppConfigService;
      if (!appConfig.wechat) {
        return yield* fail('微信公众号未配置，微信绑定不可用');
      }

      /** 检查当前账号是否已绑微信（一个账号绑一个微信即可） */
      const db = yield* DbClientEffect;
      const existed = yield* tryOrFail(`${LOG_PREFIX} 查询已有微信绑定`, () =>
        db.oAuthAccount.findFirst({ where: { userId, provider: OauthProvider.WECHAT } }),
      );
      if (existed) return yield* fail('当前账号已绑定微信，请先解绑后再绑定新的');

      const record = yield* PasscodeService.create('WECHAT_OFFICIAL', 'BIND', { userId });

      /** 公众号引导信息（与登录同一套逻辑） */
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
      reqCtx.log(`${LOG_PREFIX} 发起微信绑定 userId=${userId}`);
      return { code: record.code, ticket: record.ticket, expiresAt: record.expiresAt, official };
    });
  },

  /**
   * 轮询微信绑定结果：VERIFIED 时原子消费并把 openid 挂到发起账号（payload.userId）。
   * 该微信已绑定任何账号时报错。
   */
  checkWechatBind(
    ticket: string,
  ): Effect.Effect<PasscodePendingView | { status: 'BOUND' }, Error, AppConfigService | ReqCtxService> {
    return Effect.gen(function* () {
      const record = yield* PasscodeService.findByTicket(ticket);
      if (!record) return yield* fail('口令不存在或已失效');
      if (record.purpose !== 'BIND') return yield* fail('口令用途不匹配');

      if (record.status !== 'CONSUMED' && record.expiresAt.getTime() < Date.now()) {
        return { status: 'EXPIRED', expiresAt: record.expiresAt };
      }
      if (record.status === 'PENDING') {
        return { status: 'PENDING', expiresAt: record.expiresAt };
      }
      if (record.status === 'CONSUMED') {
        return yield* fail('口令已使用，请重新发起');
      }

      /** VERIFIED：原子消费，消费成功者独享结果 */
      const consumed = yield* PasscodeService.consume(ticket);
      if (!consumed || !consumed.channelIdentity) {
        return yield* fail('口令已被使用，请重新发起');
      }
      const openid = consumed.channelIdentity;
      /** 发起绑定的账号（以口令 payload 为准，而非当前会话） */
      const payload = (consumed.payload ?? {}) as { userId?: string };
      /** 发起绑定的账号（以口令 payload 为准，而非当前会话） */
      const bindUserId = payload.userId;
      if (!bindUserId) return yield* fail('口令数据异常，请重新发起');

      const db = yield* DbClientEffect;
      const owner = yield* tryOrFail(`${LOG_PREFIX} 查询微信归属`, () =>
        db.oAuthAccount.findFirst({ where: { provider: OauthProvider.WECHAT, providerId: openid } }),
      );
      if (owner) {
        return yield* fail(
          owner.userId === bindUserId ? '该微信已绑定当前账号' : '该微信已绑定其他账号，请先在对方账号解绑',
        );
      }

      yield* tryOrFail(`${LOG_PREFIX} 绑定微信`, () =>
        db.oAuthAccount.create({
          data: {
            userId: bindUserId,
            provider: OauthProvider.WECHAT,
            providerId: openid,
            profile: { channel: 'WECHAT_OFFICIAL' } as unknown as JsonValue,
          },
        }),
      );

      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 微信绑定成功 userId=${bindUserId}`);
      return { status: 'BOUND' };
    });
  },

  /**
   * 解绑当前账号的一个第三方登录方式（需登录态）。
   * 保护：解绑后必须至少保留一种可用登录方式（其他绑定，或真实邮箱密码）。
   */
  unbind(provider: 'GITHUB' | 'LINUXDO' | 'WECHAT'): Effect.Effect<void, Error, AppConfigService | ReqCtxService> {
    return Effect.gen(function* () {
      const userId = yield* currentUserId();
      if (!userId) return yield* fail('请先登录');

      const db = yield* DbClientEffect;
      const user = yield* tryOrFail(`${LOG_PREFIX} 查询用户`, () =>
        db.user.findUnique({ where: { id: userId }, include: { oAuthAccount: true } }),
      );
      if (!user) return yield* fail('用户不存在');

      const rest = user.oAuthAccount.filter((acc) => acc.provider !== provider);
      const emailLoginUsable = !user.email.endsWith('@oauth.local');
      if (rest.length === 0 && !emailLoginUsable) {
        return yield* fail('解绑后将没有任何登录方式，请先绑定邮箱或保留至少一种登录方式');
      }

      yield* tryOrFail(`${LOG_PREFIX} 解绑 ${provider}`, () =>
        db.oAuthAccount.deleteMany({ where: { userId, provider } }),
      );
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 解绑 ${provider} userId=${userId}`);
    });
  },

  /**
   * 账号合并（需登录态）：当前账号（源，数据并入目标）并入目标账号。
   * 通过目标账号的邮箱+密码验证所有权；事务内把源账号全部数据 reassign 给目标后删除源账号。
   * 返回目标账号的新会话（前端直接 loginGoto，当前会话随源账号一并失效）。
   */
  mergeIntoAccount(
    targetEmail: string,
    targetPassword: string,
  ): Effect.Effect<{ status: 'MERGED'; login: PasscodeLoginView }, Error, AppConfigService | ReqCtxService> {
    return Effect.gen(function* () {
      const sourceUserId = yield* currentUserId();
      if (!sourceUserId) return yield* fail('请先登录');

      const db = yield* DbClientEffect;
      const target = yield* tryOrFail(`${LOG_PREFIX} 查询目标账号`, () =>
        db.user.findUnique({
          where: { email: targetEmail },
          include: { oAuthAccount: true, role: true },
        }),
      );

      /** 防爆破：无论账号存在与否都消耗随机时间 */
      yield* randomDelay();
      if (!target) return yield* fail('目标账号不存在');
      if (target.id === sourceUserId) return yield* fail('目标账号不能是当前账号');

      const passwordOk = yield* comparePassword(targetPassword, target.password);
      if (!passwordOk) return yield* fail('目标账号密码错误');

      const source = yield* tryOrFail(`${LOG_PREFIX} 查询源账号`, () =>
        db.user.findUnique({
          where: { id: sourceUserId },
          include: { oAuthAccount: true, role: true },
        }),
      );
      if (!source) return yield* fail('当前账号不存在');

      /**
       * 事务内数据迁移（源 → 目标）：
       * - userId 字段模型：Resource/UserSession/OAuthAccount/UserData/AiCallLog/Order/UserTokenSubscription/Token/TokenTransaction/Task
       * - authorId 字段模型：File/Content/Word
       * - 冲突处理：OAuthAccount 同 provider 已被目标绑定时丢弃源的该条（目标优先）；UserData 同 key 冲突丢弃源的（目标优先）
       * - 角色：源的独有角色连接给目标
       * - 源账号会话全部失效，最后删除源账号
       */
      yield* tryOrFail(`${LOG_PREFIX} 执行合并事务`, () =>
        db.$transaction(async (tx) => {
          /** OAuthAccount：目标已有的同 provider 绑定直接丢弃源记录 */
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

          /** UserData：先删与目标同 key+appId 冲突的源记录，再迁移 */
          await tx.userData.deleteMany({
            where: {
              userId: source.id,
              key: {
                in: await tx.userData
                  .findMany({ where: { userId: target.id }, select: { key: true } })
                  .then((rs) => rs.map((r) => r.key)),
              },
            },
          });
          await tx.userData.updateMany({ where: { userId: source.id }, data: { userId: target.id } });

          /** 常规 userId 迁移 */
          await tx.resource.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
          await tx.order.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
          await tx.userTokenSubscription.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
          await tx.token.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
          await tx.tokenTransaction.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
          await tx.task.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
          await tx.aiCallLog.updateMany({ where: { userId: source.id }, data: { userId: target.id } });

          /** authorId 迁移 */
          await tx.file.updateMany({ where: { authorId: source.id }, data: { authorId: target.id } });
          await tx.content.updateMany({ where: { authorId: source.id }, data: { authorId: target.id } });
          await tx.word.updateMany({ where: { authorId: source.id }, data: { authorId: target.id } });

          /** 角色：源的独有角色连接给目标 */
          const targetRoleNames = new Set(target.role.map((r) => r.name));
          const rolesToConnect = source.role.filter((r) => !targetRoleNames.has(r.name)).map((r) => r.name);
          if (rolesToConnect.length > 0) {
            await tx.user.update({
              where: { id: target.id },
              data: { role: { connect: rolesToConnect.map((name) => ({ name })) } },
            });
          }

          /** 源会话全部失效（含当前会话），删除源账号 */
          await tx.userSession.deleteMany({ where: { userId: source.id } });
          await tx.user.delete({ where: { id: source.id } });
        }),
      );

      /** 给目标账号发新会话，前端直接登录态切换 */
      const mergedUser = yield* tryOrFail(`${LOG_PREFIX} 查询合并后用户`, () =>
        db.user.findUnique({ where: { id: target.id }, include: { role: true } }),
      );
      const finalUser = yield* requireOrFail(mergedUser, '合并后用户查询失败');
      const session = yield* genUserSession(finalUser.id);

      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 账号合并 ${sourceUserId} -> ${target.id}`);
      const { password: _pwd, ...userWithoutPassword } = finalUser;
      return { status: 'MERGED', login: { ...session, user: userWithoutPassword } };
    });
  },
};
