import { PrismaClient } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime/edge';
import { startServer } from './server';

const prisma = new PrismaClient();

const adminUser = {
  email: 'admin@example.com',
  password: 'adminpassword123', // Ensure this is hashed in a real application
};

/** 自动创建管理员账户 */
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
        password: adminUser.password, // Ensure this is hashed in a real application
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

/** 获取zenstack 生成的增强 Prisma 客户端实例，用于鉴权操作  */
async function getPrisma({ userId }: { userId: string }) {
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

  return {
    db: enhance(prisma, { user }),
    user: {
      ...user,
      /** 移除密码字段，避免泄露敏感信息   */
      password: undefined,
    },
  };
}

async function main() {
  await seedAdmin();
  // 管理员账户
  // const db = await getPrisma({ userId: 'cm9fj9kn20000ebnqc5hmbaf6' });
  // 测试帐号
  const { db, user } = await getPrisma({ userId: 'cm9fg8dfc0000ebdqtdlf8jwp' });

  // console.log('[user]', user);
  // console.log(await db.user.findMany());
}
main();
startServer();
