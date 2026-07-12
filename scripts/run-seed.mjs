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

const defaultChildren = [
  { lastName: 'Mbuyi', postName: 'Kabongo', firstName: 'Plamedi', classLevel: 'SECOND', birthDate: '2015-03-14' },
  { lastName: 'Kabasele', postName: 'Tshimanga', firstName: 'Ethan', classLevel: 'FIRST', birthDate: '2018-08-22' },
  { lastName: 'Ilunga', postName: 'Mwamba', firstName: 'Divine', classLevel: 'THIRD', birthDate: '2014-11-05' },
  { lastName: 'Ngoy', postName: 'Kalonji', firstName: 'Exaucé', classLevel: 'SECOND', birthDate: '2017-01-30' },
  { lastName: 'Kanyinda', postName: 'Mutombo', firstName: 'Grâce', classLevel: 'FIRST', birthDate: '2020-07-11' },
  { lastName: 'Mbakadi', postName: 'Tshilumba', firstName: 'Merdie', classLevel: 'THIRD', birthDate: '2016-09-19' },
  { lastName: 'Kapinga', postName: 'Mukendi', firstName: 'Priscille', classLevel: 'SECOND', birthDate: '2021-05-02' },
  { lastName: 'Kazadi', postName: 'Nyembwe', firstName: 'Christian', classLevel: 'FIRST', birthDate: '2019-12-27' },
  { lastName: 'Ngalula', postName: 'Kasonga', firstName: 'Dorcas', classLevel: 'THIRD', birthDate: '2015-06-14' },
  { lastName: 'Boketshu', postName: 'Mpoko', firstName: 'Nathan', classLevel: 'SECOND', birthDate: '2022-02-08' },
  { lastName: 'Mbala', postName: 'Kimvula', firstName: 'Gloire', classLevel: 'FIRST', birthDate: '2014-10-17' },
  { lastName: 'Nsenga', postName: 'Nsapo', firstName: 'Jaden', classLevel: 'THIRD', birthDate: '2023-04-25' },
  { lastName: 'Mavungu', postName: 'Phuati', firstName: 'Blessing', classLevel: 'SECOND', birthDate: '2017-11-09' },
  { lastName: 'Makoso', postName: 'Ndombasi', firstName: 'Samuel', classLevel: 'FIRST', birthDate: '2016-01-03' },
  { lastName: 'Luvualu', postName: 'Diakiese', firstName: 'Davina', classLevel: 'THIRD', birthDate: '2020-08-12' },
  { lastName: 'Nsimba', postName: 'Kiala', firstName: 'Emmanuel', classLevel: 'SECOND', birthDate: '2015-05-21' },
  { lastName: 'Nzuzi', postName: 'Matondo', firstName: 'Israël', classLevel: 'FIRST', birthDate: '2019-07-30' },
  { lastName: 'Malasi', postName: 'Amisi', firstName: 'Sarah', classLevel: 'THIRD', birthDate: '2018-03-06' },
  { lastName: 'Kavira', postName: 'Muhindo', firstName: 'Joyce', classLevel: 'SECOND', birthDate: '2021-10-18' },
  { lastName: 'Masika', postName: 'Kakule', firstName: 'David', classLevel: 'FIRST', birthDate: '2014-12-29' },
  { lastName: 'Kambale', postName: 'Paluku', firstName: 'Justin', classLevel: 'THIRD', birthDate: '2016-04-14' },
  { lastName: 'Kahindo', postName: 'Tsongo', firstName: 'Rachel', classLevel: 'SECOND', birthDate: '2022-09-07' },
  { lastName: 'Manya', postName: 'Ondekane', firstName: 'Jonathan', classLevel: 'FIRST', birthDate: '2017-02-23' },
  { lastName: 'Kitenge', postName: 'Lomami', firstName: 'Benjamin', classLevel: 'THIRD', birthDate: '2015-05-11' },
  { lastName: 'Wembonyama', postName: 'Shako', firstName: 'Daniel', classLevel: 'SECOND', birthDate: '2019-07-19' },
  { lastName: 'Lola', postName: 'Pene', firstName: 'Christ-En-Vie', classLevel: 'FIRST', birthDate: '2024-11-01' },
  { lastName: 'Katamea', postName: 'Tshabola', firstName: 'Gabriel', classLevel: 'THIRD', birthDate: '2018-06-08' },
  { lastName: 'Mutoni', postName: 'Kanyamahanga', firstName: 'Alice', classLevel: 'SECOND', birthDate: '2020-03-15' },
  { lastName: 'Bahati', postName: 'Miruho', firstName: 'Prince', classLevel: 'FIRST', birthDate: '2016-08-26' },
  { lastName: 'Ndaye', postName: 'Kalala', firstName: 'Caleb', classLevel: 'THIRD', birthDate: '2015-10-04' },
];

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
