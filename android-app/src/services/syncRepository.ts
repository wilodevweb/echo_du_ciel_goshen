import { ApiError, postSync, uploadMobileChildPhoto } from './api';
import { storage } from './storage';
import type { Attendance, Child, EditableChildField, PendingEntityChange, Session, SyncPayload, SyncResponse } from '../types';

const MAX_SYNC_BATCH_ENTRIES = 5;
const MAX_SYNC_PAYLOAD_BYTES = 700_000;

/** Coordinates the sync protocol with the local cache and pending queue. */
export async function syncData(session: Session): Promise<SyncResponse> {
  const [children, attendance, pendingAttendance, pendingEntities, lastSync, currentParents, currentEvents, currentTasks] = await Promise.all([
    storage.getChildren(),
    storage.getAttendance(),
    storage.getPendingAttendance(),
    storage.getPendingEntityChanges(),
    storage.getLastSync(),
    storage.getParents(),
    storage.getEvents(),
    storage.getTasks(),
  ]);
  const childrenByIdForPatch = new Map(children.map(child => [child.id, child]));
  const eventsByIdForPatch = new Map(currentEvents.map(event => [event.id, event]));
  const tasksByIdForPatch = new Map(currentTasks.map(task => [task.id, task]));
  const availableEntityChanges = pendingEntities.filter(change =>
    change.entity === 'child' ? childrenByIdForPatch.has(change.id)
      : change.entity === 'event' ? eventsByIdForPatch.has(change.id)
        : tasksByIdForPatch.has(change.id));
  const availableEntityKeys = new Set(availableEntityChanges.map(change => `${change.entity}:${change.id}`));
  const discardedEntityChanges = pendingEntities.filter(change => !availableEntityKeys.has(`${change.entity}:${change.id}`));
  const childFields: Array<Exclude<keyof Child, 'id'>> = ['firstName', 'lastName', 'postName', 'classLevel', 'parentPhone', 'address', 'birthDate', 'notes', 'photoUrl', 'gender', 'parentName', 'parentId'];
  const childCodes: Record<EditableChildField, string> = { firstName: 'f', lastName: 'l', postName: 'o', classLevel: 'c', parentPhone: 't', address: 'a', birthDate: 'b', notes: 'n', photoUrl: 'h', gender: 'g', parentName: 'u', parentId: 'p' };
  const payload: SyncPayload = {
    mode: 'sync-v2',
    compactDeletes: true,
    l: lastSync,
    kc: children.map(child => child.id),
    kp: currentParents.map(parent => parent.id),
    ke: currentEvents.map(event => event.id),
    kt: currentTasks.map(task => task.id),
    // The grouped keys preserve the full local attendance snapshot without repeating child IDs per date.
    ka2: groupAttendanceKeys(attendance),
    c: [],
    a: [],
    e: [],
    t: [],
    dp: [],
    de: [],
    dt: [],
  };
  if (estimateJsonBytes(payload) > MAX_SYNC_PAYLOAD_BYTES) {
    throw new ApiError('L’index local dépasse la taille maximale de synchronisation. Les données restent enregistrées sur cet appareil.');
  }

  const candidates: Array<
    | { kind: 'entity'; updatedAt: string; change: PendingEntityChange }
    | { kind: 'attendance'; updatedAt: string; item: Attendance }
  > = [
    ...availableEntityChanges.map(change => ({ kind: 'entity' as const, updatedAt: change.updatedAt, change })),
    ...pendingAttendance.map(item => ({ kind: 'attendance' as const, updatedAt: item.markedAt, item })),
  ].sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  const syncedEntityBatch: PendingEntityChange[] = [];
  const pendingAttendanceBatch: Attendance[] = [];
  let selectedCount = 0;
  for (const candidate of candidates) {
    if (selectedCount >= MAX_SYNC_BATCH_ENTRIES) break;
    const next: SyncPayload = { ...payload, c: [...payload.c], a: [...payload.a], e: [...payload.e], t: [...payload.t] };
    if (candidate.kind === 'attendance') {
      next.a.push([candidate.item.childId, encodeDate(candidate.item.date), encodeStatus(candidate.item.status), candidate.item.markedAt]);
    } else if (candidate.change.entity === 'child') {
      const child = childrenByIdForPatch.get(candidate.change.id);
      if (!child) continue;
      const fields = (candidate.change.fields?.length ? candidate.change.fields : childFields)
        .filter(field => session.role !== 'ADMIN' || field !== 'photoUrl' || !child.photoUrl?.startsWith('data:image/jpeg;base64,'));
      if (fields.length) {
        const codes = fields.map(field => childCodes[field]).join('');
        next.c.push([child.id, codes, ...fields.map(field => field === 'classLevel' ? (child.classLevel === 'SECOND' ? '2' : child.classLevel === 'THIRD' ? '3' : '1') : String(child[field] ?? ''))]);
      }
    } else if (candidate.change.entity === 'event') {
      const event = eventsByIdForPatch.get(candidate.change.id);
      if (!event) continue;
      next.e.push([event.id, event.title, encodeDate(event.date), event.description ?? '']);
    } else {
      const task = tasksByIdForPatch.get(candidate.change.id);
      if (!task) continue;
      next.t.push([task.id, task.eventId, task.childId, task.title, task.type ?? '', task.done ? '1' : '0']);
    }
    if (estimateJsonBytes(next) > MAX_SYNC_PAYLOAD_BYTES) {
      if (selectedCount === 0) throw new ApiError('Une modification locale dépasse la taille maximale de synchronisation. Elle reste enregistrée sur cet appareil.');
      break;
    }
    Object.assign(payload, next);
    if (candidate.kind === 'attendance') pendingAttendanceBatch.push(candidate.item);
    else syncedEntityBatch.push(candidate.change);
    selectedCount += 1;
  }

  const pendingPhotoChanges = syncedEntityBatch.filter(change => change.entity === 'child'
    && (!change.fields?.length || change.fields.includes('photoUrl')));
  if (session.role === 'ADMIN') {
    for (const change of pendingPhotoChanges) {
      const photoUrl = childrenByIdForPatch.get(change.id)?.photoUrl;
      if (photoUrl?.startsWith('data:image/jpeg;base64,')) await uploadMobileChildPhoto(session, change.id, photoUrl);
    }
  }

  const result = await postSync(payload, session.token);
  if (!result.success) throw new ApiError(result.error ?? 'Synchronisation impossible.');

  const childrenById = new Map(children.map(child => [child.id, child]));
  for (const row of result.c ?? []) {
    const [id, firstName, lastName, postName, classCode, parentPhone, address, birthDate, notes, photoUrl, , , gender, parentName, parentId] = row;
    childrenById.set(id, {
      id,
      firstName,
      lastName,
      postName,
      classLevel: classCode === '2' ? 'SECOND' : classCode === '3' ? 'THIRD' : 'FIRST',
      parentPhone,
      address,
      birthDate: decodeDate(birthDate) || null,
      notes: notes || null,
      photoUrl: photoUrl || null,
      gender: gender === 'F' ? 'F' : 'M',
      parentName: parentName || null,
      parentId: parentId || null,
    });
  }
  for (const id of result.d ?? []) childrenById.delete(id);
  if (result.activeChildIds) {
    const activeIds = new Set(result.activeChildIds);
    for (const id of childrenById.keys()) if (!activeIds.has(id)) childrenById.delete(id);
  }

  const attendanceByKey = new Map(attendance.map(item => [attendanceKey(item), item]));
  for (const row of result.a ?? []) {
    const [id, childId, date, code, markedAt] = row;
    const normalizedDate = decodeDate(date);
    attendanceByKey.set(`${childId}:${normalizedDate}`, {
      id,
      childId,
      date: normalizedDate,
      status: code === 'p' ? 'PRESENT' : code === 'm' ? 'SICK' : 'ABSENT',
      markedAt,
    });
  }

  const parentsById = new Map(currentParents.map(parent => [parent.id, parent]));
  for (const [id, name, phone, address, createdAt, updatedAt] of result.p ?? []) {
    parentsById.set(id, { id, name, phone: phone || null, address: address || null, createdAt, updatedAt });
  }
  for (const id of result.deletedParentIds ?? []) parentsById.delete(id);
  if (result.activeParentIds) {
    const activeIds = new Set(result.activeParentIds);
    for (const id of parentsById.keys()) if (!activeIds.has(id)) parentsById.delete(id);
  }

  const eventsById = new Map(currentEvents.map(event => [event.id, event]));
  for (const [id, title, date, description, createdAt] of result.e ?? []) {
    eventsById.set(id, { id, title, date: decodeDate(date), description: description || null, createdAt });
  }
  const pendingEventIds = new Set(pendingEntities.filter(change => change.entity === 'event').map(change => change.id));
  for (const id of result.deletedEventIds ?? []) if (!pendingEventIds.has(id)) eventsById.delete(id);
  if (result.activeEventIds) {
    const activeIds = new Set(result.activeEventIds);
    for (const id of eventsById.keys()) if (!activeIds.has(id) && !pendingEventIds.has(id)) eventsById.delete(id);
  }
  const tasksById = new Map(currentTasks.map(task => [task.id, task]));
  for (const [id, eventId, childId, title, type, done, createdAt] of result.t ?? []) {
    tasksById.set(id, { id, eventId, childId, title, type: type || null, done: done === '1', createdAt });
  }
  const pendingTaskIds = new Set(pendingEntities.filter(change => change.entity === 'task').map(change => change.id));
  for (const id of result.deletedTaskIds ?? []) if (!pendingTaskIds.has(id)) tasksById.delete(id);
  if (result.activeTaskIds) {
    const activeIds = new Set(result.activeTaskIds);
    for (const id of tasksById.keys()) if (!activeIds.has(id) && !pendingTaskIds.has(id)) tasksById.delete(id);
  }

  await storage.mergeAttendance(Array.from(attendanceByKey.values()));
  await storage.removeAcceptedPendingAttendance(pendingAttendanceBatch, result.acceptedAttendanceKeys ?? []);
  await storage.commitSyncCache({
    children: Array.from(childrenById.values()),
    parents: Array.from(parentsById.values()),
    events: Array.from(eventsById.values()),
    tasks: Array.from(tasksById.values()),
    sentEntityChanges: syncedEntityBatch,
    discardedEntityChanges,
    lastSync: result.serverSyncedAt ?? new Date().toISOString(),
  });

  const [remainingEntityChanges, remainingAttendance] = await Promise.all([
    storage.getPendingEntityChanges(),
    storage.getPendingAttendance(),
  ]);
  const hasMore = remainingEntityChanges.some(change =>
    change.entity === 'child' ? childrenByIdForPatch.has(change.id)
      : change.entity === 'event' ? eventsByIdForPatch.has(change.id)
        : tasksByIdForPatch.has(change.id)) || remainingAttendance.length > 0;
  return { ...result, hasMore };
}

function groupAttendanceKeys(attendance: Attendance[]): Array<[string, string[]]> {
  const datesByChild = new Map<string, string[]>();
  for (const item of attendance) {
    const dates = datesByChild.get(item.childId) ?? [];
    dates.push(encodeDate(item.date));
    datesByChild.set(item.childId, dates);
  }
  return Array.from(datesByChild, ([childId, dates]): [string, string[]] => [childId, dates]);
}

function estimateJsonBytes(value: unknown): number {
  const json = JSON.stringify(value);
  let bytes = 0;
  for (const character of json) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function attendanceKey(item: Pick<Attendance, 'childId' | 'date'>): string {
  return `${item.childId}:${item.date}`;
}

function encodeDate(date: string): string {
  return date.replaceAll('-', '');
}

function decodeDate(value: string): string {
  return value.includes('-') ? value : `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function encodeStatus(status: Attendance['status']): string {
  return status === 'PRESENT' ? 'p' : status === 'SICK' ? 'm' : 'a';
}
