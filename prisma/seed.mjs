import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter =
  url.startsWith('libsql://') || url.startsWith('https://')
    ? new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

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

async function main() {
  console.log('Debut du seeding...');

  for (const user of defaultUsers) {
    const password = await bcrypt.hash(user.password, 10);

    const savedUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        name: user.name,
        password,
        role: user.role,
      },
      create: {
        username: user.username,
        name: user.name,
        password,
        role: user.role,
      },
    });

    console.log(`Utilisateur pret : ${savedUser.username} (${savedUser.role})`);
  }

  for (const child of defaultChildren) {
    const existingChildren = await prisma.$queryRaw`
      SELECT id FROM Child
      WHERE lastName = ${child.lastName}
        AND postName = ${child.postName}
        AND firstName = ${child.firstName}
        AND birthDate = ${child.birthDate}
      LIMIT 1
    `;
    const childId = existingChildren[0]?.id ?? childSeedId(child);

    if (existingChildren[0]?.id) {
      await prisma.$executeRaw`
        UPDATE Child
        SET firstName = ${child.firstName},
            lastName = ${child.lastName},
            postName = ${child.postName},
            classLevel = ${child.classLevel},
            parentPhone = '',
            address = '',
            birthDate = ${child.birthDate},
            notes = '',
            photoUrl = NULL,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${childId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO Child (
          id,
          firstName,
          lastName,
          postName,
          classLevel,
          parentPhone,
          address,
          birthDate,
          notes,
          photoUrl,
          createdAt,
          updatedAt
        )
        VALUES (
          ${childId},
          ${child.firstName},
          ${child.lastName},
          ${child.postName},
          ${child.classLevel},
          '',
          '',
          ${child.birthDate},
          '',
          NULL,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          firstName = excluded.firstName,
          lastName = excluded.lastName,
          postName = excluded.postName,
          classLevel = excluded.classLevel,
          parentPhone = excluded.parentPhone,
          address = excluded.address,
          birthDate = excluded.birthDate,
          notes = excluded.notes,
          photoUrl = excluded.photoUrl,
          updatedAt = CURRENT_TIMESTAMP
      `;
    }

    console.log(`Enfant pret : ${child.lastName} ${child.postName} ${child.firstName}`);
  }

  console.log('Seeding termine.');
}

main()
  .catch((error) => {
    console.error('Erreur lors du seeding:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
