import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(projectRoot, '.goshen-demo');
let databasePath = '';
try {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (databaseUrl.protocol === 'file:') databasePath = path.resolve(decodeURIComponent(databaseUrl.pathname));
} catch {
  // Invalid or non-file database URLs are rejected by the guard below.
}

if (
  process.env.GOSHEN_DEMO_MODE !== '1' ||
  !databasePath ||
  path.dirname(databasePath) !== demoDir ||
  path.extname(databasePath) !== '.db'
) {
  throw new Error('Refus de créer les données démo hors de la base SQLite locale dédiée.');
}

async function main() {
  const client = createClient({ url: process.env.DATABASE_URL });
  try {
    const seeded = await client.execute(`
      SELECT
        (SELECT COUNT(*) FROM User WHERE username IN ('demo.admin', 'demo.monitor')) AS users,
        (SELECT COUNT(*) FROM Child WHERE id LIKE 'demo-child-%') AS children,
        (SELECT COUNT(*) FROM Event WHERE id = 'demo-event-sunday') AS events,
        (SELECT COUNT(*) FROM MediaResource WHERE id = 'demo-resource-banner') AS resources
    `);
    const state = seeded.rows[0];
    if (Number(state.users) === 2 && Number(state.children) === 70 && Number(state.events) === 1 && Number(state.resources) === 1) {
      console.log('Données démo déjà initialisées ; les modifications locales sont conservées.');
      return;
    }

    const now = new Date().toISOString();
    const password = await bcrypt.hash('demo1234', 10);
    const users = [
      ['demo-admin', 'demo.admin', 'Admin Démo', 'ADMIN', 'Directeur'],
      ['demo-monitor', 'demo.monitor', 'Moniteur Démo', 'MONITOR', 'Moniteur'],
    ];

    for (const [id, username, name, role, title] of users) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO User (id, username, password, name, role, title, isBlocked, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        args: [id, username, password, name, role, title, now, now],
      });
    }

const examples = [
  ['Amani', 'Mukendi', 'M', 'FIRST'], ['Béni', 'Kalala', 'M', 'FIRST'],
  ['Dorcas', 'Ngoy', 'F', 'SECOND'], ['Emmanuel', 'Lukusa', 'M', 'SECOND'],
  ['Grâce', 'Mwamba', 'F', 'THIRD'], ['Jonathan', 'Tshiala', 'M', 'THIRD'],
  ['Lydia', 'Kabongo', 'F', 'THIRD'], ['Mireille', 'Ilunga', 'F', 'FIRST'],
  ['Naomie', 'Kabeya', 'F', 'SECOND'], ['Patrick', 'Mutombo', 'M', 'THIRD'],
];
const firstNames = ['David', 'Esther', 'Josué', 'Sarah', 'Samuel', 'Ruth', 'Élie', 'Déborah', 'Noé', 'Rebecca'];
const lastNames = ['Monga', 'Kabila', 'Mbuyi', 'Kasongo', 'Tshibanda', 'Lwamba', 'Banza', 'Kalombo', 'Mbayo', 'Kanku'];
    const children = [...examples];
    for (let index = children.length; index < 70; index += 1) {
      children.push([
        firstNames[index % firstNames.length],
        lastNames[Math.floor(index / firstNames.length) % lastNames.length],
        index % 2 ? 'F' : 'M',
        ['FIRST', 'SECOND', 'THIRD'][index % 3],
      ]);
    }

    for (const [index, [firstName, lastName, gender, classLevel]] of children.entries()) {
      const id = `demo-child-${String(index + 1).padStart(3, '0')}`;
      await client.execute({
        sql: `INSERT OR IGNORE INTO Child (id, firstName, lastName, postName, gender, classLevel, parentPhone, parentName, address, birthDate, notes, photoUrl, createdAt, updatedAt, parentId)
          VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
        args: [id, firstName, lastName, gender, classLevel, `+243 900 000 ${String(index + 1).padStart(3, '0')}`, `Parent ${lastName}`, 'Quartier Démo', `201${index % 5}-0${(index % 9) + 1}-15`, now, now],
      });

      if (index < 24) {
        const date = new Date();
        date.setDate(date.getDate() - (index % 7));
        const dateKey = date.toISOString().slice(0, 10);
        await client.execute({
          sql: `INSERT OR IGNORE INTO Attendance (id, childId, date, present, status, markedAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [`demo-attendance-${index + 1}`, id, dateKey, index % 4 !== 0 ? 1 : 0, index % 4 !== 0 ? 'PRESENT' : 'ABSENT', now, now],
        });
      }
    }

    await client.execute({
      sql: 'INSERT OR IGNORE INTO Event (id, title, date, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['demo-event-sunday', 'École du dimanche', new Date().toISOString().slice(0, 10), 'Séance de démonstration', now, now],
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO MediaResource (id, type, title, url, thumbnail, aspectRatio, createdAt)
        VALUES (?, 'image', ?, ?, ?, 'wide', ?)`,
      args: ['demo-resource-banner', 'Ressource de démonstration', '/goshen-auth-logo.png', 'bg-emerald-900', now],
    });

    console.log('Base démo initialisée : 2 comptes, 70 enfants, présences, événement et ressource fictifs.');
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error('Échec de l’initialisation de la base démo :', error);
  process.exitCode = 1;
});
