import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ✅ Hardcode your email directly
  const email = 'mcgabrielokurishi@gmail.com'; // ← put your actual email here

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User with email ${email} not found. Register first then run this script.`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data:  { role: 'ADMIN' },
  });

  console.log(`✅ Admin role granted to ${email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());