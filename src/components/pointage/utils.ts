import type { Attendance, AttendanceStatus } from "@/lib/db";
import db, { getAttendanceStatus } from "@/lib/db";

async function resizeImageFile(file: File) {
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
  // Optimisation drastique pour Turso : on réduit la taille de 720px à 360px (suffisant pour un avatar)
  const maxSize = 360;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");

  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Qualité réduite à 0.7 pour des fichiers ultra-légers (environ 15-20 Ko)
  return canvas.toDataURL("image/jpeg", 0.7);
}

export async function uploadChildPhoto(file: File) {
  // Redimensionne l'image en Base64 (max 720px)
  const resizedDataUrl = await resizeImageFile(file);
  
  // On retourne directement la chaîne Base64 pour la sauvegarder dans IndexedDB (Hors-ligne).
  // La synchronisation se chargera de l'envoyer au serveur plus tard.
  return resizedDataUrl;
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

export function formatDisplayName(value?: string | null, variant: "first" | "upper" = "upper") {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";

  if (variant === "first") {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }

  return normalized.toUpperCase();
}

export function calculateAgeLabel(birthDate?: string | null, referenceDate = new Date()) {
  const birthday = parseDateString(birthDate);
  if (!birthday) return "Non renseigné";

  let age = referenceDate.getFullYear() - birthday.getFullYear();
  const hasBirthdayPassed =
    referenceDate.getMonth() > birthday.getMonth() ||
    (referenceDate.getMonth() === birthday.getMonth() && referenceDate.getDate() >= birthday.getDate());

  if (!hasBirthdayPassed) age -= 1;
  if (age < 0) return "Non renseigné";

  return `${age} ${age > 1 ? "ans" : "an"}`;
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

export async function buildAttendanceHistoryMapAsync() {
  const map = new Map<string, AttendanceStatus[]>();
  
  // Obtenir le nombre total d'enfants actifs pour savoir quand arrêter le scan
  const activeChildren = await db.children.toArray();
  const activeChildIds = new Set(activeChildren.map(c => c.id));
  const totalActiveChildren = activeChildIds.size;

  if (totalActiveChildren === 0) return map;

  // Utilisation de .each() avec un index pour éviter de charger des milliers d'objets en mémoire
  // et éviter un tri JavaScript très coûteux.
  await db.attendances.orderBy('date').reverse().each((attendance) => {
    // Si l'enfant n'est plus actif, on ignore son historique
    if (!activeChildIds.has(attendance.childId)) return;

    const status = getAttendanceStatus(attendance);
    if (!status) return;

    const history = map.get(attendance.childId) ?? [];
    if (history.length < 3) {
      history.push(status);
      map.set(attendance.childId, history);
    }

    // Si nous avons collecté 3 historiques pour TOUS les enfants actifs, on s'arrête immédiatement !
    if (map.size === totalActiveChildren) {
      const allCompleted = Array.from(map.values()).every(h => h.length >= 3);
      if (allCompleted) {
        return false; // Arrête l'itération Dexie immédiatement
      }
    }
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
