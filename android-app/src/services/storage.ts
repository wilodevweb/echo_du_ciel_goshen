import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Attendance, Child, ChildTask, EditableChildField, Parent, PendingEntityChange, SchoolEvent, Session } from '../types';
import { localDatabase } from './localDatabase';
import { normalizeChildPhotos } from './photoStorage';

const CHILDREN_KEY = 'goshen.mobile.children.v1';
const SESSION_KEY = 'goshen.mobile.session.v1';
const SYNC_KEY = 'goshen.mobile.last-sync.v1';
const PARENTS_KEY = 'goshen.mobile.parents.v1';
const EVENTS_KEY = 'goshen.mobile.events.v1';
const TASKS_KEY = 'goshen.mobile.tasks.v1';
const PENDING_ENTITIES_KEY = 'goshen.mobile.pending-entities.v1';

let writeQueue: Promise<void> = Promise.resolve();

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  return parseJson(await AsyncStorage.getItem(key), fallback);
}

type PendingEntityInput = Pick<PendingEntityChange, 'entity' | 'id'> & { fields?: EditableChildField[] };

const CHILD_FIELDS: EditableChildField[] = ['firstName', 'lastName', 'postName', 'classLevel', 'parentPhone', 'address', 'birthDate', 'notes', 'photoUrl', 'gender', 'parentName', 'parentId'];

async function writeChildren(children: Child[]): Promise<void> {
  const normalized = await normalizeChildPhotos(children);
  await AsyncStorage.setItem(CHILDREN_KEY, JSON.stringify(normalized.children));
}

async function upsertRecords<T extends { id: string }>(key: string, changes: T[]): Promise<void> {
  const current = await readJson<T[]>(key, []);
  const byId = new Map(current.map(item => [item.id, item]));
  for (const item of changes) byId.set(item.id, item);
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(byId.values())));
}

async function writePendingChanges(changes: PendingEntityInput[]): Promise<void> {
  if (!changes.length) return;
  const pending = await readJson<PendingEntityChange[]>(PENDING_ENTITIES_KEY, []);
  const byKey = new Map(pending.map(change => [change.entity + ':' + change.id, change]));
  const latestTimestamp = pending.reduce((latest, change) => Math.max(latest, Date.parse(change.updatedAt) || 0), 0);
  const updatedAt = new Date(Math.max(Date.now(), latestTimestamp + 1)).toISOString();

  for (const change of changes) {
    const key = change.entity + ':' + change.id;
    const existing = byKey.get(key);
    const fields = change.entity !== 'child' || !change.fields?.length
      ? []
      : existing
        ? existing.fields?.length
          ? Array.from(new Set([...existing.fields, ...change.fields]))
          : []
        : change.fields;
    byKey.set(key, {
      entity: change.entity,
      id: change.id,
      updatedAt,
      ...(change.entity === 'child' ? { fields } : {}),
    });
  }

  await AsyncStorage.setItem(PENDING_ENTITIES_KEY, JSON.stringify(Array.from(byKey.values())));
}

function mergeConcurrentChanges<T extends { id: string }>(
  serverSnapshot: T[],
  latestLocal: T[],
  entity: PendingEntityChange['entity'],
  sentBatch: PendingEntityChange[],
  currentPending: PendingEntityChange[],
): T[] {
  const merged = new Map(serverSnapshot.map(item => [item.id, item]));
  const latestById = new Map(latestLocal.map(item => [item.id, item]));
  const sentByKey = new Map(sentBatch.map(item => [`${item.entity}:${item.id}`, item]));

  for (const change of currentPending) {
    if (change.entity !== entity) continue;
    const sent = sentByKey.get(`${entity}:${change.id}`);
    if (sent?.updatedAt === change.updatedAt) continue;
    const local = latestById.get(change.id);
    if (!local) continue;

    const server = merged.get(change.id);
    if (entity !== 'child' || !server) {
      merged.set(change.id, local);
      continue;
    }

    const fields = change.fields?.length ? change.fields : CHILD_FIELDS;
    const localChild = local as unknown as Child;
    const localFields = Object.fromEntries(fields.map(field => [field, localChild[field]]));
    merged.set(change.id, { ...server, ...localFields });
  }

  return Array.from(merged.values());
}

export interface SyncCacheCommit {
  children: Child[];
  parents: Parent[];
  events: SchoolEvent[];
  tasks: ChildTask[];
  sentEntityChanges: PendingEntityChange[];
  discardedEntityChanges?: PendingEntityChange[];
  lastSync: string;
}

export const storage = {
  getStartupData: async () => {
    const [sessionValue, entries, attendance] = await Promise.all([
      SecureStore.getItemAsync(SESSION_KEY),
      AsyncStorage.multiGet([CHILDREN_KEY, PARENTS_KEY, EVENTS_KEY, TASKS_KEY]),
      localDatabase.getAttendance(),
    ]);
    const values = new Map(entries);
    return {
      session: parseJson<Session | null>(sessionValue, null),
      children: parseJson<Child[]>(values.get(CHILDREN_KEY) ?? null, []),
      attendance,
      parents: parseJson<Parent[]>(values.get(PARENTS_KEY) ?? null, []),
      events: parseJson<SchoolEvent[]>(values.get(EVENTS_KEY) ?? null, []),
      tasks: parseJson<ChildTask[]>(values.get(TASKS_KEY) ?? null, []),
    };
  },
  getChildren: async () => {
    const children = await readJson<Child[]>(CHILDREN_KEY, []);
    const normalized = await normalizeChildPhotos(children);
    if (normalized.changed) {
      return withWriteLock(async () => {
        const latest = await readJson<Child[]>(CHILDREN_KEY, []);
        const latestNormalized = await normalizeChildPhotos(latest);
        if (latestNormalized.changed) {
          await AsyncStorage.setItem(CHILDREN_KEY, JSON.stringify(latestNormalized.children));
        }
        return latestNormalized.children;
      });
    }
    return normalized.children;
  },
  saveChildren: (children: Child[]) => withWriteLock(() => writeChildren(children)),
  upsertChildrenAndMark: (children: Child[], changes: PendingEntityInput[]) => withWriteLock(async () => {
    const current = await readJson<Child[]>(CHILDREN_KEY, []);
    const byId = new Map(current.map(child => [child.id, child]));
    for (const child of children) {
      const change = changes.find(item => item.entity === 'child' && item.id === child.id);
      const existing = byId.get(child.id);
      if (existing && change?.fields?.length) {
        const editedFields = Object.fromEntries(change.fields.map(field => [field, child[field]]));
        byId.set(child.id, { ...existing, ...editedFields });
      } else {
        byId.set(child.id, child);
      }
    }
    await writeChildren(Array.from(byId.values()));
    await writePendingChanges(changes);
  }),
  getParents: () => readJson<Parent[]>(PARENTS_KEY, []),
  saveParents: (parents: Parent[]) => withWriteLock(() => AsyncStorage.setItem(PARENTS_KEY, JSON.stringify(parents))),
  getEvents: () => readJson<SchoolEvent[]>(EVENTS_KEY, []),
  saveEvents: (events: SchoolEvent[]) => withWriteLock(() => AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events))),
  upsertEventsAndMark: (events: SchoolEvent[], changes: PendingEntityInput[]) => withWriteLock(async () => {
    await upsertRecords(EVENTS_KEY, events);
    await writePendingChanges(changes);
  }),
  getTasks: () => readJson<ChildTask[]>(TASKS_KEY, []),
  saveTasks: (tasks: ChildTask[]) => withWriteLock(() => AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks))),
  upsertTasksAndMark: (tasks: ChildTask[], changes: PendingEntityInput[]) => withWriteLock(async () => {
    await upsertRecords(TASKS_KEY, tasks);
    await writePendingChanges(changes);
  }),
  getPendingEntityChanges: () => readJson<PendingEntityChange[]>(PENDING_ENTITIES_KEY, []),
  markEntityForSync: (entity: PendingEntityChange['entity'], id: string, fields?: EditableChildField[]) =>
    withWriteLock(() => writePendingChanges([{ entity, id, fields }])),
  markEntitiesForSync: (changes: PendingEntityInput[]) => withWriteLock(() => writePendingChanges(changes)),
  removeSyncedEntityChanges: (batch: PendingEntityChange[]) => withWriteLock(async () => {
    if (!batch.length) return;
    const pending = await readJson<PendingEntityChange[]>(PENDING_ENTITIES_KEY, []);
    const accepted = new Map(batch.map(item => [`${item.entity}:${item.id}`, item.updatedAt]));
    await AsyncStorage.setItem(PENDING_ENTITIES_KEY, JSON.stringify(pending.filter(item => accepted.get(`${item.entity}:${item.id}`) !== item.updatedAt)));
  }),
  commitSyncCache: (commit: SyncCacheCommit) => withWriteLock(async () => {
    const [latestChildren, latestParents, latestEvents, latestTasks, currentPending] = await Promise.all([
      readJson<Child[]>(CHILDREN_KEY, []),
      readJson<Parent[]>(PARENTS_KEY, []),
      readJson<SchoolEvent[]>(EVENTS_KEY, []),
      readJson<ChildTask[]>(TASKS_KEY, []),
      readJson<PendingEntityChange[]>(PENDING_ENTITIES_KEY, []),
    ]);
    const acknowledgedByKey = new Map(
      [...commit.sentEntityChanges, ...(commit.discardedEntityChanges ?? [])]
        .map(item => [`${item.entity}:${item.id}`, item.updatedAt]),
    );
    const pendingAfterSync = currentPending.filter(change => {
      const acknowledgedAt = acknowledgedByKey.get(`${change.entity}:${change.id}`);
      return acknowledgedAt === undefined || acknowledgedAt !== change.updatedAt;
    });
    const children = mergeConcurrentChanges(commit.children, latestChildren, 'child', commit.sentEntityChanges, currentPending);
    const events = mergeConcurrentChanges(commit.events, latestEvents, 'event', commit.sentEntityChanges, currentPending);
    const tasks = mergeConcurrentChanges(commit.tasks, latestTasks, 'task', commit.sentEntityChanges, currentPending);
    await writeChildren(children);
    await AsyncStorage.setItem(PARENTS_KEY, JSON.stringify(commit.parents));
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    await AsyncStorage.setItem(PENDING_ENTITIES_KEY, JSON.stringify(pendingAfterSync));
    await AsyncStorage.setItem(SYNC_KEY, commit.lastSync);
  }),
  getAttendance: () => localDatabase.getAttendance(),
  saveAttendance: (attendance: Attendance[]) => localDatabase.saveAttendance(attendance),
  mergeAttendance: (attendance: Attendance[]) => localDatabase.mergeAttendance(attendance),
  recordAttendance: (childId: string, date: string, status: Attendance['status']) => localDatabase.recordAttendance(childId, date, status),
  getSession: async () => {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    return parseJson<Session | null>(value, null);
  },
  saveSession: (session: Session) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)),
  clearSession: () => SecureStore.deleteItemAsync(SESSION_KEY),
  getLastSync: () => AsyncStorage.getItem(SYNC_KEY),
  saveLastSync: (value: string) => withWriteLock(() => AsyncStorage.setItem(SYNC_KEY, value)),
  getPendingAttendance: () => localDatabase.getPendingAttendance(),
  savePendingAttendance: (items: Attendance[]) => localDatabase.savePendingAttendance(items),
  removeAcceptedPendingAttendance: (batch: Attendance[], acceptedKeys: string[]) => localDatabase.removeAcceptedPending(batch, acceptedKeys),
};
