import { PrismaClient } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime/edge';

const prisma = new PrismaClient();

const adminUser = {
  email: 'admin@example.com',
  password: 'adminpassword123', // Ensure this is hashed in a real application
};

/** 获取zenstack 生成的增强 Prisma 客户端实例，用于鉴权操作  */
export async function getPrisma({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      role: true,
    },
  });
  if (!user) {
    throw new Error('User not found');
  }

  const db = enhance(prisma, { user });

  /** 阻断这些可能击穿 ZenStack 的方法 */
  const blockedMethods = [
    '$connect',
    '$disconnect',
    '$executeRaw',
    '$executeRawUnsafe',
    '$extends',
    '$on',
    '$queryRaw',
    '$queryRawUnsafe',
    '$use',
  ] as const; // 使用 const 断言确保类型安全

  // 创建代理对象，并保留类型推断
  const dbProxy = new Proxy(db, {
    get(target, prop: string | symbol, receiver) {
      if (typeof prop === 'string' && blockedMethods.includes(prop as any)) {
        throw new Error(`Method '${prop}' is blocked.`);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Omit<typeof db, (typeof blockedMethods)[number]>;
  return {
    db: dbProxy,
    user: {
      ...user,
      /** 移除密码字段，避免泄露敏感信息   */
      password: undefined,
    },
  };
}

/** 对数据库进行一些初始化设置 */
export async function seedDB() {
  await seedAdmin();
}

/** 创建管理员账户及其角色 */
async function seedAdmin() {
  let admin = await prisma.user.findUnique({
    where: {
      email: adminUser.email,
    },
    include: {
      role: true,
    },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminUser.email,
        password: adminUser.password,
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
    });
  }

  // console.log('[admin]', admin);
}
