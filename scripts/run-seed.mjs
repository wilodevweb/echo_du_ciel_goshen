import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import fs from 'fs';

dotenv.config();

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

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

const defaultChildren = [];

function childSeedId(child) {
  return `child-${child.lastName}-${child.postName}-${child.firstName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function runSeedOnClient(client, dbName) {
  console.log(`\n--- Seeding ${dbName} ---`);

  // 1. Seeding Users
  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const existing = await client.execute({
      sql: 'SELECT id FROM User WHERE username = ? LIMIT 1',
      args: [user.username]
    });

    const now = new Date().toISOString();

    if (existing.rows.length > 0) {
      await client.execute({
        sql: 'UPDATE User SET name = ?, password = ?, role = ?, updatedAt = ? WHERE username = ?',
        args: [user.name, passwordHash, user.role, now, user.username]
      });
      console.log(`Updated user: ${user.username}`);
    } else {
      const cuid = 'u' + Math.random().toString(36).substring(2, 15);
      await client.execute({
        sql: 'INSERT INTO User (id, username, password, name, role, title, isBlocked, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [cuid, user.username, passwordHash, user.name, user.role, '', 0, now, now]
      });
      console.log(`Created user: ${user.username}`);
    }
  }

  // 2. Seeding Children
  for (const child of defaultChildren) {
    const childId = childSeedId(child);
    const now = new Date().toISOString();

    // Check by name fields & birthdate
    const existing = await client.execute({
      sql: 'SELECT id FROM Child WHERE lastName = ? AND postName = ? AND firstName = ? AND birthDate = ? LIMIT 1',
      args: [child.lastName, child.postName, child.firstName, child.birthDate]
    });

    const targetId = existing.rows.length > 0 ? existing.rows[0].id : childId;

    if (existing.rows.length > 0) {
      await client.execute({
        sql: `UPDATE Child 
              SET firstName = ?, lastName = ?, postName = ?, classLevel = ?, parentPhone = '', address = '', birthDate = ?, notes = '', photoUrl = NULL, updatedAt = ? 
              WHERE id = ?`,
        args: [child.firstName, child.lastName, child.postName, child.classLevel, child.birthDate, now, targetId]
      });
    } else {
      await client.execute({
        sql: `INSERT INTO Child (id, firstName, lastName, postName, classLevel, parentPhone, parentName, address, birthDate, notes, photoUrl, createdAt, updatedAt, parentId)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [targetId, child.firstName, child.lastName, child.postName, child.classLevel, '', '', '', child.birthDate, '', null, now, now, null]
      });
    }
  }

  // 3. Cleanup old default seed children (whose ID starts with 'child-')
  console.log('Cleaning up old default seed children...');
  await client.execute({
    sql: "DELETE FROM Attendance WHERE childId LIKE 'child-%'"
  });
  const deleteRes = await client.execute({
    sql: "DELETE FROM Child WHERE id LIKE 'child-%'"
  });
  console.log(`Deleted ${deleteRes.rowsAffected} old default seed children.`);

  console.log(`Seeding completed successfully for ${dbName} (${defaultChildren.length} children processed).`);
}

async function main() {
  console.log('Connecting to remote Turso database...');
  const remoteClient = createClient({ url, authToken });
  try {
    await runSeedOnClient(remoteClient, 'Turso (Remote)');
  } catch (error) {
    console.error('Remote seeding failed:', error.message || error);
  } finally {
    remoteClient.close();
  }

  // Local dev.db if exists
  const localDbPath = 'dev.db';
  if (fs.existsSync(localDbPath)) {
    console.log('\nConnecting to local dev.db SQLite database...');
    const localClient = createClient({ url: 'file:dev.db' });
    try {
      await runSeedOnClient(localClient, 'dev.db (Local)');
    } catch (error) {
      console.error('Local seeding failed:', error.message || error);
    } finally {
      localClient.close();
    }
  }
}

main().catch((error) => {
  console.error('Main execution failed:', error.message || error);
  process.exitCode = 1;
});
