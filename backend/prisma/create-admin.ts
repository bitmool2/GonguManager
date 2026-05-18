import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('Admin1234!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@gongu.kr' },
    update: { role: 'admin', passwordHash: hash },
    create: { email: 'admin@gongu.kr', passwordHash: hash, name: '관리자', role: 'admin' },
  });
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, planType: 'biz', status: 'active' },
  });
  console.log('Admin created:', user.email, '/ role:', user.role);
  await prisma.$disconnect();
}

main().catch(console.error);
