import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
const resetExisting = process.argv.includes('--reset-passwords');

if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const admins = [
  {
    username: 'joseph.monga',
    name: 'Monga Mpoyo Joseph',
    title: "Directeur de l'écodim",
    password: process.env.ADMIN_JOSEPH_PASSWORD,
    role: 'ADMIN',
  },
  {
    username: 'serge.kasongo',
    name: 'Kasongo Lubangi Serge',
    title: 'Second',
    password: process.env.ADMIN_SERGE_PASSWORD,
    role: 'ADMIN',
  },
];

for (const admin of admins) {
  if (!admin.password || admin.password.length < 12) {
    console.error(`Définis ADMIN_${admin.username === 'joseph.monga' ? 'JOSEPH' : 'SERGE'}_PASSWORD avec au moins 12 caractères.`);
    process.exit(1);
  }
}

const client = createClient({ url, authToken });

try {
  for (const admin of admins) {
    const existing = await client.execute({
      sql: 'SELECT id FROM User WHERE username = ? LIMIT 1',
      args: [admin.username],
    });

    if (existing.rows.length > 0 && !resetExisting) {
      console.log(`Compte ${admin.username} déjà présent ; mot de passe conservé (utilise --reset-passwords pour le changer).`);
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);
    const now = new Date().toISOString();

    if (existing.rows.length > 0) {
      await client.execute({
        sql: `UPDATE User SET password = ?, name = ?, role = ?, title = ?, isBlocked = 0, updatedAt = ?
              WHERE username = ?`,
        args: [passwordHash, admin.name, admin.role, admin.title, now, admin.username],
      });
    } else {
      await client.execute({
        sql: `INSERT INTO User (id, username, password, name, role, title, isBlocked, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        args: [randomUUID(), admin.username, passwordHash, admin.name, admin.role, admin.title, now, now],
      });
    }

    console.log(`Compte administrateur ${admin.username} ${existing.rows.length ? 'actualisé' : 'créé'}.`);
  }
} catch (error) {
  console.error('Échec de la création des comptes administrateurs :', error);
  process.exitCode = 1;
} finally {
  client.close();
}
