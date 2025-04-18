import { seedConfig } from './config';
import { seedDB } from './db/seed';
import { startServer } from './server';

async function main() {
  await seedConfig();
  await seedDB();
  await startServer();

  // test code
  // const { db, user } = await getPrisma({
  //   // 测试帐号
  //   // userId: 'cm9fg8dfc0000ebdqtdlf8jwp'
  //   // 管理员账户
  //   userId: 'cm9fj9kn20000ebnqc5hmbaf6',
  // });
  // console.log(`${user.email} 可访问的用户列表:  `, await db.user.findMany());
}
main();
