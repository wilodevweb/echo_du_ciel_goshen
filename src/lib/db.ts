import Dexie, { type EntityTable } from 'dexie';

export type ClassLevel = 'FIRST' | 'SECOND' | 'THIRD';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'SICK';
export type ClassFilter = ClassLevel | 'ALL';

export interface Child {
  id: string; // Changed to string for UUID/CUID compatibility with Prisma
  firstName: string;
  lastName: string;
  postName: string;
  classLevel: ClassLevel;
  photoUrl?: string;
  parentPhone: string;
  address: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Attendance {
  id: string; // Changed to string
  childId: string; // References Child.id
  date: string; // Format: YYYY-MM-DD
  present: boolean;
  status?: AttendanceStatus;
  markedAt: string;
}

export interface SyncState {
  key: string;
  value: string;
}

// Générateur basique d'ID unique (fallback simple pour mode hors-ligne)
export const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const CLASS_LEVELS: Array<{ value: ClassLevel; label: string }> = [
  { value: 'FIRST', label: '1ere classe' },
  { value: 'SECOND', label: '2e classe' },
  { value: 'THIRD', label: '3e classe' },
];

export const CLASS_FILTERS: Array<{ value: ClassFilter; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  ...CLASS_LEVELS,
];

export function normalizeClassLevel(value?: string | null): ClassLevel {
  return value === 'SECOND' || value === 'THIRD' ? value : 'FIRST';
}

export function getClassLabel(value?: string | null) {
  const normalizedValue = normalizeClassLevel(value);
  return CLASS_LEVELS.find((level) => level.value === normalizedValue)?.label ?? '1ere classe';
}

export function getClassNumber(value?: string | null) {
  const normalizedValue = normalizeClassLevel(value);
  if (normalizedValue === 'SECOND') return '2';
  if (normalizedValue === 'THIRD') return '3';
  return '1';
}

export function getAttendanceStatus(attendance?: Pick<Attendance, 'status' | 'present'> | null) {
  if (!attendance) return null;
  if (attendance.status === 'PRESENT' || attendance.status === 'ABSENT' || attendance.status === 'SICK') {
    return attendance.status;
  }

  return attendance.present ? 'PRESENT' : 'ABSENT';
}

export function getStatusLabel(status: AttendanceStatus | null) {
  if (status === 'PRESENT') return 'Present';
  if (status === 'ABSENT') return 'Absent';
  if (status === 'SICK') return 'Malade';
  return 'Non marque';
}

const SAMPLE_CHILDREN: Array<Omit<Child, 'id' | 'createdAt'>> = [
  { lastName: 'Kabasele', postName: 'Mbuyi', firstName: 'Elie', classLevel: 'FIRST', parentPhone: '+243 811 000 101', address: 'Goshen, Quartier Centre', birthDate: '2018-02-14', notes: 'Aime chanter.' },
  { lastName: 'Ilunga', postName: 'Kabongo', firstName: 'Sarah', classLevel: 'FIRST', parentPhone: '+243 811 000 102', address: 'Goshen, Avenue Paix', birthDate: '2018-05-21', notes: '' },
  { lastName: 'Mwamba', postName: 'Tshibangu', firstName: 'David', classLevel: 'FIRST', parentPhone: '+243 811 000 103', address: 'Goshen, Bloc A', birthDate: '2017-11-03', notes: 'Allergie arachides.' },
  { lastName: 'Nkulu', postName: 'Kalala', firstName: 'Grace', classLevel: 'FIRST', parentPhone: '+243 811 000 104', address: 'Goshen, Bloc B', birthDate: '2018-07-12', notes: '' },
  { lastName: 'Banza', postName: 'Kanku', firstName: 'Daniel', classLevel: 'FIRST', parentPhone: '+243 811 000 105', address: 'Goshen, Route Eglise', birthDate: '2017-09-18', notes: '' },
  { lastName: 'Kitenge', postName: 'Mulumba', firstName: 'Esther', classLevel: 'FIRST', parentPhone: '+243 811 000 106', address: 'Goshen, Quartier Est', birthDate: '2018-01-30', notes: '' },
  { lastName: 'Tshibanda', postName: 'Mukendi', firstName: 'Samuel', classLevel: 'SECOND', parentPhone: '+243 811 000 201', address: 'Goshen, Quartier Nord', birthDate: '2016-03-10', notes: '' },
  { lastName: 'Kasongo', postName: 'Mbuyamba', firstName: 'Naomi', classLevel: 'SECOND', parentPhone: '+243 811 000 202', address: 'Goshen, Avenue Source', birthDate: '2016-08-09', notes: 'Porte lunettes.' },
  { lastName: 'Lukusa', postName: 'Kalonji', firstName: 'Joseph', classLevel: 'SECOND', parentPhone: '+243 811 000 203', address: 'Goshen, Bloc C', birthDate: '2015-12-27', notes: '' },
  { lastName: 'Mbala', postName: 'Ngoy', firstName: 'Deborah', classLevel: 'SECOND', parentPhone: '+243 811 000 204', address: 'Goshen, Bloc D', birthDate: '2016-06-16', notes: '' },
  { lastName: 'Kiala', postName: 'Mutombo', firstName: 'Isaac', classLevel: 'SECOND', parentPhone: '+243 811 000 205', address: 'Goshen, Avenue Lumiere', birthDate: '2015-10-05', notes: '' },
  { lastName: 'Ndaya', postName: 'Kabasele', firstName: 'Ruth', classLevel: 'SECOND', parentPhone: '+243 811 000 206', address: 'Goshen, Quartier Sud', birthDate: '2016-04-24', notes: '' },
  { lastName: 'Makiese', postName: 'Tshimanga', firstName: 'Josue', classLevel: 'THIRD', parentPhone: '+243 811 000 301', address: 'Goshen, Avenue Royaume', birthDate: '2014-01-11', notes: '' },
  { lastName: 'Kanku', postName: 'Kabeya', firstName: 'Rebecca', classLevel: 'THIRD', parentPhone: '+243 811 000 302', address: 'Goshen, Bloc E', birthDate: '2014-09-02', notes: 'Asthme leger.' },
  { lastName: 'Mutombo', postName: 'Lwamba', firstName: 'Emmanuel', classLevel: 'THIRD', parentPhone: '+243 811 000 303', address: 'Goshen, Route Principale', birthDate: '2013-07-19', notes: '' },
  { lastName: 'Kalonji', postName: 'Beya', firstName: 'Miriam', classLevel: 'THIRD', parentPhone: '+243 811 000 304', address: 'Goshen, Quartier Ouest', birthDate: '2014-12-08', notes: '' },
  { lastName: 'Kabongo', postName: 'Mwepu', firstName: 'Nathan', classLevel: 'THIRD', parentPhone: '+243 811 000 305', address: 'Goshen, Avenue Joie', birthDate: '2013-05-29', notes: '' },
  { lastName: 'Tshilumba', postName: 'Ngalula', firstName: 'Lea', classLevel: 'THIRD', parentPhone: '+243 811 000 306', address: 'Goshen, Bloc F', birthDate: '2014-03-15', notes: '' },
];

export async function seedSampleChildren() {
  const now = new Date().toISOString();
  const existingCount = await db.children.count();

  if (existingCount > 0) {
    return { added: 0, skipped: true };
  }

  await db.children.bulkAdd(
    SAMPLE_CHILDREN.map((child) => ({
      ...child,
      id: generateId(),
      createdAt: now,
    })),
  );

  await markPendingChange();
  return { added: SAMPLE_CHILDREN.length, skipped: false };
}

const db = new Dexie('SundaySchoolDB') as Dexie & {
  children: EntityTable<Child, 'id'>;
  attendances: EntityTable<Attendance, 'id'>;
  syncState: EntityTable<SyncState, 'key'>;
};

// Schéma de la base de données (id is no longer auto-incremented `++id`, we set it manually)
db.version(2).stores({
  children: 'id, firstName, lastName, parentPhone',
  attendances: 'id, childId, date, [childId+date]'
});

db.version(3).stores({
  children: 'id, firstName, lastName, parentPhone',
  attendances: 'id, childId, date, [childId+date]',
  syncState: 'key',
});

db.version(4)
  .stores({
    children: 'id, firstName, lastName, parentPhone, classLevel',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
  })
  .upgrade(async (transaction) => {
    await transaction.table('children').toCollection().modify((child) => {
      child.classLevel = normalizeClassLevel(child.classLevel);
    });

    await transaction.table('attendances').toCollection().modify((attendance) => {
      attendance.status = attendance.status ?? (attendance.present ? 'PRESENT' : 'ABSENT');
    });
  });

db.version(5)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
  })
  .upgrade(async (transaction) => {
    await transaction.table('children').toCollection().modify((child) => {
      child.postName = child.postName ?? '';
      child.classLevel = normalizeClassLevel(child.classLevel);
    });
  });

const PENDING_CHANGES_KEY = 'pendingChanges';
const LAST_LOCAL_CHANGE_KEY = 'lastLocalChangeAt';
const LAST_SYNC_KEY = 'lastSyncAt';

async function getStateValue(key: string) {
  return (await db.syncState.get(key))?.value;
}

async function setStateValue(key: string, value: string) {
  await db.syncState.put({ key, value });
}

export async function markPendingChange() {
  const pendingChanges = Number(await getStateValue(PENDING_CHANGES_KEY)) || 0;

  await db.transaction('rw', db.syncState, async () => {
    await setStateValue(PENDING_CHANGES_KEY, String(pendingChanges + 1));
    await setStateValue(LAST_LOCAL_CHANGE_KEY, new Date().toISOString());
  });
}

export async function getSyncStatus() {
  const [pendingChanges, lastLocalChangeAt, lastSyncAt] = await Promise.all([
    getStateValue(PENDING_CHANGES_KEY),
    getStateValue(LAST_LOCAL_CHANGE_KEY),
    getStateValue(LAST_SYNC_KEY),
  ]);

  return {
    pendingChanges: Number(pendingChanges) || 0,
    lastLocalChangeAt,
    lastSyncAt,
  };
}

// Fonction de synchronisation avec le serveur
export async function syncWithServer() {
  try {
    const children = await db.children.toArray();
    const attendances = (await db.attendances.toArray()).map((attendance) => {
      const status = getAttendanceStatus(attendance) ?? 'ABSENT';

      return {
        ...attendance,
        status,
        present: status === 'PRESENT',
      };
    });

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ children, attendances }),
    });

    if (response.ok) {
      await db.transaction('rw', db.syncState, async () => {
        await setStateValue(PENDING_CHANGES_KEY, '0');
        await setStateValue(LAST_SYNC_KEY, new Date().toISOString());
      });

      return {
        success: true,
        childrenCount: children.length,
        attendancesCount: attendances.length,
      };
    }

    return {
      success: false,
      error: 'Échec de la synchronisation',
    };
  } catch (error) {
    console.error('Erreur réseau lors de la synchronisation:', error);
    return {
      success: false,
      error: 'Erreur réseau lors de la synchronisation',
    };
  }
}

export default db;
