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
  updatedAt?: string;
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

export type SyncEntity = 'child' | 'attendance';

export interface PendingSyncItem {
  key: string;
  entity: SyncEntity;
  id: string;
  updatedAt: string;
}

interface SyncDeltaResponse {
  success: boolean;
  children?: Child[];
  attendances?: Attendance[];
  serverSyncedAt?: string;
  error?: string;
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

const db = new Dexie('SundaySchoolDB') as Dexie & {
  children: EntityTable<Child, 'id'>;
  attendances: EntityTable<Attendance, 'id'>;
  syncState: EntityTable<SyncState, 'key'>;
  pendingSync: EntityTable<PendingSyncItem, 'key'>;
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

db.version(6)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
    pendingSync: 'key, entity, id, updatedAt',
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

export async function markEntityForSync(entity: SyncEntity, id: string) {
  await db.pendingSync.put({
    key: `${entity}:${id}`,
    entity,
    id,
    updatedAt: new Date().toISOString(),
  });
  await markPendingChange();
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

function getAttendanceKey(attendance: Pick<Attendance, 'childId' | 'date'>) {
  return `${attendance.childId}:${attendance.date}`;
}

function normalizeServerChild(child: Child): Child {
  return {
    ...child,
    postName: child.postName ?? '',
    classLevel: normalizeClassLevel(child.classLevel),
    parentPhone: child.parentPhone ?? '',
    address: child.address ?? '',
    createdAt: child.createdAt,
  };
}

function normalizeServerAttendance(attendance: Attendance): Attendance {
  const status = getAttendanceStatus(attendance) ?? 'ABSENT';

  return {
    ...attendance,
    status,
    present: status === 'PRESENT',
    markedAt: attendance.markedAt,
  };
}

async function getEffectivePendingItems(pendingItems: PendingSyncItem[], pendingChanges: number) {
  if (pendingItems.length > 0 || pendingChanges === 0) {
    return pendingItems;
  }

  const [children, attendances] = await Promise.all([
    db.children.toArray(),
    db.attendances.toArray(),
  ]);
  const now = new Date().toISOString();

  return [
    ...children.map((child) => ({
      key: `child:${child.id}`,
      entity: 'child' as const,
      id: child.id,
      updatedAt: now,
    })),
    ...attendances.map((attendance) => ({
      key: `attendance:${attendance.id}`,
      entity: 'attendance' as const,
      id: attendance.id,
      updatedAt: now,
    })),
  ];
}

async function applyServerDelta(data: SyncDeltaResponse) {
  const deltaChildren = (data.children ?? []).map(normalizeServerChild);
  const deltaAttendances = (data.attendances ?? []).map(normalizeServerAttendance);

  await db.transaction('rw', db.children, db.attendances, async () => {
    if (deltaChildren.length > 0) {
      await db.children.bulkPut(deltaChildren);
    }

    if (deltaAttendances.length > 0) {
      await db.attendances.bulkPut(deltaAttendances);
    }
  });

  return {
    pulledChildrenCount: deltaChildren.length,
    pulledAttendancesCount: deltaAttendances.length,
  };
}

// Fonction de synchronisation avec le serveur
export async function syncWithServer() {
  try {
    const pendingItems = await db.pendingSync.toArray();
    const pendingChanges = Number(await getStateValue(PENDING_CHANGES_KEY)) || 0;
    const lastSyncAt = await getStateValue(LAST_SYNC_KEY);
    const [localChildren, localAttendances] = await Promise.all([
      db.children.toArray(),
      db.attendances.toArray(),
    ]);
    const effectivePendingItems = await getEffectivePendingItems(pendingItems, pendingChanges);
    const childIds = effectivePendingItems.filter((item) => item.entity === 'child').map((item) => item.id);
    const attendanceIds = effectivePendingItems.filter((item) => item.entity === 'attendance').map((item) => item.id);
    const children = childIds.length > 0
      ? await db.children.bulkGet(childIds)
      : [];
    const attendances = attendanceIds.length > 0
      ? await db.attendances.bulkGet(attendanceIds)
      : [];
    const changedChildren = children.filter((child): child is Child => Boolean(child));
    const changedAttendances = attendances.filter((attendance): attendance is Attendance => Boolean(attendance)).map((attendance) => {
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
      body: JSON.stringify({
        mode: 'sync-delta',
        lastSyncAt,
        knownChildIds: localChildren.map((child) => child.id),
        knownAttendanceKeys: localAttendances.map(getAttendanceKey),
        children: changedChildren,
        attendances: changedAttendances,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as SyncDeltaResponse;

      if (!data.success) {
        return {
          success: false,
          error: data.error ?? 'Échec de la synchronisation',
        };
      }

      const pullResult = await applyServerDelta(data);

      await db.transaction('rw', db.syncState, db.pendingSync, async () => {
        await setStateValue(PENDING_CHANGES_KEY, '0');
        await setStateValue(LAST_SYNC_KEY, data.serverSyncedAt ?? new Date().toISOString());
        await db.pendingSync.bulkDelete(pendingItems.map((item) => item.key));
      });

      return {
        success: true,
        childrenCount: changedChildren.length,
        attendancesCount: changedAttendances.length,
        pulledChildrenCount: pullResult.pulledChildrenCount,
        pulledAttendancesCount: pullResult.pulledAttendancesCount,
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
