import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Testing query on MediaResource...');
  try {
    const res = await prisma.mediaResource.findMany();
    console.log('Query successful, media resources count:', res.length);
    console.log('Items:', res);
  } catch (err: unknown) {
    console.error('Query failed:', err instanceof Error ? err.message : err);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
