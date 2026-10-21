import type { Attendance, AttendanceStatus } from '../types';
import { storage } from './storage';

/** Persists attendance and its upload queue atomically in SQLite. */
export async function recordAttendance(childId: string, date: string, status: AttendanceStatus): Promise<Attendance[]> {
  await storage.recordAttendance(childId, date, status);
  return storage.getAttendance();
}
