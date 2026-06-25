import type { Attendance, AttendanceStatus } from "@/lib/db";
import { getAttendanceStatus } from "@/lib/db";

export async function resizeImageFile(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const maxSize = 720;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");

  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function isBirthdayInWeek(birthDate: string | undefined, weekStartDate: string) {
  const birthday = parseDateString(birthDate);
  const weekStart = parseDateString(weekStartDate);

  if (!birthday || !weekStart) return false;

  const weekEnd = addDays(weekStart, 6);
  const candidateYears = new Set([weekStart.getFullYear(), weekEnd.getFullYear()]);

  return [...candidateYears].some((year) => {
    const birthdayThisYear = new Date(year, birthday.getMonth(), birthday.getDate());
    return birthdayThisYear >= weekStart && birthdayThisYear <= weekEnd;
  });
}

export function getHistoryDotClass(status?: AttendanceStatus) {
  if (status === "PRESENT") return "bg-green-500";
  if (status === "ABSENT") return "bg-red-500";
  if (status === "SICK") return "bg-yellow-400";
  return "bg-white/25";
}

export function buildAttendanceHistoryMap(attendances?: Attendance[]) {
  const map = new Map<string, AttendanceStatus[]>();
  const sortedAttendances = [...(attendances ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  sortedAttendances.forEach((attendance) => {
    const status = getAttendanceStatus(attendance);
    if (!status) return;

    const history = map.get(attendance.childId) ?? [];
    if (history.length >= 3) return;

    history.push(status);
    map.set(attendance.childId, history);
  });

  return map;
}

function parseDateString(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
