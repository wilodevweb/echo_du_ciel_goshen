import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Création des comptes administrateurs (moniteur-admin)...');

  const admins = [
    {
      username: 'joseph.monga',
      name: 'Monga Mpoyo Joseph',
      title: "Directeur de l'écodim",
      password: 'JosephEcodim2026!',
      role: 'ADMIN',
    },
    {
      username: 'serge.kasongo',
      name: 'Kasongo Lubangi Serge',
      title: 'Second',
      password: 'SergeEcodim2026!',
      role: 'ADMIN',
    },
  ];

  for (const admin of admins) {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const user = await prisma.user.upsert({
      where: { username: admin.username },
      update: {
        name: admin.name,
        title: admin.title,
        password: hashedPassword,
        role: admin.role,
        isBlocked: false,
      },
      create: {
        username: admin.username,
        name: admin.name,
        title: admin.title,
        password: hashedPassword,
        role: admin.role,
        isBlocked: false,
      },
    });

    console.log(`----------------------------------------`);
    console.log(`Compte Admin créé/mis à jour avec succès :`);
    console.log(`Nom: ${user.name}`);
    console.log(`Statut/Titre: ${user.title}`);
    console.log(`Nom d'utilisateur (Login): ${user.username}`);
    console.log(`Mot de passe: ${admin.password}`);
  }
  console.log(`----------------------------------------`);
  console.log('Opération terminée.');
}

main()
  .catch((error) => {
    console.error('Erreur lors de la création des admins:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
