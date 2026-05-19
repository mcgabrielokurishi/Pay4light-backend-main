import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL!;

  await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.ADMIN,
    },
    create: {
      email,
      password: 'temporary-password',
      fullName: 'Super Admin',
      role: Role.ADMIN,
    },
  });

  console.log('Admin setup complete');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });