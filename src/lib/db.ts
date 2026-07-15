import Dexie, { type EntityTable } from 'dexie';
import { SYNC_ATTENDANCE_MIN_DATE } from '@/lib/constants';

export type ClassLevel = 'FIRST' | 'SECOND' | 'THIRD';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'SICK';
export type ClassFilter = ClassLevel | 'ALL';

export interface Child {
  id: string; // Changed to string for UUID/CUID compatibility with Prisma
  firstName: string;
  lastName: string;
  postName: string;
  gender: 'M' | 'F';
  classLevel: ClassLevel;
  photoUrl?: string;
  parentPhone: string;
  parentName?: string;
  address: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  address: string;
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

// Événements locaux (non synchronisés avec le serveur)
export interface ChildEvent {
  id: string;
  title: string;        // Ex: "Fête de Noël 2026", "Journée Sportive"
  date: string;         // Format: YYYY-MM-DD
  description?: string;
  createdAt: string;
}

// Tâches liées à un enfant pour un événement (non synchronisées)
export interface ChildTask {
  id: string;
  eventId: string;      // Référence à ChildEvent.id
  childId: string;      // Référence à Child.id
  title: string;        // Ex: "Lire Psaume 23", "Apporter les chaises"
  done: boolean;
  createdAt: string;
}

export interface SyncState {
  key: string;
  value: string;
}

export type SyncEntity = 'child' | 'attendance';
export type ChildSyncField = 'firstName' | 'lastName' | 'postName' | 'classLevel' | 'parentPhone' | 'address' | 'birthDate' | 'notes' | 'photoUrl' | 'gender' | 'parentName' | 'parentId';

export interface PendingSyncItem {
  key: string;
  entity: SyncEntity;
  id: string;
  updatedAt: string;
  fields?: ChildSyncField[];
}

export function isDeletedChildRecord(child: Pick<Child, "firstName" | "lastName" | "postName">) {
  return !child.firstName?.trim() && !child.lastName?.trim() && !child.postName?.trim();
}

export function getChildIdentityKey(child: Pick<Child, "firstName" | "lastName" | "postName" | "classLevel">) {
  return [
    normalizeName(child.lastName),
    normalizeName(child.postName),
    normalizeName(child.firstName),
    normalizeClassLevel(child.classLevel),
  ].join("|");
}

export function normalizeName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeChildNameFields(child: Partial<Pick<Child, "firstName" | "lastName" | "postName" | "parentName">>) {
  return {
    ...child,
    firstName: normalizeName(child.firstName),
    lastName: normalizeName(child.lastName),
    postName: normalizeName(child.postName),
    parentName: normalizeName(child.parentName),
  };
}

export function normalizeParentNameFields(parent: Partial<Pick<Parent, "name">>) {
  return {
    ...parent,
    name: normalizeName(parent.name),
  };
}

interface SyncDeltaResponse {
  success: boolean;
  children?: Child[];
  parents?: Parent[];
  attendances?: Attendance[];
  c?: CompactServerChild[];
  p?: CompactServerParent[];
  a?: CompactServerAttendance[];
  d?: string[];
  serverSyncedAt?: string;
  error?: string;
  activeChildIds?: string[];
  activeParentIds?: string[];
}

type CompactChildPatch = [string, string, ...string[]];
type CompactAttendancePatch = [string, string, string];
type CompactServerChild = [
  string, // id
  string, // firstName
  string, // lastName
  string, // postName
  string, // classLevel
  string, // parentPhone
  string, // address
  string, // birthDate
  string, // notes
  string, // photoUrl
  string, // createdAt
  string, // updatedAt
  string, // gender
  string, // parentName
  string, // parentId
];
type CompactServerParent = [
  string, // id
  string, // name
  string, // phone
  string, // address
  string, // createdAt
  string, // updatedAt
];
type CompactServerAttendance = [string, string, string, string, string];

const CHILD_SYNC_FIELDS: ChildSyncField[] = [
  'firstName',
  'lastName',
  'postName',
  'classLevel',
  'parentPhone',
  'address',
  'birthDate',
  'notes',
  'photoUrl',
  'gender',
  'parentName',
  'parentId',
];
const CHILD_FIELD_CODES: Record<ChildSyncField, string> = {
  firstName: 'f',
  lastName: 'l',
  postName: 'o',
  classLevel: 'c',
  parentPhone: 't',
  address: 'a',
  birthDate: 'b',
  notes: 'n',
  photoUrl: 'h',
  gender: 'g',
  parentName: 'u',
  parentId: 'p',
};
const SYNC_BATCH_SIZE = 5;
const MAX_SYNC_BATCH_BYTES = 700_000;
const MAX_SYNC_STRING_VALUE_LENGTH = 100_000;

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

function encodeClassLevel(value?: string | null) {
  const classLevel = normalizeClassLevel(value);
  if (classLevel === 'SECOND') return '2';
  if (classLevel === 'THIRD') return '3';
  return '1';
}

function decodeClassLevel(value?: string | null): ClassLevel {
  if (value === '2') return 'SECOND';
  if (value === '3') return 'THIRD';
  return 'FIRST';
}

function encodeStatus(status: AttendanceStatus | null) {
  if (status === 'PRESENT') return 'p';
  if (status === 'SICK') return 'm';
  return 'a';
}

function decodeStatus(code?: string | null): AttendanceStatus {
  if (code === 'p') return 'PRESENT';
  if (code === 'm') return 'SICK';
  return 'ABSENT';
}

function encodeDate(value?: string | null) {
  return value ? value.replaceAll('-', '') : '';
}

function decodeDate(value?: string | null) {
  if (!value) return '';
  if (value.includes('-')) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

const db = new Dexie('SundaySchoolDB') as Dexie & {
  children: EntityTable<Child, 'id'>;
  parents: EntityTable<Parent, 'id'>;
  attendances: EntityTable<Attendance, 'id'>;
  syncState: EntityTable<SyncState, 'key'>;
  pendingSync: EntityTable<PendingSyncItem, 'key'>;
  events: EntityTable<ChildEvent, 'id'>;
  tasks: EntityTable<ChildTask, 'id'>;
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

db.version(7)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel, gender, parentId',
    parents: 'id, phone, firstName, lastName',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
    pendingSync: 'key, entity, id, updatedAt',
  })
  .upgrade(async (transaction) => {
    await transaction.table('children').toCollection().modify((child) => {
      child.gender = child.gender ?? 'M';
      child.parentFirstName = child.parentFirstName ?? '';
      child.parentLastName = child.parentLastName ?? '';
    });
  });

db.version(8)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel, gender, parentId, createdAt',
    parents: 'id, phone, firstName, lastName',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
    pendingSync: 'key, entity, id, updatedAt',
  });

db.version(9)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel, gender, parentId, createdAt',
    parents: 'id, phone, name',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
    pendingSync: 'key, entity, id, updatedAt',
  })
  .upgrade(async (transaction) => {
    // Migrer les parents existants : fusionner firstName et lastName en name
    await transaction.table('parents').toCollection().modify((parent) => {
      parent.name = `${parent.lastName ?? ""} ${parent.firstName ?? ""}`.trim();
      delete parent.firstName;
      delete parent.lastName;
    });

    // Migrer les enfants existants : fusionner parentFirstName et parentLastName en parentName
    await transaction.table('children').toCollection().modify((child) => {
      child.parentName = `${child.parentLastName ?? ""} ${child.parentFirstName ?? ""}`.trim();
      delete child.parentFirstName;
      delete child.parentLastName;
    });
  });

db.version(10)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel, gender, parentId, createdAt',
    parents: 'id, phone, name',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
    pendingSync: 'key, entity, id, updatedAt',
    events: 'id, date, createdAt',
    tasks: 'id, eventId, childId, [eventId+childId]',
  });

const LAST_LOCAL_CHANGE_KEY = 'lastLocalChangeAt';
const LAST_SYNC_KEY = 'lastSyncAt';

async function getStateValue(key: string) {
  return (await db.syncState.get(key))?.value;
}

async function setStateValue(key: string, value: string) {
  await db.syncState.put({ key, value });
}

export async function markPendingChange() {
  await db.transaction('rw', db.syncState, async () => {
    await setStateValue(LAST_LOCAL_CHANGE_KEY, new Date().toISOString());
  });
}

export async function markEntityForSync(entity: SyncEntity, id: string, fields?: ChildSyncField[]) {
  const key = `${entity}:${id}`;
  const existingItem = await db.pendingSync.get(key);
  const nextFields = entity === 'child' && fields?.length
    ? Array.from(new Set([...(existingItem?.fields ?? []), ...fields]))
    : existingItem?.fields;

  await db.pendingSync.put({
    key: `${entity}:${id}`,
    entity,
    id,
    updatedAt: new Date().toISOString(),
    fields: nextFields,
  });
  await markPendingChange();
}

function isInlineDataUrl(value?: string | null) {
  return Boolean(value?.startsWith('data:'));
}

function getSyncStringValue(field: ChildSyncField, value: unknown) {
  // Les photos Base64 sont maintenant autorisées car on les upload sur Vercel Blob côté serveur


  const stringValue = String(value ?? '');

  if (stringValue.length > MAX_SYNC_STRING_VALUE_LENGTH) {
    return stringValue.slice(0, MAX_SYNC_STRING_VALUE_LENGTH);
  }

  return stringValue;
}


// Suppression complète du système de doublons devenu obsolète
export async function getSyncStatus() {
  const [pendingChanges, lastLocalChangeAt, lastSyncAt] = await Promise.all([
    db.pendingSync.count(),
    getStateValue(LAST_LOCAL_CHANGE_KEY),
    getStateValue(LAST_SYNC_KEY),
  ]);

  return {
    pendingChanges,
    lastLocalChangeAt,
    lastSyncAt,
  };
}


function normalizeServerChild(child: Child): Child {
  return {
    ...child,
    firstName: normalizeName(child.firstName),
    lastName: normalizeName(child.lastName),
    postName: normalizeName(child.postName),
    parentName: normalizeName(child.parentName || ''),
    classLevel: normalizeClassLevel(child.classLevel),
    parentPhone: child.parentPhone ?? '',
    address: child.address ?? '',
    createdAt: child.createdAt,
    gender: child.gender ?? 'M',
    parentId: child.parentId,
  };
}

function decodeCompactServerChild(child: CompactServerChild): Child {
  return normalizeServerChild({
    id: child[0],
    firstName: child[1],
    lastName: child[2],
    postName: child[3],
    classLevel: decodeClassLevel(child[4]),
    parentPhone: child[5],
    address: child[6],
    birthDate: decodeDate(child[7]),
    notes: child[8],
    photoUrl: child[9] || undefined,
    createdAt: child[10],
    updatedAt: child[11],
    gender: (child[12] as 'M' | 'F') || 'M',
    parentName: child[13] || '',
    parentId: child[14] || undefined,
  });
}

function normalizeServerParent(parent: Parent): Parent {
  return {
    ...parent,
    name: normalizeName(parent.name),
  };
}

function decodeCompactServerParent(parent: CompactServerParent): Parent {
  return {
    id: parent[0],
    name: parent[1],
    phone: parent[2],
    address: parent[3],
    createdAt: parent[4],
    updatedAt: parent[5] || undefined,
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

function decodeCompactServerAttendance(attendance: CompactServerAttendance): Attendance {
  const status = decodeStatus(attendance[3]);

  return {
    id: attendance[0],
    childId: attendance[1],
    date: decodeDate(attendance[2]),
    present: status === 'PRESENT',
    status,
    markedAt: attendance[4],
  };
}

function encodeChildPatch(child: Child, pendingItem?: PendingSyncItem): CompactChildPatch {
  const fields = pendingItem?.fields?.length ? pendingItem.fields : CHILD_SYNC_FIELDS;
  const codes = fields.map((field) => CHILD_FIELD_CODES[field]).join('');
  const values = fields.map((field) => {
    if (field === 'classLevel') return encodeClassLevel(child.classLevel);
    return getSyncStringValue(field, child[field]);
  });

  return [child.id, codes, ...values];
}

function encodeAttendancePatch(attendance: Attendance): CompactAttendancePatch {
  const status = getAttendanceStatus(attendance) ?? 'ABSENT';
  return [attendance.childId, encodeDate(attendance.date), encodeStatus(status)];
}

function estimateJsonBytes(data: unknown) {
  return new TextEncoder().encode(JSON.stringify(data)).length;
}

function buildSyncBatch(
  pendingItems: PendingSyncItem[],
  pendingItemByKey: Map<string, PendingSyncItem>,
  changedChildren: Child[],
  changedAttendances: Attendance[],
  lastSyncAt: string | null,
  batchSize = 10,
  maxBytes = MAX_SYNC_BATCH_BYTES,
) {
  const changedChildById = new Map(changedChildren.map((child) => [child.id, child]));
  const changedAttendanceById = new Map(changedAttendances.map((attendance) => [attendance.id, attendance]));

  const selectedItems: PendingSyncItem[] = [];
  const compactChildren: CompactChildPatch[] = [];
  const compactAttendances: CompactAttendancePatch[] = [];

  const baseRequest = {
    mode: 'sync-v2',
    l: lastSyncAt,
    kc: [] as string[],
    ka: [] as string[],
    c: compactChildren,
    a: compactAttendances,
  };
  for (const item of pendingItems) {
    if (selectedItems.length >= batchSize) break;

    let patch: CompactChildPatch | CompactAttendancePatch | undefined;
    if (item.entity === 'child') {
      const child = changedChildById.get(item.id);
      if (child) {
        patch = encodeChildPatch(child, pendingItemByKey.get(item.key));
      }
    } else {
      const attendance = changedAttendanceById.get(item.id);
      if (attendance) {
        patch = encodeAttendancePatch(attendance);
      }
    }

    if (!patch) continue;

    const nextChildren = item.entity === 'child' ? [...compactChildren, patch] : compactChildren;
    const nextAttendances = item.entity === 'attendance' ? [...compactAttendances, patch] : compactAttendances;
    const nextRequest = {
      ...baseRequest,
      c: nextChildren,
      a: nextAttendances,
    };
    const nextSize = estimateJsonBytes(nextRequest);

    if (nextSize > maxBytes) {
      break;
    }

    selectedItems.push(item);
    if (item.entity === 'child') {
      compactChildren.push(patch as CompactChildPatch);
    } else {
      compactAttendances.push(patch as CompactAttendancePatch);
    }
  }

  if (selectedItems.length === 0 && pendingItems.length > 0) {
    const firstItem = pendingItems[0];
    if (firstItem.entity === 'child') {
      const child = changedChildById.get(firstItem.id);
      if (child) {
        const patch = encodeChildPatch(child, pendingItemByKey.get(firstItem.key));
        const request = {
          ...baseRequest,
          c: [patch],
          a: compactAttendances,
        };

        if (estimateJsonBytes(request) <= maxBytes) {
          selectedItems.push(firstItem);
          compactChildren.push(patch);
        }
      }
    } else {
      const attendance = changedAttendanceById.get(firstItem.id);
      if (attendance) {
        selectedItems.push(firstItem);
        compactAttendances.push(encodeAttendancePatch(attendance));
      }
    }
  }

  return {
    selectedItems,
    compactChildren,
    compactAttendances,
  };
}

async function applyServerDelta(data: SyncDeltaResponse) {
  const deltaChildren = data.c
    ? data.c.map(decodeCompactServerChild)
    : (data.children ?? []).map(normalizeServerChild);
  const deltaParents = data.p
    ? data.p.map(decodeCompactServerParent)
    : (data.parents ?? []).map(normalizeServerParent);
  const deltaAttendances = data.a
    ? data.a.map(decodeCompactServerAttendance)
    : (data.attendances ?? []).map(normalizeServerAttendance);

  await db.transaction('rw', db.children, db.parents, db.attendances, async () => {
    if (deltaChildren.length > 0) {
      await db.children.bulkPut(deltaChildren);
    }

    const deletedChildIds = data.d?.filter(Boolean) ?? [];
    if (deletedChildIds.length > 0) {
      await db.children.bulkDelete(deletedChildIds);
      for (const childId of deletedChildIds) {
        await db.attendances.where('childId').equals(childId).delete();
      }
    }

    if (deltaParents.length > 0) {
      await db.parents.bulkPut(deltaParents);
    }

    // Purger les enfants supprimés sur le serveur
    if (data.activeChildIds) {
      const localChildIds = await db.children.toCollection().primaryKeys();
      const serverChildIdsSet = new Set(data.activeChildIds);
      const childIdsToDeleteLocally = (localChildIds as string[]).filter(id => !serverChildIdsSet.has(id));
      if (childIdsToDeleteLocally.length > 0) {
        await db.children.bulkDelete(childIdsToDeleteLocally);
        for (const childId of childIdsToDeleteLocally) {
          await db.attendances.where('childId').equals(childId).delete();
        }
        console.log(`[SYNCHRO] ${childIdsToDeleteLocally.length} enfants supprimés localement (absents du serveur).`);
      }
    }

    // Purger les parents supprimés sur le serveur
    if (data.activeParentIds) {
      const localParentIds = await db.parents.toCollection().primaryKeys();
      const serverParentIdsSet = new Set(data.activeParentIds);
      const parentIdsToDeleteLocally = (localParentIds as string[]).filter(id => !serverParentIdsSet.has(id));
      if (parentIdsToDeleteLocally.length > 0) {
        await db.parents.bulkDelete(parentIdsToDeleteLocally);
        console.log(`[SYNCHRO] ${parentIdsToDeleteLocally.length} parents supprimés localement (absents du serveur).`);
      }
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
    const lastSyncAt = await getStateValue(LAST_SYNC_KEY);
    const kc: string[] = [];
    const ka: string[] = [];
    const pendingItemByKey = new Map(pendingItems.map((item) => [item.key, item]));
    const childIds = pendingItems.filter((item) => item.entity === 'child').map((item) => item.id);
    const attendanceIds = pendingItems.filter((item) => item.entity === 'attendance').map((item) => item.id);
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
    const {
      selectedItems: effectivePendingItems,
      compactChildren,
      compactAttendances,
    } = buildSyncBatch(pendingItems, pendingItemByKey, changedChildren, changedAttendances, lastSyncAt ?? null, SYNC_BATCH_SIZE);

    if (effectivePendingItems.length === 0 && pendingItems.length > 0) {
      await db.pendingSync.delete(pendingItems[0].key);
      await markPendingChange();

      return {
        success: false,
        error: 'Une modification locale trop volumineuse a été ignorée. Relancez la synchronisation.',
      };
    }

    let dp: string[] = [];
    if (typeof window !== "undefined") {
      try {
        dp = JSON.parse(localStorage.getItem("pending-deleted-parents") || "[]");
      } catch (e) {
        console.error("Erreur de lecture de localStorage:", e);
      }
    }

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'sync-v2',
        l: lastSyncAt,
        kc,
        ka,
        c: compactChildren,
        a: compactAttendances,
        dp,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Échec de synchronisation: Status ${response.status} - ${errorText}`);
      
      let errorMsg = 'Échec de la synchronisation';
      if (response.status === 413) {
        errorMsg = 'Fichier trop lourd. Relancez la synchronisation.';
      } else if (response.status >= 500) {
        errorMsg = 'Erreur interne du serveur lors du traitement des données.';
      }

      return {
        success: false,
        error: errorMsg,
      };
    }

    const data = (await response.json()) as SyncDeltaResponse;

    if (!data.success) {
      return {
        success: false,
        error: data.error ?? 'Échec de la synchronisation',
      };
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("pending-deleted-parents");
      } catch (e) {}
    }

    const pullResult = await applyServerDelta(data);

    await db.transaction('rw', db.syncState, db.pendingSync, db.children, db.parents, async () => {
      await setStateValue(LAST_SYNC_KEY, data.serverSyncedAt ?? new Date().toISOString());
      await db.pendingSync.bulkDelete(effectivePendingItems.map((item) => item.key));

      // Supprimer définitivement de Dexie les enfants marqués pour suppression (noms vides)
      const toDeleteIds = changedChildren
        .filter((c) => c.firstName === "" && c.lastName === "" && c.postName === "")
        .map((c) => c.id);
      if (toDeleteIds.length > 0) {
        await db.children.bulkDelete(toDeleteIds);
      }
    });

    return {
      success: true,
      childrenCount: changedChildren.length,
      attendancesCount: changedAttendances.length,
      pulledChildrenCount: pullResult.pulledChildrenCount,
      pulledAttendancesCount: pullResult.pulledAttendancesCount,
    };
  } catch (error) {
    console.error('Erreur réseau lors de la synchronisation:', error);
    return {
      success: false,
      error: 'Erreur réseau lors de la synchronisation',
    };
  }
}

// Nettoyage automatique des présences locales antérieures au premier jour (28 juin 2026)
if (typeof window !== 'undefined') {
  db.on('ready', () => {
    db.attendances.where('date').below(SYNC_ATTENDANCE_MIN_DATE).delete()
      .then((count) => {
        if (count > 0) {
          console.log(`[Dexie] Nettoyage : ${count} présences antérieures au ${SYNC_ATTENDANCE_MIN_DATE} supprimées.`);
        }
      })
      .catch((err) => {
        console.error('[Dexie] Erreur nettoyage présences obsolètes:', err);
      });
  });
}

export default db;
