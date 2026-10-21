export type ClassLevel = 'FIRST' | 'SECOND' | 'THIRD';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'SICK';

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  postName: string;
  gender: 'M' | 'F';
  classLevel: ClassLevel;
  parentPhone: string;
  address: string;
  birthDate?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  parentName?: string | null;
  parentId?: string | null;
}

export interface Parent {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  description: string | null;
  createdAt: string;
}

export interface ChildTask {
  id: string;
  eventId: string;
  childId: string;
  title: string;
  type: string | null;
  done: boolean;
  createdAt: string;
}

export interface MediaResource {
  id: string;
  type: 'image' | 'video' | 'pdf';
  title: string;
  url: string;
  thumbnail: string | null;
  aspectRatio: string;
  createdAt: string;
}

export interface AdminUser {
  id: string; username: string; name: string | null; role: string; title: string | null; isBlocked: boolean; createdAt: string;
}

export interface ActivityLog {
  id: string; username: string; userFullName: string; action: string; details: string; createdAt: string;
}

export interface Attendance {
  id: string;
  childId: string;
  date: string;
  status: AttendanceStatus;
  markedAt: string;
}

export interface Session {
  token: string;
  username: string;
  name: string;
  role: string;
}

export interface SyncPayload {
  mode: 'sync-v2';
  compactDeletes: true;
  l: string | null;
  kc: string[];
  kp: string[];
  ke: string[];
  kt: string[];
  ka?: string[];
  /** Compact form of known attendance keys, grouped by child ID. */
  ka2?: Array<[string, string[]]>;
  c: Array<[string, string, ...string[]]>;
  a: Array<[string, string, string, string?]>;
  e: Array<[string, string, string, string]>;
  t: Array<[string, string, string, string, string, string]>;
  dp: string[];
  de: string[];
  dt: string[];
}

export type EditableChildField = 'firstName' | 'lastName' | 'postName' | 'classLevel' | 'parentPhone' | 'address' | 'birthDate' | 'notes' | 'photoUrl' | 'gender' | 'parentName' | 'parentId';

export interface PendingEntityChange {
  entity: 'child' | 'event' | 'task';
  id: string;
  updatedAt: string;
  fields?: EditableChildField[];
}

export interface SyncResponse {
  success: boolean;
  hasMore?: boolean;
  serverSyncedAt?: string;
  c?: Array<[string, string, string, string, string, string, string, string, string, string, string, string, string, string, string]>;
  p?: Array<[string, string, string, string, string, string]>;
  a?: Array<[string, string, string, string, string]>;
  e?: Array<[string, string, string, string, string]>;
  t?: Array<[string, string, string, string, string, string, string]>;
  d?: string[];
  deletedParentIds?: string[];
  deletedEventIds?: string[];
  deletedTaskIds?: string[];
  /** Full inventories are accepted only for older server versions. */
  activeChildIds?: string[];
  activeParentIds?: string[];
  activeEventIds?: string[];
  activeTaskIds?: string[];
  acceptedAttendanceKeys?: string[];
  error?: string;
}
