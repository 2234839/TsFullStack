import { getPrisma } from './db';
import { seedDB } from './db/seed';

async function main() {
  await seedDB();
  // 管理员账户
  // const db = await getPrisma({ userId: 'cm9fj9kn20000ebnqc5hmbaf6' });
  // 测试帐号
  const { db, user } = await getPrisma({ userId: 'cm9fg8dfc0000ebdqtdlf8jwp' });
  console.log(await db.user.findMany());
}
main();
// startServer();
