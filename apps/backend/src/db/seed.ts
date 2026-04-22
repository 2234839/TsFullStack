import { compareSync, hashSync } from 'bcryptjs';
import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { AppConfigService } from '../Context/AppConfig';
import { MsgError } from '../util/error';
import type { Role } from '../../.zenstack/models';

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

    const result = yield* Effect.tryPromise({
      try: () => dbClient.$queryRaw`PRAGMA journal_mode = WAL`,
      catch: (e) => MsgError.msg('配置 WAL 模式失败: ' + String(e)),
    });
    console.log('SQLite 数据库已配置为 WAL 模式:', result);
  });

/** 创建管理员账户及其角色 */
const seedAdmin = () =>
  Effect.gen(function* () {
    const dbClient = yield* DbClientEffect;
    const { systemAdminUser } = yield* AppConfigService;

    /** 查询管理员 */
    const findAdmin = () => Effect.tryPromise({
      try: () => dbClient.user.findUnique({
        where: { email: systemAdminUser.email },
        include: { role: true },
      }),
      catch: (e) => MsgError.msg('查询管理员失败: ' + String(e)),
    });

    let admin = yield* findAdmin();

    if (!admin) {
      /** 创建管理员 */
      admin = yield* Effect.tryPromise({
        try: () => dbClient.user.create({
          data: {
            email: systemAdminUser.email,
            password: hashSync(systemAdminUser.password),
            role: {
              connectOrCreate: {
                where: { name: 'admin' },
                create: { name: 'admin' },
              },
            },
          },
          include: { role: true },
        }),
        catch: (e) => MsgError.msg('创建管理员失败: ' + String(e)),
      });
    } else if (admin.password && !compareSync(systemAdminUser.password, admin.password)) {
      console.log('重置系统管理员帐号密码');
      /** 重置管理员密码 */
      admin = yield* Effect.tryPromise({
        try: () => dbClient.user.update({
          where: { email: systemAdminUser.email },
          data: { password: hashSync(systemAdminUser.password) },
          include: { role: true },
        }),
        catch: (e) => MsgError.msg('重置管理员密码失败: ' + String(e)),
      });
    }

    // 确保 admin 不为 null（TypeScript 收窄）
    if (!admin) throw MsgError.msg('管理员初始化失败');

    if (!admin.role?.find((el: Role) => el.name === 'admin')) {
      console.log('添加管理员角色');
      yield* Effect.tryPromise({
        try: () => dbClient.user.update({
          where: { email: systemAdminUser.email },
          data: {
            role: {
              connectOrCreate: {
                where: { name: 'admin' },
                create: { name: 'admin' },
              },
            },
          },
        }),
        catch: (e) => MsgError.msg('添加管理员角色失败: ' + String(e)),
      });
    }
  });
