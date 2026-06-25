import Dexie, { type EntityTable } from 'dexie';

export interface Child {
  id: string; // Changed to string for UUID/CUID compatibility with Prisma
  firstName: string;
  lastName: string;
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
  markedAt: string;
}

export interface SyncState {
  key: string;
  value: string;
}

// Générateur basique d'ID unique (fallback simple pour mode hors-ligne)
export const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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
    const attendances = await db.attendances.toArray();

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
