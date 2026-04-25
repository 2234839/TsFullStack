import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { AppConfigService } from '../Context/AppConfig';
import { requireOrFail, tryOrFail } from '../util/error';
import { hashPassword, comparePassword } from '../util/crypto';
import type { Role } from '../../.zenstack/models';

/** 管理员角色名常量 */
const ADMIN_ROLE_NAME = 'admin';

/** 日志前缀 */
const LOG_PREFIX = '[Seed]';

/** 对数据库进行一些初始化设置 */
export const seedDB: Effect.Effect<
  void,
  Error,
  AppConfigService
> = Effect.gen(function* () {
  yield* seedWAL();
  yield* seedAdmin();
});

/** 配置 SQLite 数据库为 WAL 模式 */
const seedWAL = () =>
  Effect.gen(function* () {
    const dbClient = yield* DbClientEffect;

    const result = yield* tryOrFail('配置 WAL 模式', () => dbClient.$queryRaw`PRAGMA journal_mode = WAL`);
    console.log(`${LOG_PREFIX} SQLite 数据库已配置为 WAL 模式:`, result);
  });

/** 创建管理员账户及其角色 */
const seedAdmin = () =>
  Effect.gen(function* () {
    const dbClient = yield* DbClientEffect;
    const { systemAdminUser } = yield* AppConfigService;

    /** 查询管理员 */
    const findAdmin = () => tryOrFail('查询管理员', () => dbClient.user.findUnique({
      where: { email: systemAdminUser.email },
      include: { role: true },
    }));

    let admin = yield* findAdmin();

    /** 预先计算密码哈希（Effect.tryPromise 的 try 回调中无法使用 yield*） */
  const hashedPassword = yield* hashPassword(systemAdminUser.password);

  if (!admin) {
      /** 创建管理员 */
      admin = yield* tryOrFail('创建管理员', () => dbClient.user.create({
        data: {
          email: systemAdminUser.email,
          password: hashedPassword,
          role: {
            connectOrCreate: {
              where: { name: ADMIN_ROLE_NAME },
              create: { name: ADMIN_ROLE_NAME },
            },
          },
        },
        include: { role: true },
      }));
    } else if (admin.password && !(yield* comparePassword(systemAdminUser.password, admin.password))) {
      /** 生产环境不自动重置密码，避免配置被篡改后静默接管管理员账户 */
      if (process.env.NODE_ENV === 'production') {
        console.warn(`${LOG_PREFIX} 生产环境检测到管理员密码与配置不一致，跳过自动重置（请手动处理）`);
      } else {
        console.log(`${LOG_PREFIX} 重置系统管理员帐号密码`);
        /** 重置管理员密码（复用已计算的 hashedPassword） */
        admin = yield* tryOrFail('重置管理员密码', () => dbClient.user.update({
          where: { email: systemAdminUser.email },
          data: { password: hashedPassword },
          include: { role: true },
        }));
      }
    }

    // 确保 admin 不为 null（TypeScript 收窄）
    admin = yield* requireOrFail(admin, '管理员初始化失败');

    if (!admin.role?.find((el: Role) => el.name === ADMIN_ROLE_NAME)) {
      console.log(`${LOG_PREFIX} 添加管理员角色`);
      yield* tryOrFail('添加管理员角色', () => dbClient.user.update({
        where: { email: systemAdminUser.email },
        data: {
          role: {
            connectOrCreate: {
              where: { name: ADMIN_ROLE_NAME },
              create: { name: ADMIN_ROLE_NAME },
            },
          },
        },
      }));
    }
  });
