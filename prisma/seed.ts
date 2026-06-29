import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

const defaultUsers = [
  {
    username: 'admin',
    name: 'Admin Echo',
    password: 'password123',
    role: 'ADMIN',
  },
  {
    username: 'moniteur',
    name: 'Moniteur Goshen',
    password: 'password123',
    role: 'MONITOR',
  },
];

async function main() {
  console.log('Debut du seeding...');

  for (const user of defaultUsers) {
    const password = await bcrypt.hash(user.password, 10);

    const savedUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        name: user.name,
        password,
        role: user.role,
      },
      create: {
        username: user.username,
        name: user.name,
        password,
        role: user.role,
      },
    });

    console.log(`Utilisateur pret : ${savedUser.username} (${savedUser.role})`);
  }

  console.log('Seeding termine.');
}

main()
  .catch((error) => {
    console.error('Erreur lors du seeding:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
