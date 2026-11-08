/**
 * 数据库初始化（seed）的纯过程实现。
 *
 * 不依赖 Effect / fastify 等主线程模块，worker 线程与直连模式共用：
 * - worker 模式：主线程发一次 seed RPC，本函数在 worker 内整体执行
 *   （SQL 与 bcrypt 哈希/比对均不占主线程事件循环）
 * - 直连模式：进程内直接调用
 *
 * 失败直接抛出（快速失败），由调用方包装为错误通道。
 */
import { compareSync, hashSync } from 'bcryptjs';
import type { WorkerDbClient } from '../Context/dbWorker/clientType';
import type { Role } from '../../.zenstack/models';

/** bcrypt 成本因子（与 util/crypto.ts 保持一致） */
const BCRYPT_SALT_ROUNDS = 10;

/** 管理员角色名常量 */
const ADMIN_ROLE_NAME = 'admin';

/** 日志前缀 */
const LOG_PREFIX = '[Seed]';

/** seed 所需的管理员配置 */
export interface SeedAdminConfig {
  /** 管理员邮箱 */
  adminEmail: string;
  /** 管理员密码（明文，来自配置） */
  adminPassword: string;
  /** 生产环境不自动重置密码，避免配置被篡改后静默接管管理员账户 */
  production: boolean;
}

/** 对数据库进行初始化：WAL/NORMAL 配置 + 管理员账户与角色保障 */
export async function runSeed(client: WorkerDbClient, admin: SeedAdminConfig): Promise<void> {
  await seedWAL(client);
  await seedAdmin(client, admin);
}

/** 配置 SQLite 数据库为 WAL 模式 + NORMAL 同步级别 */
async function seedWAL(client: WorkerDbClient): Promise<void> {
  const result = await client.$queryRaw`PRAGMA journal_mode = WAL`;
  console.log(`${LOG_PREFIX} SQLite 数据库已配置为 WAL 模式:`, result);

  /**
   * WAL 下 synchronous=NORMAL：事务提交只写 WAL 不 fsync，仅在 checkpoint 时落盘。
   * 相比默认 FULL 大幅减少同步写阻塞事件循环的时长；掉电最多丢最近若干已提交事务，
   * 应用崩溃不丢数据、库不损坏——对可重建的业务日志/诊断数据完全可接受。
   */
  const syncResult = await client.$queryRaw`PRAGMA synchronous = NORMAL`;
  console.log(`${LOG_PREFIX} SQLite synchronous 已配置为 NORMAL:`, syncResult);
}

/** 创建管理员账户及其角色 */
async function seedAdmin(client: WorkerDbClient, admin: SeedAdminConfig): Promise<void> {
  /** 查询管理员 */
  let user = await client.user.findUnique({
    where: { email: admin.adminEmail },
    include: { role: true },
  });

  if (!user) {
    /** bcrypt 哈希仅在创建/重置密码分支执行（cost=10 约 100ms），
     * 正常启动管理员已存在且密码一致时只做 compare 校验 */
    const hashedPassword = hashSync(admin.adminPassword, BCRYPT_SALT_ROUNDS);
    /** 创建管理员 */
    user = await client.user.create({
      data: {
        email: admin.adminEmail,
        password: hashedPassword,
        role: {
          connectOrCreate: {
            where: { name: ADMIN_ROLE_NAME },
            create: { name: ADMIN_ROLE_NAME },
          },
        },
      },
      include: { role: true },
    });
  } else if (user.password && !compareSync(admin.adminPassword, user.password)) {
    if (admin.production) {
      console.warn(`${LOG_PREFIX} 生产环境检测到管理员密码与配置不一致，跳过自动重置（请手动处理）`);
    } else {
      console.log(`${LOG_PREFIX} 重置系统管理员帐号密码`);
      const hashedPassword = hashSync(admin.adminPassword, BCRYPT_SALT_ROUNDS);
      /** 重置管理员密码 */
      user = await client.user.update({
        where: { email: admin.adminEmail },
        data: { password: hashedPassword },
        include: { role: true },
      });
    }
  }

  if (!user) throw new Error(`${LOG_PREFIX} 管理员初始化失败`);

  if (!user.role?.find((el: Role) => el.name === ADMIN_ROLE_NAME)) {
    console.log(`${LOG_PREFIX} 添加管理员角色`);
    await client.user.update({
      where: { email: admin.adminEmail },
      data: {
        role: {
          connectOrCreate: {
            where: { name: ADMIN_ROLE_NAME },
            create: { name: ADMIN_ROLE_NAME },
          },
        },
      },
    });
  }
}
