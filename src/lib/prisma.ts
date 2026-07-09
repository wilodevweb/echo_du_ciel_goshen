import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

// Configurer le proxy pour les requêtes sortantes de fetch (ex: Turso) si présent dans l'environnement
const proxyUrl = process.env.https_proxy || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  try {
    const proxyAgent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(proxyAgent);
    console.log(`[Proxy] Global dispatcher set to ${proxyUrl}`);
  } catch (error) {
    console.error("[Proxy] Failed to configure global proxy dispatcher:", error);
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const url = process.env.DATABASE_URL || 'file:./dev.db';

const adapter = url.startsWith('libsql://') || url.startsWith('https://')
  ? new PrismaLibSql(createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN }))
  : new PrismaBetterSqlite3({ url });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
