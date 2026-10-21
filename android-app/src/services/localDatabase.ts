import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Attendance } from '../types';

const DB_NAME = 'goshen-local.db';
const LEGACY_ATTENDANCE_KEY = 'goshen.mobile.attendance.v1';
const LEGACY_PENDING_KEY = 'goshen.mobile.pending-attendance.v1';
const MIGRATION_KEY = 'goshen.mobile.attendance-sqlite.v1';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) databasePromise = initialize();
  return databasePromise;
}

async function initialize(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS attendance (id TEXT NOT NULL, childId TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, markedAt TEXT NOT NULL, PRIMARY KEY (childId, date));
    CREATE TABLE IF NOT EXISTS pending_attendance (id TEXT NOT NULL, childId TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, markedAt TEXT NOT NULL, PRIMARY KEY (childId, date));
    CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance(date);
    CREATE INDEX IF NOT EXISTS pending_attendance_date_idx ON pending_attendance(date);`);
  if (await AsyncStorage.getItem(MIGRATION_KEY) !== 'done') {
    const [oldAttendance, oldPending] = await Promise.all([AsyncStorage.getItem(LEGACY_ATTENDANCE_KEY), AsyncStorage.getItem(LEGACY_PENDING_KEY)]);
    await db.withTransactionAsync(async () => {
      for (const item of parseRows(oldAttendance)) await insert(db, 'attendance', item);
      for (const item of parseRows(oldPending)) await insert(db, 'pending_attendance', item);
    });
    await AsyncStorage.setItem(MIGRATION_KEY, 'done');
  }
  return db;
}

function parseRows(value: string | null): Attendance[] {
  if (!value) return [];
  try { return JSON.parse(value) as Attendance[]; } catch { return []; }
}

async function insert(db: SQLite.SQLiteDatabase, table: 'attendance' | 'pending_attendance', item: Attendance): Promise<void> {
  await db.runAsync(`INSERT INTO ${table} (id, childId, date, status, markedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(childId, date) DO UPDATE SET id=excluded.id, status=excluded.status, markedAt=excluded.markedAt`, item.id, item.childId, item.date, item.status, item.markedAt);
}

export const localDatabase = {
  async getAttendance(): Promise<Attendance[]> {
    const db = await database();
    return db.getAllAsync<Attendance>('SELECT id, childId, date, status, markedAt FROM attendance');
  },
  async getPendingAttendance(): Promise<Attendance[]> {
    const db = await database();
    return db.getAllAsync<Attendance>('SELECT id, childId, date, status, markedAt FROM pending_attendance');
  },
  async saveAttendance(items: Attendance[]): Promise<void> {
    const db = await database();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM attendance');
      for (const item of items) await insert(db, 'attendance', item);
    });
  },
  async mergeAttendance(items: Attendance[]): Promise<void> {
    const db = await database();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        const existing = await db.getFirstAsync<Attendance>(
          'SELECT id, childId, date, status, markedAt FROM attendance WHERE childId=? AND date=?',
          item.childId,
          item.date,
        );
        if (!existing || Date.parse(item.markedAt) >= Date.parse(existing.markedAt)) {
          await insert(db, 'attendance', item);
        }
      }
    });
  },
  async savePendingAttendance(items: Attendance[]): Promise<void> {
    const db = await database();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM pending_attendance');
      for (const item of items) await insert(db, 'pending_attendance', item);
    });
  },
  async recordAttendance(childId: string, date: string, status: Attendance['status']): Promise<Attendance> {
    const db = await database();
    let next!: Attendance;
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<Attendance>('SELECT id, childId, date, status, markedAt FROM attendance WHERE childId=? AND date=?', childId, date);
      const previous = Date.parse(existing?.markedAt ?? '');
      next = { id: existing?.id ?? `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, childId, date, status, markedAt: new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0)).toISOString() };
      await insert(db, 'attendance', next);
      await insert(db, 'pending_attendance', next);
    });
    return next;
  },
  async removeAcceptedPending(batch: Attendance[], acceptedKeys: string[]): Promise<void> {
    const acceptedKeySet = new Set(acceptedKeys);
    const accepted = new Map(batch.filter(item => acceptedKeySet.has(`${item.childId}:${item.date}`)).map(item => [`${item.childId}:${item.date}`, item]));
    if (!accepted.size) return;
    const db = await database();
    await db.withTransactionAsync(async () => {
      for (const [key, item] of accepted) {
        const [childId, date] = key.split(':');
        await db.runAsync('DELETE FROM pending_attendance WHERE childId=? AND date=? AND markedAt=?', childId, date, item.markedAt);
      }
    });
  },
};
