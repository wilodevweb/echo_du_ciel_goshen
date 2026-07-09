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
  parentFirstName?: string;
  parentLastName?: string;
  address: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
}

export interface Parent {
  id: string;
  firstName: string;
  lastName: string;
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

export interface SyncState {
  key: string;
  value: string;
}

export type SyncEntity = 'child' | 'attendance';
export type ChildSyncField = 'firstName' | 'lastName' | 'postName' | 'classLevel' | 'parentPhone' | 'address' | 'birthDate' | 'notes' | 'photoUrl' | 'gender' | 'parentFirstName' | 'parentLastName' | 'parentId';

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

export function normalizeChildNameFields(child: Partial<Pick<Child, "firstName" | "lastName" | "postName" | "parentFirstName" | "parentLastName">>) {
  return {
    ...child,
    firstName: normalizeName(child.firstName),
    lastName: normalizeName(child.lastName),
    postName: normalizeName(child.postName),
    parentFirstName: normalizeName(child.parentFirstName),
    parentLastName: normalizeName(child.parentLastName),
  };
}

export function normalizeParentNameFields(parent: Partial<Pick<Parent, "firstName" | "lastName">>) {
  return {
    ...parent,
    firstName: normalizeName(parent.firstName),
    lastName: normalizeName(parent.lastName),
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
}

type CompactChildPatch = [string, string, ...string[]];
type CompactAttendancePatch = [string, string, string];
type CompactServerChild = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
type CompactServerParent = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
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
  'parentFirstName',
  'parentLastName',
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
  parentFirstName: 'u',
  parentLastName: 'v',
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

export async function cleanupInlinePhotoPayloads() {
  const childrenWithInlinePhotos = await db.children
    .filter((child) => isInlineDataUrl(child.photoUrl))
    .toArray();

  for (const child of childrenWithInlinePhotos) {
    await db.children.update(child.id, {
      photoUrl: undefined,
      updatedAt: new Date().toISOString(),
    });
    await markEntityForSync('child', child.id, ['photoUrl']);
  }

  return {
    cleanedPhotosCount: childrenWithInlinePhotos.length,
  };
}

function childRecordScore(child: Child) {
  return [
    child.birthDate,
    child.parentPhone,
    child.parentFirstName,
    child.parentLastName,
    child.address,
    child.notes,
    child.photoUrl,
    child.parentId,
  ].filter((value) => Boolean(String(value ?? '').trim())).length;
}

function pickCanonicalChild(children: Child[]) {
  return [...children].sort((a, b) => {
    const scoreDiff = childRecordScore(b) - childRecordScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    const aDate = a.createdAt || '';
    const bDate = b.createdAt || '';
    return aDate.localeCompare(bDate) || a.id.localeCompare(b.id);
  })[0];
}

function mergeChildData(canonical: Child, duplicate: Child) {
  return {
    gender: canonical.gender || duplicate.gender || 'M',
    classLevel: canonical.classLevel || duplicate.classLevel || 'FIRST',
    parentPhone: canonical.parentPhone || duplicate.parentPhone || '',
    parentFirstName: canonical.parentFirstName || duplicate.parentFirstName || '',
    parentLastName: canonical.parentLastName || duplicate.parentLastName || '',
    address: canonical.address || duplicate.address || '',
    birthDate: canonical.birthDate || duplicate.birthDate || undefined,
    notes: canonical.notes || duplicate.notes || '',
    photoUrl: canonical.photoUrl || duplicate.photoUrl || undefined,
    parentId: canonical.parentId || duplicate.parentId || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export async function cleanupLocalDuplicateChildren() {
  const allChildren = await db.children.toArray();
  const activeChildren = allChildren.filter((child) => !isDeletedChildRecord(child));
  const childrenByIdentity = new Map<string, Child[]>();

  for (const child of activeChildren) {
    const key = getChildIdentityKey(child);
    const group = childrenByIdentity.get(key) ?? [];
    group.push(child);
    childrenByIdentity.set(key, group);
  }

  const deletedChildIds: string[] = [];
  const changedAttendanceIds = new Set<string>();
  const changedCanonicalChildIds = new Set<string>();

  await db.transaction('rw', db.children, db.attendances, async () => {
    for (const group of childrenByIdentity.values()) {
      if (group.length < 2) continue;

      const canonical = pickCanonicalChild(group);
      const duplicates = group.filter((child) => child.id !== canonical.id);

      for (const duplicate of duplicates) {
        const mergedData = mergeChildData(canonical, duplicate);
        await db.children.update(canonical.id, mergedData);
        changedCanonicalChildIds.add(canonical.id);

        const canonicalAttendances = await db.attendances.where('childId').equals(canonical.id).toArray();
        const canonicalAttendanceByDate = new Map(canonicalAttendances.map((attendance) => [attendance.date, attendance]));
        const duplicateAttendances = await db.attendances.where('childId').equals(duplicate.id).toArray();

        for (const attendance of duplicateAttendances) {
          const existingAttendance = canonicalAttendanceByDate.get(attendance.date);

          if (existingAttendance) {
            if (attendance.markedAt > existingAttendance.markedAt) {
              await db.attendances.update(existingAttendance.id, {
                present: attendance.present,
                status: attendance.status,
                markedAt: attendance.markedAt,
              });
              changedAttendanceIds.add(existingAttendance.id);
            }
            await db.attendances.delete(attendance.id);
          } else {
            await db.attendances.update(attendance.id, {
              childId: canonical.id,
            });
            changedAttendanceIds.add(attendance.id);
            canonicalAttendanceByDate.set(attendance.date, {
              ...attendance,
              childId: canonical.id,
            });
          }
        }

        await db.children.update(duplicate.id, {
          firstName: '',
          lastName: '',
          postName: '',
          updatedAt: new Date().toISOString(),
        });
        deletedChildIds.push(duplicate.id);
      }
    }
  });

  for (const childId of changedCanonicalChildIds) {
    await markEntityForSync('child', childId);
  }

  for (const attendanceId of changedAttendanceIds) {
    await markEntityForSync('attendance', attendanceId);
  }

  for (const childId of deletedChildIds) {
    await markEntityForSync('child', childId, ['firstName', 'lastName', 'postName']);
  }

  return {
    deletedChildrenCount: deletedChildIds.length,
  };
}

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
    parentFirstName: normalizeName(child.parentFirstName || ''),
    parentLastName: normalizeName(child.parentLastName || ''),
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
    parentFirstName: child[13] || '',
    parentLastName: child[14] || '',
    parentId: child[15] || undefined,
  });
}

function normalizeServerParent(parent: Parent): Parent {
  return {
    ...parent,
    firstName: normalizeName(parent.firstName),
    lastName: normalizeName(parent.lastName),
  };
}

function decodeCompactServerParent(parent: CompactServerParent): Parent {
  return {
    id: parent[0],
    firstName: parent[1],
    lastName: parent[2],
    phone: parent[3],
    address: parent[4],
    createdAt: parent[5],
    updatedAt: parent[6] || undefined,
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

    if (deltaAttendances.length > 0) {
      // Pour éviter les doublons d'attendances créées localement avec un ID temporaire
      // et reçues du serveur avec leur ID définitif (CUID), on supprime les
      // enregistrements locaux correspondants ayant un ID différent avant d'insérer.
      for (const att of deltaAttendances) {
        const existing = await db.attendances
          .where('[childId+date]')
          .equals([att.childId, att.date])
          .toArray();
        const toDelete = existing
          .filter((e) => e.id !== att.id)
          .map((e) => e.id);
        if (toDelete.length > 0) {
          await db.attendances.bulkDelete(toDelete);
        }
      }
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
    await cleanupLocalDuplicateChildren();
    await cleanupInlinePhotoPayloads();

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Échec de synchronisation: Status ${response.status} - ${errorText}`);
      
      let errorMsg = 'Échec de la synchronisation';
      if (response.status === 413) {
        await cleanupInlinePhotoPayloads();
        errorMsg = 'Des anciennes photos intégrées ont été nettoyées. Relancez la synchronisation.';
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
    cleanupInlinePhotoPayloads()
      .then((result) => {
        if (result.cleanedPhotosCount > 0) {
          console.log(`[Dexie] Nettoyage : ${result.cleanedPhotosCount} ancienne(s) photo(s) intégrée(s) supprimée(s).`);
        }
      })
      .catch((err) => {
        console.error('[Dexie] Erreur nettoyage anciennes photos:', err);
      });

    cleanupLocalDuplicateChildren()
      .then((result) => {
        if (result.deletedChildrenCount > 0) {
          console.log(`[Dexie] Nettoyage : ${result.deletedChildrenCount} doublon(s) enfant fusionné(s).`);
        }
      })
      .catch((err) => {
        console.error('[Dexie] Erreur nettoyage doublons enfants:', err);
      });

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
