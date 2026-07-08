import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const shouldApply = process.argv.includes('--apply');

function getArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() || '';
}

const id = getArg('id');
const contains = getArg('contains').toLowerCase();
const firstName = getArg('first');
const lastName = getArg('last');
const postName = getArg('post');

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

function normalizeName(value) {
  return (value ?? '').trim().toLowerCase();
}

function displayChild(child) {
  return [
    `id=${child.id}`,
    `lastName="${child.lastName}"`,
    `postName="${child.postName}"`,
    `firstName="${child.firstName}"`,
    `classLevel="${child.classLevel}"`,
    `parentPhone="${child.parentPhone}"`,
    `birthDate="${child.birthDate ?? ''}"`,
  ].join(' | ');
}

async function findChildren() {
  if (id) {
    return prisma.$queryRaw`
      SELECT id, firstName, lastName, postName, classLevel, parentPhone, birthDate, createdAt, updatedAt
      FROM Child
      WHERE id = ${id}
      ORDER BY createdAt ASC
    `;
  }

  if (!contains) {
    throw new Error('Ajoute --contains=texte ou --id=id-enfant.');
  }

  const pattern = `%${contains}%`;

  return prisma.$queryRaw`
    SELECT id, firstName, lastName, postName, classLevel, parentPhone, birthDate, createdAt, updatedAt
    FROM Child
    WHERE lower(firstName) LIKE ${pattern}
       OR lower(lastName) LIKE ${pattern}
       OR lower(postName) LIKE ${pattern}
    ORDER BY createdAt ASC
  `;
}

async function main() {
  const children = await findChildren();

  if (children.length === 0) {
    console.log('Aucun enfant trouvé.');
    return;
  }

  console.log(`${children.length} enfant(s) trouvé(s):`);
  children.forEach((child) => console.log(displayChild(child)));

  if (!firstName && !lastName && !postName) {
    console.log('\nAperçu seulement. Ajoute --last=... --post=... --first=... pour corriger les champs.');
    return;
  }

  if (!shouldApply) {
    console.log('\nAperçu seulement. Relance avec --apply pour modifier la base.');
    console.log(`Nouvelle valeur: lastName="${lastName}" | postName="${postName}" | firstName="${firstName}"`);
    return;
  }

  if (!id && children.length !== 1) {
    throw new Error('Plusieurs enfants correspondent. Relance avec --id=<id exact> pour éviter une correction trop large.');
  }

  const targetId = id || children[0].id;

  await prisma.$executeRaw`
    UPDATE Child
    SET lastName = ${normalizeName(lastName)},
        postName = ${normalizeName(postName)},
        firstName = ${normalizeName(firstName)},
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${targetId}
  `;

  console.log(`Correction appliquée sur ${targetId}.`);
}

main()
  .catch((error) => {
    console.error('Erreur correction nom enfant:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
