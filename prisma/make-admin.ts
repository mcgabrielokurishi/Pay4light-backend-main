// prisma/make-admin.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { email: 'your-email@gmail.com' },
    data:  { role: 'ADMIN' },
  });
  console.log(' Admin role granted');
}

main().finally(() => prisma.$disconnect());