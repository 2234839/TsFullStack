import { prisma } from '.';

/** 对数据库进行一些初始化设置 */
export async function seedDB() {
  await seedAdmin();
}
const adminUser = {
  email: 'admin@example.com',
  password: 'adminpassword123', // Ensure this is hashed in a real application
};
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
