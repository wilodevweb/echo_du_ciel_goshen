import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching database parents and children...');
  
  // Utiliser raw query pour s'assurer que ça marche indépendamment de l'état généré de Prisma Client
  const parents = await prisma.$queryRaw`SELECT id, firstName, lastName, phone, address FROM Parent`;
  const children = await prisma.$queryRaw`SELECT id, parentFirstName, parentLastName, parentPhone FROM Child`;

  const data = { parents, children };
  const backupPath = path.join(__dirname, '../prisma/migration_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`Backup completed successfully. Saved ${parents.length} parents and ${children.length} children to ${backupPath}.`);
}

main()
  .catch((e) => {
    console.error('Backup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
