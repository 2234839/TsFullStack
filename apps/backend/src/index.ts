import { getPrisma } from './db';
import { seedDB } from './db/seed';

async function main() {
  await seedDB();

  const { db, user } = await getPrisma({
    // 测试帐号
    // userId: 'cm9fg8dfc0000ebdqtdlf8jwp'
    // 管理员账户
    userId: 'cm9fj9kn20000ebnqc5hmbaf6',
  });
  console.log(`${user.email} 可访问的用户列表:  `, await db.user.findMany());
}
main();
// startServer();
