import type { Attendance, Child, ClassLevel } from './types';

export type NotificationSectionId = 'birthdays' | 'absences' | 'sick' | 'incomplete';
export type ExpectedClass = ClassLevel | 'ARCHIVE';

export interface NotificationItem {
  child: Child;
  title: string;
  details: string;
  expectedClass: ExpectedClass | null;
}

export interface NotificationSection {
  id: NotificationSectionId;
  title: string;
  tone: 'purple' | 'red' | 'blue' | 'orange';
  children: NotificationItem[];
}

const DAY_MS = 86_400_000;
const ABSENCE_STREAK_LENGTH = 3;
const RECENT_ATTENDANCE_DAYS = 14;

export function buildNotificationSections(
  children: Child[],
  attendance: Attendance[],
  now = new Date(),
): NotificationSection[] {
  const visibleChildren = children.filter(child =>
    child.firstName.trim() || child.lastName.trim() || child.postName.trim(),
  );
  const attendanceByChild = new Map<string, Attendance[]>();

  for (const entry of attendance) {
    const history = attendanceByChild.get(entry.childId) ?? [];
    const insertAt = history.findIndex(item => item.date < entry.date);
    if (insertAt === -1 && history.length >= ABSENCE_STREAK_LENGTH) continue;
    history.splice(insertAt === -1 ? history.length : insertAt, 0, entry);
    if (history.length > ABSENCE_STREAK_LENGTH) history.pop();
    attendanceByChild.set(entry.childId, history);
  }

  const today = startOfDay(now);
  const currentSunday = sundayOf(today);
  const birthdays: NotificationItem[] = [];
  const absences: NotificationItem[] = [];
  const sick: NotificationItem[] = [];
  const incomplete: NotificationItem[] = [];

  for (const child of visibleChildren) {
    const birthDate = parseDate(child.birthDate);
    if (birthDate) {
      const birthday = upcomingBirthday(birthDate, today);
      const daysUntil = dayDifference(today, birthday);
      if (daysUntil >= -2 && daysUntil <= 7) {
        const age = birthday.getFullYear() - birthDate.getFullYear();
        const expectedClass = classForAge(age);
        birthdays.push({
          child,
          title: 'Anniversaire de ' + child.firstName,
          details: [
            'Le ' + birthday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
            age + ' ans',
            classLabel(child.classLevel),
          ].join(' · '),
          expectedClass,
        });
      }
    }

    const history = attendanceByChild.get(child.id) ?? [];
    const latestThree = history.slice(0, ABSENCE_STREAK_LENGTH);
    const latestDate = latestThree[0] ? parseDate(latestThree[0].date) : null;
    const latestIsRecent = latestDate !== null
      && latestDate <= currentSunday
      && dayDifference(latestDate, currentSunday) <= RECENT_ATTENDANCE_DAYS;
    const isThreeWeeklyAbsences = latestThree.length === ABSENCE_STREAK_LENGTH
      && latestIsRecent
      && latestThree.every(entry => entry.status === 'ABSENT')
      && weeklySessionsAreConsecutive(latestThree);

    if (isThreeWeeklyAbsences) {
      const oldest = latestThree[latestThree.length - 1].date;
      absences.push({
        child,
        title: childName(child),
        details: '3 appels consécutifs · du ' + formatDate(oldest) + ' au ' + formatDate(latestThree[0].date),
        expectedClass: null,
      });
    }

    const latestAttendance = history[0];
    const latestAttendanceDate = latestAttendance ? parseDate(latestAttendance.date) : null;
    const recentSickReport = latestAttendance?.status === 'SICK'
      && latestAttendanceDate !== null
      && latestAttendanceDate <= currentSunday
      && dayDifference(latestAttendanceDate, currentSunday) <= RECENT_ATTENDANCE_DAYS;
    if (recentSickReport) {
      sick.push({
        child,
        title: childName(child),
        details: 'Signalé malade le ' + formatDate(latestAttendance.date),
        expectedClass: null,
      });
    }

    if (!child.parentPhone.trim()) {
      incomplete.push({
        child,
        title: childName(child),
        details: classLabel(child.classLevel) + ' · téléphone du responsable manquant',
        expectedClass: null,
      });
    }
  }

  return [
    { id: 'birthdays', title: 'Anniversaires (7 jours)', tone: 'purple', children: birthdays },
    { id: 'absences', title: 'Absences prolongées (3 semaines)', tone: 'red', children: absences },
    { id: 'sick', title: 'Enfants malades', tone: 'blue', children: sick },
    { id: 'incomplete', title: 'Profils sans téléphone', tone: 'orange', children: incomplete },
  ];
}

export function countNotifiedChildren(sections: NotificationSection[]): number {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const item of section.children) ids.add(item.child.id);
  }
  return ids.size;
}

export function expectedClassForBirthday(value: string | null | undefined, now = new Date()): ExpectedClass | null {
  const birthDate = parseDate(value);
  if (!birthDate) return null;
  const birthday = upcomingBirthday(birthDate, startOfDay(now));
  return classForAge(birthday.getFullYear() - birthDate.getFullYear());
}

export function classLabel(level: ClassLevel | ExpectedClass): string {
  if (level === 'ARCHIVE') return 'Archive';
  return level === 'FIRST' ? 'Classe 1' : level === 'SECOND' ? 'Classe 2' : 'Classe 3';
}

function weeklySessionsAreConsecutive(entries: Attendance[]): boolean {
  for (let index = 1; index < entries.length; index += 1) {
    const newer = parseDate(entries[index - 1].date);
    const older = parseDate(entries[index].date);
    if (!newer || !older || dayDifference(older, newer) !== 7) return false;
  }
  return true;
}

function parseDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function upcomingBirthday(birthDate: Date, today: Date): Date {
  const date = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (dayDifference(today, date) < -2) date.setFullYear(date.getFullYear() + 1);
  return date;
}

function classForAge(age: number): ExpectedClass | null {
  if (age >= 4 && age < 8) return 'FIRST';
  if (age >= 8 && age < 12) return 'SECOND';
  if (age >= 12 && age <= 15) return 'THIRD';
  if (age > 15) return 'ARCHIVE';
  return null;
}

function childName(child: Child): string {
  return [child.firstName, child.lastName, child.postName].filter(Boolean).join(' ');
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : value;
}

function dayDifference(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / DAY_MS);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sundayOf(value: Date): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
}
