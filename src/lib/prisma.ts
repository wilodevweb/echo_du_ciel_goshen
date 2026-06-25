import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const url = process.env.DATABASE_URL || 'file:./dev.db';

const adapter = url.startsWith('libsql://') || url.startsWith('https://')
  ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
  : new PrismaBetterSqlite3({ url });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
