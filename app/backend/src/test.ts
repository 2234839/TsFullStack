import { PrismaClient } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime/edge';

const prisma = new PrismaClient();
function getPrisma({ userId }: { userId: string }) {
  const user = Number.isNaN(userId) ? undefined : { id: userId };
  return enhance(prisma, { user:{id:userId} });
}

async function main() {
  const db = getPrisma({ userId: '123' });
  // console.log(await db.user.create({
  //   data:{
  //     email:"test@example.com",
  //     password:"password123"
  //   }
  // }));
  console.log(await db.user.findMany());
}
main();
