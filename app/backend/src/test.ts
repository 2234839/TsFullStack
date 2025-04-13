import { PrismaClient } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime/edge';

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

  console.log('[admin]', admin);
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

  return enhance(prisma, { user });
}

async function main() {
  await seedAdmin();
  const db = await getPrisma({ userId: 'cm9fj9kn20000ebnqc5hmbaf6' });
  db.user
  const user = await db.user.findFirst({
    include: {
      role: true,
    },
  });
  console.log('[user?.role]', user?.role);
  // 此字段不会输出
  console.log('[user?.password]', user?.password);
  console.log(await db.user.findMany());
}
main();
