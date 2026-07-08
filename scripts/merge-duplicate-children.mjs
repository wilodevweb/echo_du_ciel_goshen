import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const shouldApply = process.argv.includes('--apply');
const nameFilterArg = process.argv.find((arg) => arg.startsWith('--name='));
const nameFilter = nameFilterArg?.slice('--name='.length).trim().toLowerCase() || '';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

function normalizeName(value) {
  return (value ?? '').trim().toLowerCase();
}

function normalizeOptional(value) {
  return (value ?? '').trim();
}

function fullName(child) {
  return [child.lastName, child.postName, child.firstName].filter(Boolean).join(' ');
}

function asDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function identityKey(child) {
  return [
    normalizeName(child.firstName),
    normalizeName(child.lastName),
    normalizeName(child.postName),
  ].join('|');
}

function isMergeCandidate(a, b) {
  if (identityKey(a) !== identityKey(b)) return false;

  const aBirthDate = normalizeOptional(a.birthDate);
  const bBirthDate = normalizeOptional(b.birthDate);
  const aParentPhone = normalizeOptional(a.parentPhone);
  const bParentPhone = normalizeOptional(b.parentPhone);
  const aParentId = normalizeOptional(a.parentId);
  const bParentId = normalizeOptional(b.parentId);

  if (aBirthDate && bBirthDate && aBirthDate === bBirthDate) return true;
  if (aParentPhone && bParentPhone && aParentPhone === bParentPhone) return true;
  if (aParentId && bParentId && aParentId === bParentId) return true;
  if (a.classLevel === b.classLevel) return true;

  const aHasStrongIdentity = Boolean(aBirthDate || aParentPhone || aParentId);
  const bHasStrongIdentity = Boolean(bBirthDate || bParentPhone || bParentId);

  return (!aHasStrongIdentity || !bHasStrongIdentity) && a.classLevel === b.classLevel;
}

function buildDuplicateSets(children) {
  const byName = new Map();

  for (const child of children) {
    const key = identityKey(child);
    const group = byName.get(key) ?? [];
    group.push(child);
    byName.set(key, group);
  }

  const sets = [];

  for (const group of byName.values()) {
    if (group.length < 2) continue;

    const visited = new Set();
    for (const child of group) {
      if (visited.has(child.id)) continue;

      const duplicateSet = group.filter((candidate) => isMergeCandidate(child, candidate));
      duplicateSet.forEach((candidate) => visited.add(candidate.id));

      if (duplicateSet.length > 1) {
        duplicateSet.sort((a, b) => {
          const dateDiff = asDate(a.createdAt).getTime() - asDate(b.createdAt).getTime();
          return dateDiff || a.id.localeCompare(b.id);
        });
        sets.push(duplicateSet);
      }
    }
  }

  return sets;
}

function pickValue(primary, fallback) {
  return normalizeOptional(primary) || normalizeOptional(fallback) || primary || fallback;
}

async function mergeDuplicateSet(children) {
  const [canonical, ...duplicates] = children;

  await prisma.$transaction(async (tx) => {
    for (const duplicate of duplicates) {
      const canonicalAttendances = await tx.$queryRaw`
        SELECT id, date, markedAt
        FROM Attendance
        WHERE childId = ${canonical.id}
      `;
      const canonicalByDate = new Map(canonicalAttendances.map((attendance) => [attendance.date, attendance]));
      const duplicateAttendances = await tx.$queryRaw`
        SELECT id, childId, date, present, status, markedAt
        FROM Attendance
        WHERE childId = ${duplicate.id}
      `;

      for (const attendance of duplicateAttendances) {
        const existingAttendance = canonicalByDate.get(attendance.date);

        if (existingAttendance) {
          if (asDate(attendance.markedAt) > asDate(existingAttendance.markedAt)) {
            await tx.$executeRaw`
              UPDATE Attendance
              SET present = ${attendance.present},
                  status = ${attendance.status},
                  markedAt = ${attendance.markedAt}
              WHERE id = ${existingAttendance.id}
            `;
          }

          await tx.$executeRaw`
            DELETE FROM Attendance
            WHERE id = ${attendance.id}
          `;
        } else {
          await tx.$executeRaw`
            UPDATE Attendance
            SET childId = ${canonical.id}
            WHERE id = ${attendance.id}
          `;
        }
      }
    }

    const bestData = duplicates.reduce((data, duplicate) => ({
      gender: pickValue(data.gender, duplicate.gender),
      classLevel: pickValue(data.classLevel, duplicate.classLevel),
      parentPhone: pickValue(data.parentPhone, duplicate.parentPhone),
      parentFirstName: pickValue(data.parentFirstName, duplicate.parentFirstName),
      parentLastName: pickValue(data.parentLastName, duplicate.parentLastName),
      address: pickValue(data.address, duplicate.address),
      birthDate: pickValue(data.birthDate, duplicate.birthDate),
      notes: pickValue(data.notes, duplicate.notes),
      photoUrl: pickValue(data.photoUrl, duplicate.photoUrl),
      parentId: pickValue(data.parentId, duplicate.parentId),
    }), canonical);

    await tx.$executeRaw`
      UPDATE Child
      SET gender = ${bestData.gender},
          classLevel = ${bestData.classLevel},
          parentPhone = ${bestData.parentPhone},
          parentFirstName = ${bestData.parentFirstName},
          parentLastName = ${bestData.parentLastName},
          address = ${bestData.address},
          birthDate = ${bestData.birthDate || null},
          notes = ${bestData.notes || null},
          photoUrl = ${bestData.photoUrl || null},
          parentId = ${bestData.parentId || null},
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${canonical.id}
    `;

    for (const duplicate of duplicates) {
      await tx.$executeRaw`
        DELETE FROM Child
        WHERE id = ${duplicate.id}
      `;
    }
  });
}

async function main() {
  const children = await prisma.$queryRaw`
    SELECT
      id,
      firstName,
      lastName,
      postName,
      gender,
      classLevel,
      parentPhone,
      parentFirstName,
      parentLastName,
      address,
      birthDate,
      notes,
      photoUrl,
      createdAt,
      updatedAt,
      parentId
    FROM Child
    ORDER BY lastName ASC, postName ASC, firstName ASC, createdAt ASC
  `;
  const duplicateSets = buildDuplicateSets(children)
    .filter((set) => !nameFilter || set.some((child) => fullName(child).toLowerCase().includes(nameFilter)));

  if (duplicateSets.length === 0) {
    console.log('Aucun doublon enfant éligible trouvé.');
    return;
  }

  console.log(`${duplicateSets.length} groupe(s) de doublons enfant trouvé(s).`);

  for (const set of duplicateSets) {
    const [canonical, ...duplicates] = set;
    console.log(`\nGarder: ${canonical.id} - ${fullName(canonical)} (${asDate(canonical.createdAt).toISOString()})`);
    duplicates.forEach((duplicate) => {
      console.log(`Fusionner: ${duplicate.id} - ${fullName(duplicate)} (${asDate(duplicate.createdAt).toISOString()})`);
    });

    if (shouldApply) {
      await mergeDuplicateSet(set);
      console.log('Fusion appliquée.');
    }
  }

  if (!shouldApply) {
    console.log('\nAperçu seulement. Relancer avec --apply pour modifier la base.');
  }
}

main()
  .catch((error) => {
    console.error('Erreur fusion doublons enfants:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
