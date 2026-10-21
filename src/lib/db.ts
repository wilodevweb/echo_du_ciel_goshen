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
  phone?: string;   // optionnel — une famille peut ne pas avoir de téléphone
  address?: string;
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

export type TaskType = "chant" | "poeme" | "emission" | "sketch" | "theatre" | "autre";

// Tâches liées à un enfant pour un événement (non synchronisées)
export interface ChildTask {
  id: string;
  eventId: string;      // Référence à ChildEvent.id
  childId: string;      // Référence à Child.id
  title: string;        // Ex: "Lire Psaume 23", "Apporter les chaises"
  type?: TaskType;      // Type d'activité (optionnel pour rétrocompatibilité)
  done: boolean;
  createdAt: string;
}

export interface SyncState {
  key: string;
  value: string;
}

export type SyncEntity = 'child' | 'attendance' | 'event' | 'task';
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
  e?: CompactServerEvent[];
  t?: CompactServerTask[];
  events?: ChildEvent[];
  tasks?: ChildTask[];
  d?: string[];
  deletedParentIds?: string[];
  deletedEventIds?: string[];
  deletedTaskIds?: string[];
  serverSyncedAt?: string;
  error?: string;
  /** Full inventories are accepted only for older server versions. */
  activeChildIds?: string[];
  activeParentIds?: string[];
  activeEventIds?: string[];
  activeTaskIds?: string[];
}

type CompactChildPatch = [string, string, ...string[]];
type CompactAttendancePatch = [string, string, string, string?];
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
type CompactEventPatch = [string, string, string, string];
type CompactTaskPatch = [string, string, string, string, string, string];
type CompactServerEvent = [string, string, string, string, string];
type CompactServerTask = [string, string, string, string, string, string, string];

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
export const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback ultra-rare (très vieux navigateurs)
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
};

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

export interface PendingDeletion {
  key: string;       // Format: "entity:id"
  entity: 'event' | 'task';
  id: string;
  deletedAt: string;
}

export interface MediaResource {
  id: string;
  title: string;
  type: string;      // "image" | "video" | "pdf"
  url: string;
  thumbnail?: string;
  aspectRatio: string;
  createdAt: string;
}

const db = new Dexie('SundaySchoolDB') as Dexie & {
  children: EntityTable<Child, 'id'>;
  parents: EntityTable<Parent, 'id'>;
  attendances: EntityTable<Attendance, 'id'>;
  syncState: EntityTable<SyncState, 'key'>;
  pendingSync: EntityTable<PendingSyncItem, 'key'>;
  pendingDeletions: EntityTable<PendingDeletion, 'key'>;
  events: EntityTable<ChildEvent, 'id'>;
  tasks: EntityTable<ChildTask, 'id'>;
  mediaResources: EntityTable<MediaResource, 'id'>;
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

// ─── v11 : Migration des parents legacy ──────────────────────────────────────
// Regroupe tous les enfants qui ont un parentName mais pas de parentId,
// crée un enregistrement Parent pour chaque nom unique, et assigne le parentId
// à chaque enfant concerné. Après cette migration, il n'existe plus de parent
// "fantôme" stocké uniquement sur les enfants.
db.version(11)
  .stores({
    children: 'id, firstName, lastName, postName, parentPhone, classLevel, gender, parentId, createdAt',
    parents: 'id, phone, name',
    attendances: 'id, childId, date, status, [childId+date]',
    syncState: 'key',
    pendingSync: 'key, entity, id, updatedAt',
    events: 'id, date, createdAt',
    tasks: 'id, eventId, childId, [eventId+childId]',
  })
  .upgrade(async (transaction) => {
    const childrenTable = transaction.table('children');
    const parentsTable  = transaction.table('parents');

    // Lire tous les enfants sans parentId mais avec un nom de parent
    const legacyChildren = await childrenTable
      .filter((c: Child) => !c.parentId && !!c.parentName?.trim())
      .toArray();

    if (legacyChildren.length === 0) return;

    // Regrouper par nom normalisé (minuscules, espaces réduits)
    const groups = new Map<string, { name: string; phone: string; childIds: string[] }>();
    for (const child of legacyChildren) {
      const key = (child.parentName as string).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!groups.has(key)) {
        groups.set(key, {
          name: (child.parentName as string).trim(),
          phone: child.parentPhone ?? '',
          childIds: [],
        });
      }
      // Si ce groupe n'a pas encore de téléphone, utiliser celui de l'enfant
      const grp = groups.get(key)!;
      if (!grp.phone && child.parentPhone) grp.phone = child.parentPhone;
      grp.childIds.push(child.id as string);
    }

    // Créer un Parent pour chaque groupe et lier les enfants
    for (const [, grp] of groups) {
      // Vérifie si un parent avec ce nom existe déjà dans db.parents
      const existing = await parentsTable
        .filter((p: Parent) =>
          (p.name ?? '').toLowerCase().replace(/\s+/g, ' ').trim() ===
          grp.name.toLowerCase().replace(/\s+/g, ' ').trim()
        )
        .first();

      let parentId: string;
      if (existing) {
        parentId = existing.id as string;
      } else {
        // ID propre, identique à tout autre parent créé normalement
        parentId = generateId();
        await parentsTable.put({
          id: parentId,
          name: grp.name,
          phone: grp.phone || undefined,
          address: undefined,
          createdAt: new Date().toISOString(),
        });
      }

      // Mettre à jour chaque enfant du groupe
      for (const childId of grp.childIds) {
        await childrenTable.update(childId, { parentId });
      }
    }
  });

// ─── v12 : Tombstones de suppression et Métadonnées médias (T01 & T06) ────────
db.version(12).stores({
  children: 'id, firstName, lastName, postName, parentPhone, classLevel, gender, parentId, createdAt',
  parents: 'id, phone, name',
  attendances: 'id, childId, date, status, [childId+date]',
  syncState: 'key',
  pendingSync: 'key, entity, id, updatedAt',
  pendingDeletions: 'key, entity, id, deletedAt',
  events: 'id, date, createdAt',
  tasks: 'id, eventId, childId, [eventId+childId]',
  mediaResources: 'id, type, createdAt',
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

  const now = Date.now();
  const previousUpdatedAt = existingItem ? Date.parse(existingItem.updatedAt) : 0;
  const updatedAt = new Date(Math.max(now, previousUpdatedAt + 1)).toISOString();
  await db.pendingSync.put({
    key: `${entity}:${id}`,
    entity,
    id,
    updatedAt,
    fields: nextFields,
  });
  await markPendingChange();
}

/**
 * Enregistre un tombstone de suppression pour synchronisation avec le serveur (T01).
 * Utilisé lors de la suppression locale d'un événement ou d'une tâche.
 */
export async function markEntityForDeletion(entity: 'event' | 'task', id: string) {
  const key = `${entity}:${id}`;
  const deletedAt = new Date().toISOString();
  await db.transaction('rw', [db.pendingSync, db.pendingDeletions, db.syncState], async () => {
    await db.pendingSync.delete(key);
    await db.pendingDeletions.put({ key, entity, id, deletedAt });
    await setStateValue(LAST_LOCAL_CHANGE_KEY, deletedAt);
  });
}

/** Supprime une tâche localement et conserve son tombstone dans la même transaction. */
export async function deleteTaskForSync(id: string) {
  const entity = 'task' as const;
  const key = `${entity}:${id}`;
  const deletedAt = new Date().toISOString();
  await db.transaction('rw', [db.tasks, db.pendingSync, db.pendingDeletions, db.syncState], async () => {
    await db.tasks.delete(id);
    await db.pendingSync.delete(key);
    await db.pendingDeletions.put({ key, entity, id, deletedAt });
    await setStateValue(LAST_LOCAL_CHANGE_KEY, deletedAt);
  });
}

/** Supprime un événement et ses tâches avec leurs tombstones, sans fenêtre de perte locale. */
export async function deleteEventForSync(id: string) {
  const deletedAt = new Date().toISOString();
  await db.transaction('rw', [db.events, db.tasks, db.pendingSync, db.pendingDeletions, db.syncState], async () => {
    const tasks = await db.tasks.where('eventId').equals(id).toArray();
    const taskIds = tasks.map((task) => task.id);
    await db.tasks.bulkDelete(taskIds);
    await db.events.delete(id);

    const tombstones: PendingDeletion[] = [
      { key: `event:${id}`, entity: 'event', id, deletedAt },
      ...taskIds.map((taskId): PendingDeletion => ({
        key: `task:${taskId}`,
        entity: 'task',
        id: taskId,
        deletedAt,
      })),
    ];
    await db.pendingSync.bulkDelete(tombstones.map((item) => item.key));
    await db.pendingDeletions.bulkPut(tombstones);
    await setStateValue(LAST_LOCAL_CHANGE_KEY, deletedAt);
  });
}

function getSyncStringValue(field: ChildSyncField, value: unknown) {
  const stringValue = String(value ?? '');

  if (stringValue.length > MAX_SYNC_STRING_VALUE_LENGTH) {
    throw new Error(`Le champ ${field} dépasse la taille maximale et ne peut pas être synchronisé sans perte.`);
  }

  return stringValue;
}


// Suppression complète du système de doublons devenu obsolète
export async function getSyncStatus() {
  const [pendingSyncCount, pendingDeletionsCount, lastLocalChangeAt, lastSyncAt] = await Promise.all([
    db.pendingSync.count(),
    db.pendingDeletions.count(),
    getStateValue(LAST_LOCAL_CHANGE_KEY),
    getStateValue(LAST_SYNC_KEY),
  ]);

  return {
    pendingChanges: pendingSyncCount + pendingDeletionsCount,
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

function decodeCompactServerEvent(event: CompactServerEvent): ChildEvent {
  return {
    id: event[0],
    title: event[1],
    date: decodeDate(event[2]),
    description: event[3] || undefined,
    createdAt: event[4],
  };
}

function decodeCompactServerTask(task: CompactServerTask): ChildTask {
  return {
    id: task[0],
    eventId: task[1],
    childId: task[2],
    title: task[3],
    type: (task[4] || undefined) as TaskType | undefined,
    done: task[5] === "1",
    createdAt: task[6],
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
  return [attendance.childId, encodeDate(attendance.date), encodeStatus(status), attendance.markedAt];
}

function encodeEventPatch(event: ChildEvent): CompactEventPatch {
  return [event.id, event.title, encodeDate(event.date), event.description ?? ""];
}

function encodeTaskPatch(task: ChildTask): CompactTaskPatch {
  return [task.id, task.eventId, task.childId, task.title, task.type ?? "", task.done ? "1" : "0"];
}

function estimateJsonBytes(data: unknown) {
  return new TextEncoder().encode(JSON.stringify(data)).length;
}

function buildSyncBatch(
  pendingItems: PendingSyncItem[],
  pendingItemByKey: Map<string, PendingSyncItem>,
  changedChildren: Child[],
  changedAttendances: Attendance[],
  changedEvents: ChildEvent[],
  changedTasks: ChildTask[],
  knownChildIds: string[],
  knownParentIds: string[],
  knownEventIds: string[],
  knownTaskIds: string[],
  knownAttendanceKeys: Array<[string, string[]]>,
  lastSyncAt: string | null,
  batchSize = 10,
  maxBytes = MAX_SYNC_BATCH_BYTES,
) {
  const changedChildById = new Map(changedChildren.map((child) => [child.id, child]));
  const changedAttendanceById = new Map(changedAttendances.map((attendance) => [attendance.id, attendance]));
  const changedEventById = new Map(changedEvents.map((event) => [event.id, event]));
  const changedTaskById = new Map(changedTasks.map((task) => [task.id, task]));

  const selectedItems: PendingSyncItem[] = [];
  const compactChildren: CompactChildPatch[] = [];
  const compactAttendances: CompactAttendancePatch[] = [];
  const compactEvents: CompactEventPatch[] = [];
  const compactTasks: CompactTaskPatch[] = [];

  const baseRequest = {
    mode: 'sync-v2',
    compactDeletes: true,
    l: lastSyncAt,
    kc: knownChildIds,
    kp: knownParentIds,
    ke: knownEventIds,
    kt: knownTaskIds,
    ka2: knownAttendanceKeys,
    c: compactChildren,
    a: compactAttendances,
    e: compactEvents,
    t: compactTasks,
  };

  for (const item of pendingItems) {
    if (selectedItems.length >= batchSize) break;

    let patch: CompactChildPatch | CompactAttendancePatch | CompactEventPatch | CompactTaskPatch | undefined;
    if (item.entity === 'child') {
      const child = changedChildById.get(item.id);
      if (child) {
        patch = encodeChildPatch(child, pendingItemByKey.get(item.key));
      }
    } else if (item.entity === 'attendance') {
      const attendance = changedAttendanceById.get(item.id);
      if (attendance) {
        patch = encodeAttendancePatch(attendance);
      }
    } else if (item.entity === 'event') {
      const event = changedEventById.get(item.id);
      if (event) {
        patch = encodeEventPatch(event);
      }
    } else if (item.entity === 'task') {
      const task = changedTaskById.get(item.id);
      if (task) {
        patch = encodeTaskPatch(task);
      }
    }

    if (!patch) continue;

    const nextChildren = item.entity === 'child' ? [...compactChildren, patch as CompactChildPatch] : compactChildren;
    const nextAttendances = item.entity === 'attendance' ? [...compactAttendances, patch as CompactAttendancePatch] : compactAttendances;
    const nextEvents = item.entity === 'event' ? [...compactEvents, patch as CompactEventPatch] : compactEvents;
    const nextTasks = item.entity === 'task' ? [...compactTasks, patch as CompactTaskPatch] : compactTasks;
    const nextRequest = {
      ...baseRequest,
      c: nextChildren,
      a: nextAttendances,
      e: nextEvents,
      t: nextTasks,
    };
    const nextSize = estimateJsonBytes(nextRequest);

    if (nextSize > maxBytes) {
      break;
    }

    selectedItems.push(item);
    if (item.entity === 'child') {
      compactChildren.push(patch as CompactChildPatch);
    } else if (item.entity === 'attendance') {
      compactAttendances.push(patch as CompactAttendancePatch);
    } else if (item.entity === 'event') {
      compactEvents.push(patch as CompactEventPatch);
    } else if (item.entity === 'task') {
      compactTasks.push(patch as CompactTaskPatch);
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
          e: compactEvents,
          t: compactTasks,
        };

        if (estimateJsonBytes(request) <= maxBytes) {
          selectedItems.push(firstItem);
          compactChildren.push(patch);
        }
      }
    } else if (firstItem.entity === 'attendance') {
      const attendance = changedAttendanceById.get(firstItem.id);
      if (attendance) {
        selectedItems.push(firstItem);
        compactAttendances.push(encodeAttendancePatch(attendance));
      }
    } else if (firstItem.entity === 'event') {
      const event = changedEventById.get(firstItem.id);
      if (event) {
        selectedItems.push(firstItem);
        compactEvents.push(encodeEventPatch(event));
      }
    } else if (firstItem.entity === 'task') {
      const task = changedTaskById.get(firstItem.id);
      if (task) {
        selectedItems.push(firstItem);
        compactTasks.push(encodeTaskPatch(task));
      }
    }
  }

  return {
    selectedItems,
    compactChildren,
    compactAttendances,
    compactEvents,
    compactTasks,
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

  const deltaEvents = data.e
    ? data.e.map(decodeCompactServerEvent)
    : (data.events ?? []);
  const deltaTasks = data.t
    ? data.t.map(decodeCompactServerTask)
    : (data.tasks ?? []);

  await db.transaction('rw', [db.children, db.parents, db.attendances, db.events, db.tasks, db.pendingSync], async () => {
    const pendingEntityKeys = new Set(
      (await db.pendingSync.toArray()).map((item) => `${item.entity}:${item.id}`),
    );

    if (deltaChildren.length > 0) {
      await db.children.bulkPut(deltaChildren);
    }

    const deletedChildIdSet = new Set(data.d?.filter(Boolean) ?? []);
    if (data.activeChildIds) {
      const activeIds = new Set(data.activeChildIds);
      const localIds = await db.children.toCollection().primaryKeys();
      for (const childId of localIds as string[]) {
        if (!activeIds.has(childId)) deletedChildIdSet.add(childId);
      }
    }
    const deletedChildIds = Array.from(deletedChildIdSet)
      .filter((childId) => !pendingEntityKeys.has(`child:${childId}`));
    if (deletedChildIds.length > 0) {
      await db.children.bulkDelete(deletedChildIds);
      for (const childId of deletedChildIds) {
        const attendancesToDelete = await db.attendances.where('childId').equals(childId).toArray();
        const attendanceKeysToDelete = attendancesToDelete.map(a => `attendance:${a.id}`);
        if (attendanceKeysToDelete.length > 0) {
          await db.pendingSync.bulkDelete(attendanceKeysToDelete);
        }
        await db.attendances.where('childId').equals(childId).delete();

        const tasksToDelete = await db.tasks.where('childId').equals(childId).toArray();
        const taskKeysToDelete = tasksToDelete.map(t => `task:${t.id}`);
        if (taskKeysToDelete.length > 0) {
          await db.pendingSync.bulkDelete(taskKeysToDelete);
        }
        await db.tasks.where('childId').equals(childId).delete();

        await db.pendingSync.delete(`child:${childId}`);
      }
    }

    if (deltaParents.length > 0) {
      await db.parents.bulkPut(deltaParents);
    }

    const deletedParentIdSet = new Set(data.deletedParentIds?.filter(Boolean) ?? []);
    if (data.activeParentIds) {
      const activeIds = new Set(data.activeParentIds);
      const localIds = await db.parents.toCollection().primaryKeys();
      for (const parentId of localIds as string[]) {
        if (!activeIds.has(parentId)) deletedParentIdSet.add(parentId);
      }
    }
    const deletedParentIds = Array.from(deletedParentIdSet);
    if (deletedParentIds.length > 0) await db.parents.bulkDelete(deletedParentIds);

    const deletedEventIdSet = new Set(data.deletedEventIds?.filter(Boolean) ?? []);
    if (data.activeEventIds) {
      const activeIds = new Set(data.activeEventIds);
      const localIds = await db.events.toCollection().primaryKeys();
      for (const eventId of localIds as string[]) {
        if (!activeIds.has(eventId)) deletedEventIdSet.add(eventId);
      }
    }
    const deletedEventIds = Array.from(deletedEventIdSet)
      .filter(id => !pendingEntityKeys.has(`event:${id}`));
    if (deletedEventIds.length > 0) {
      await db.events.bulkDelete(deletedEventIds);
      await db.tasks.where('eventId').anyOf(deletedEventIds).delete();
    }

    const deletedTaskIdSet = new Set(data.deletedTaskIds?.filter(Boolean) ?? []);
    if (data.activeTaskIds) {
      const activeIds = new Set(data.activeTaskIds);
      const localIds = await db.tasks.toCollection().primaryKeys();
      for (const taskId of localIds as string[]) {
        if (!activeIds.has(taskId)) deletedTaskIdSet.add(taskId);
      }
    }
    const deletedTaskIds = Array.from(deletedTaskIdSet)
      .filter(id => !pendingEntityKeys.has(`task:${id}`));
    if (deletedTaskIds.length > 0) await db.tasks.bulkDelete(deletedTaskIds);

    if (deltaAttendances.length > 0) {
      // Éviter la duplication des présences (IDs locaux vs IDs serveur)
      // Rechercher les présences locales ayant le même [childId+date] et les supprimer
      const attendanceKeys = deltaAttendances.map(a => [a.childId, a.date]);
      const existingLocals = await db.attendances.where('[childId+date]').anyOf(attendanceKeys).toArray();
      const pendingAttendanceItems = await db.pendingSync.where('entity').equals('attendance').toArray();
      const pendingAttendanceIds = new Set(pendingAttendanceItems.map(item => item.id));
      const serverAttendancesToApply = deltaAttendances.filter((serverAttendance) => {
        const localRecord = existingLocals.find(local =>
          local.childId === serverAttendance.childId && local.date === serverAttendance.date
        );
        if (!localRecord || !pendingAttendanceIds.has(localRecord.id)) return true;
        // Une correction faite pendant la requête reste locale pour le prochain passage.
        return Date.parse(localRecord.markedAt) <= Date.parse(serverAttendance.markedAt);
      });
      const appliedKeys = new Set(serverAttendancesToApply.map(item => `${item.childId}:${item.date}`));
      const localIdsToDelete = existingLocals
        .filter(local => appliedKeys.has(`${local.childId}:${local.date}`)
          && !serverAttendancesToApply.some(server => server.id === local.id))
        .map(local => local.id);
      
      if (localIdsToDelete.length > 0) {
        await db.attendances.bulkDelete(localIdsToDelete);
        // Également nettoyer pendingSync si l'ID local y était bloqué
        const pendingKeysToClean = localIdsToDelete.map(id => `attendance:${id}`);
        await db.pendingSync.bulkDelete(pendingKeysToClean);
      }
      
      if (serverAttendancesToApply.length > 0) {
        await db.attendances.bulkPut(serverAttendancesToApply);
      }
    }
    if (deltaEvents.length > 0) {
      await db.events.bulkPut(deltaEvents);
    }
    if (deltaTasks.length > 0) {
      await db.tasks.bulkPut(deltaTasks);
    }
  });

  return {
    pulledChildrenCount: deltaChildren.length,
    pulledAttendancesCount: deltaAttendances.length,
    pulledEventsCount: deltaEvents.length,
    pulledTasksCount: deltaTasks.length,
  };
}

// Fonction de synchronisation avec le serveur
export async function syncWithServer(options: { signal?: AbortSignal } = {}) {
  try {
    const [pendingItems, lastSyncAt, knownChildKeys, knownParentKeys, knownEventKeys, knownTaskKeys, attendanceIndexKeys] = await Promise.all([
      db.pendingSync.toArray(),
      getStateValue(LAST_SYNC_KEY),
      db.children.toCollection().primaryKeys(),
      db.parents.toCollection().primaryKeys(),
      db.events.toCollection().primaryKeys(),
      db.tasks.toCollection().primaryKeys(),
      db.attendances.orderBy('[childId+date]').keys(),
    ]);
    const kc = knownChildKeys.map(String);
    const kp = knownParentKeys.map(String);
    const ke = knownEventKeys.map(String);
    const kt = knownTaskKeys.map(String);
    const knownAttendanceByChild = new Map<string, string[]>();
    for (const key of attendanceIndexKeys) {
      if (!Array.isArray(key) || key.length !== 2) continue;
      const childId = String(key[0]);
      const dates = knownAttendanceByChild.get(childId) ?? [];
      dates.push(encodeDate(String(key[1])));
      knownAttendanceByChild.set(childId, dates);
    }
    const ka2 = Array.from(knownAttendanceByChild, ([childId, dates]): [string, string[]] => [childId, dates]);
    const pendingItemByKey = new Map(pendingItems.map((item) => [item.key, item]));
    const childIds = pendingItems.filter((item) => item.entity === 'child').map((item) => item.id);
    const attendanceIds = pendingItems.filter((item) => item.entity === 'attendance').map((item) => item.id);
    const eventIds = pendingItems.filter((item) => item.entity === 'event').map((item) => item.id);
    const taskIds = pendingItems.filter((item) => item.entity === 'task').map((item) => item.id);

    const children = childIds.length > 0 ? await db.children.bulkGet(childIds) : [];
    const attendances = attendanceIds.length > 0 ? await db.attendances.bulkGet(attendanceIds) : [];
    const events = eventIds.length > 0 ? await db.events.bulkGet(eventIds) : [];
    const tasks = taskIds.length > 0 ? await db.tasks.bulkGet(taskIds) : [];

    const changedChildren = children.filter((child): child is Child => Boolean(child));
    const changedEvents = events.filter((e): e is ChildEvent => Boolean(e));
    const changedTasks = tasks.filter((t): t is ChildTask => Boolean(t));
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
      compactEvents,
      compactTasks,
    } = buildSyncBatch(
      pendingItems,
      pendingItemByKey,
      changedChildren,
      changedAttendances,
      changedEvents,
      changedTasks,
      kc,
      kp,
      ke,
      kt,
      ka2,
      lastSyncAt ?? null,
      SYNC_BATCH_SIZE,
    );

    if (effectivePendingItems.length === 0 && pendingItems.length > 0) {
      return {
        success: false,
        error: 'Une modification locale dépasse la taille autorisée. Elle reste enregistrée sur cet appareil.',
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

    // Récupérer les tombstones de suppression locaux (T01 & T02)
    const pendingDeletions = await db.pendingDeletions.toArray();
    const de = pendingDeletions.filter(item => item.entity === 'event').map(item => item.id);
    const dt = pendingDeletions.filter(item => item.entity === 'task').map(item => item.id);

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        mode: 'sync-v2',
        compactDeletes: true,
        l: lastSyncAt,
        kc,
        kp,
        ke,
        kt,
        ka2,
        c: compactChildren,
        a: compactAttendances,
        e: compactEvents,
        t: compactTasks,
        dp,
        de,
        dt,
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
      } catch {}
    }

    const pullResult = await applyServerDelta(data);

    await db.transaction('rw', [db.syncState, db.pendingSync, db.pendingDeletions, db.children, db.parents, db.events, db.tasks], async () => {
      await setStateValue(LAST_SYNC_KEY, data.serverSyncedAt ?? new Date().toISOString());
      // Acquitter uniquement les lignes qui n'ont pas été modifiées pendant la requête.
      const sentPending = await db.pendingSync.bulkGet(effectivePendingItems.map((item) => item.key));
      const acknowledgedPendingKeys = effectivePendingItems.filter((item, index) =>
        sentPending[index]?.updatedAt === item.updatedAt
      ).map((item) => item.key);
      await db.pendingSync.bulkDelete(acknowledgedPendingKeys);

      // Conserver un tombstone plus récent créé pendant le transfert.
      if (pendingDeletions.length > 0) {
        const currentDeletions = await db.pendingDeletions.bulkGet(pendingDeletions.map((item) => item.key));
        const acknowledgedDeletionKeys = pendingDeletions.filter((item, index) =>
          currentDeletions[index]?.deletedAt === item.deletedAt
        ).map((item) => item.key);
        await db.pendingDeletions.bulkDelete(acknowledgedDeletionKeys);
      }

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
