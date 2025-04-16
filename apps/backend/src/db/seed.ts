import { compareSync, hashSync } from 'bcryptjs';
import { getPrisma, prisma } from '.';

/** 对数据库进行一些初始化设置 */
export async function seedDB() {
  await seedAdmin();
}

/** 超级管理员账户 */
export const systemAdminUser = {
  email: 'admin@example.com',
  password: 'adminpassword123', // Ensure this is hashed in a real application
};

let awaitSeedAdminR: (p: any) => void;
const awaitSeedAdminFlag = new Promise((r) => {
  awaitSeedAdminR = r;
});

/** 具有系统管理员身份的数据库操作实例 */
export const systemAdminDB = new Promise<ReturnType<typeof getPrisma>>(async (r) => {
  await awaitSeedAdminFlag;
  const db = getPrisma({ email: systemAdminUser.email });
  r(db);
});

/** 创建管理员账户及其角色 */
async function seedAdmin() {
  let admin = await prisma.user.findUnique({
    where: {
      email: systemAdminUser.email,
    },
    include: {
      role: true,
    },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: systemAdminUser.email,
        password: systemAdminUser.password,
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
  } else if (!compareSync(systemAdminUser.password, admin.password)) {
    console.log('重置系统管理员帐号密码');
    admin = await prisma.user.update({
      where: {
        email: systemAdminUser.email,
      },
      data: {
        password: hashSync(systemAdminUser.password),
      },
      include: {
        role: true,
      },
    });
  }
  awaitSeedAdminR(1);
  // console.log('[admin]', admin);
}
