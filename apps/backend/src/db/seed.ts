import { compareSync, hashSync } from 'bcryptjs';
import { Effect } from 'effect';
import { prisma } from '.';
import { AppConfigService } from '../service/AppConfigService';

/** 对数据库进行一些初始化设置 */
export const seedDB = Effect.gen(function* () {
  yield* seedWAL;
  yield* seedAdmin;
});

/** 配置 SQLite 数据库为 WAL 模式 */
const seedWAL = Effect.gen(function* () {
  const result = yield* Effect.promise(() =>
    prisma.$queryRaw`PRAGMA journal_mode = WAL`
  );
  console.log('SQLite 数据库已配置为 WAL 模式:', result);
});

/** 创建管理员账户及其角色 */
const seedAdmin = Effect.gen(function* () {
  const { systemAdminUser } = yield* AppConfigService;
  let admin = yield* Effect.promise(() =>
    prisma.user.findUnique({
      where: {
        email: systemAdminUser.email,
      },
      include: {
        role: true,
      },
    }),
  );

  if (!admin) {
    admin = yield* Effect.promise(() =>
      prisma.user.create({
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
        include: {
          role: true,
        },
      }),
    );
  } else if (!compareSync(systemAdminUser.password, admin.password)) {
    console.log('重置系统管理员帐号密码');
    admin = yield* Effect.promise(() =>
      prisma.user.update({
        where: {
          email: systemAdminUser.email,
        },
        data: {
          password: hashSync(systemAdminUser.password),
        },
        include: {
          role: true,
        },
      }),
    );
  }
  if (!admin.role.find((el) => el.name === 'admin')) {
    console.log('添加管理员角色');
    yield* Effect.promise(() =>
      prisma.user.update({
        where: {
          email: systemAdminUser.email,
        },
        data: {
          role: {
            connectOrCreate: {
              where: { name: 'admin' },
              create: { name: 'admin' },
            },
          },
        },
      }),
    );
  }
});
