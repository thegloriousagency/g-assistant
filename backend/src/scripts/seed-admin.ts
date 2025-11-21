import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? 'admin@local.test';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? 'Admin123!';

async function seedAdmin() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: hashedPassword,
      role: 'admin',
      tenantId: null,
    },
    create: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('Seeded admin user:', {
    email: user.email,
  });
}

seedAdmin()
  .then(() => {
    console.log('Admin seed complete.');
  })
  .catch((error) => {
    console.error('Failed to seed admin user', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
