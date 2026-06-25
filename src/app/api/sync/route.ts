import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ChildPatch = [string, string, ...string[]];
type AttendancePatch = [string, string, string];

const childFieldByCode: Record<string, string> = {
  f: "firstName",
  l: "lastName",
  o: "postName",
  c: "classLevel",
  t: "parentPhone",
  a: "address",
  b: "birthDate",
  n: "notes",
  h: "photoUrl",
};

function decodeDate(value?: string | null) {
  if (!value) return "";
  if (value.includes("-")) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function encodeDate(value?: string | null) {
  return value ? value.replaceAll("-", "") : "";
}

function decodeClass(value?: string | null) {
  if (value === "2") return "SECOND";
  if (value === "3") return "THIRD";
  return "FIRST";
}

function encodeClass(value?: string | null) {
  if (value === "SECOND") return "2";
  if (value === "THIRD") return "3";
  return "1";
}

function decodeStatus(value?: string | null) {
  if (value === "p") return "PRESENT";
  if (value === "m") return "SICK";
  return "ABSENT";
}

function encodeStatus(value?: string | null) {
  if (value === "PRESENT") return "p";
  if (value === "SICK") return "m";
  return "a";
}

function decodeChildPatch(patch: ChildPatch) {
  const [id, codes, ...values] = patch;
  const data: Record<string, string | null> = {};

  [...codes].forEach((code, index) => {
    const field = childFieldByCode[code];
    if (!field) return;

    const value = values[index] ?? "";
    if (field === "classLevel") data[field] = decodeClass(value);
    else if (field === "birthDate") data[field] = decodeDate(value);
    else if (field === "photoUrl") data[field] = value || null;
    else data[field] = value;
  });

  return { id, data };
}

function compactChild(child: {
  id: string;
  firstName: string;
  lastName: string;
  postName: string;
  classLevel: string;
  parentPhone: string;
  address: string;
  birthDate: string | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return [
    child.id,
    child.firstName,
    child.lastName,
    child.postName,
    encodeClass(child.classLevel),
    child.parentPhone,
    child.address,
    encodeDate(child.birthDate),
    child.notes ?? "",
    child.photoUrl ?? "",
    child.createdAt.toISOString(),
    child.updatedAt.toISOString(),
  ];
}

function compactAttendance(attendance: {
  id: string;
  childId: string;
  date: string;
  status: string;
  markedAt: Date;
}) {
  return [
    attendance.id,
    attendance.childId,
    encodeDate(attendance.date),
    encodeStatus(attendance.status),
    attendance.markedAt.toISOString(),
  ];
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { mode } = data;

    if (mode === "sync-v2") {
      const childPatches = Array.isArray(data.c) ? data.c as ChildPatch[] : [];
      const attendancePatches = Array.isArray(data.a) ? data.a as AttendancePatch[] : [];
      const knownChildIds = Array.isArray(data.kc) ? data.kc : [];
      const knownAttendanceKeys = new Set(Array.isArray(data.ka) ? data.ka : []);
      const pushedChildIds = new Set(childPatches.map((patch) => patch[0]));
      const pushedAttendanceKeys = new Set(attendancePatches.map((patch) => `${patch[0]}:${patch[1]}`));
      const lastSyncDate = typeof data.l === "string" ? new Date(data.l) : null;
      const hasValidLastSyncDate = lastSyncDate instanceof Date && !Number.isNaN(lastSyncDate.getTime());
      const serverSyncedAt = new Date();

      for (const patch of childPatches) {
        const { id, data: childData } = decodeChildPatch(patch);
        const existingChild = await prisma.child.findUnique({ where: { id } });

        if (existingChild) {
          await prisma.child.update({
            where: { id },
            data: childData,
          });
        } else {
          await prisma.child.create({
            data: {
              id,
              firstName: String(childData.firstName ?? ""),
              lastName: String(childData.lastName ?? ""),
              postName: String(childData.postName ?? ""),
              classLevel: String(childData.classLevel ?? "FIRST"),
              parentPhone: String(childData.parentPhone ?? ""),
              address: String(childData.address ?? ""),
              birthDate: typeof childData.birthDate === "string" ? childData.birthDate : null,
              notes: typeof childData.notes === "string" ? childData.notes : null,
              photoUrl: typeof childData.photoUrl === "string" ? childData.photoUrl : null,
            },
          });
        }
      }

      for (const patch of attendancePatches) {
        const [childId, compactDate, statusCode] = patch;
        const date = decodeDate(compactDate);
        const status = decodeStatus(statusCode);
        const existing = await prisma.attendance.findUnique({
          where: {
            childId_date: {
              childId,
              date,
            },
          },
        });

        if (existing) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              present: status === "PRESENT",
              status,
              markedAt: serverSyncedAt,
            },
          });
        } else {
          await prisma.attendance.create({
            data: {
              childId,
              date,
              present: status === "PRESENT",
              status,
              markedAt: serverSyncedAt,
            },
          });
        }
      }

      const childWhere = hasValidLastSyncDate
        ? knownChildIds.length > 0
          ? {
              OR: [
                { id: { notIn: knownChildIds } },
                { updatedAt: { gt: lastSyncDate } },
              ],
            }
          : undefined
        : knownChildIds.length > 0
          ? { id: { notIn: knownChildIds } }
          : undefined;
      const [serverChildren, serverAttendances] = await Promise.all([
        prisma.child.findMany({
          where: childWhere,
          orderBy: [
            { lastName: "asc" },
            { postName: "asc" },
            { firstName: "asc" },
          ],
        }),
        prisma.attendance.findMany({
          orderBy: [
            { date: "asc" },
            { childId: "asc" },
          ],
        }),
      ]);
      const deltaChildren = serverChildren.filter((child) => !pushedChildIds.has(child.id));
      const deltaAttendances = serverAttendances.filter((attendance) => {
        const key = `${attendance.childId}:${encodeDate(attendance.date)}`;
        const isMissing = !knownAttendanceKeys.has(key);
        const isUpdatedSinceLastSync = hasValidLastSyncDate && attendance.markedAt > lastSyncDate;

        return !pushedAttendanceKeys.has(key) && (isMissing || isUpdatedSinceLastSync);
      });

      return NextResponse.json({
        success: true,
        serverSyncedAt: serverSyncedAt.toISOString(),
        c: deltaChildren.map(compactChild),
        a: deltaAttendances.map(compactAttendance),
      });
    }

    const { children = [], attendances = [] } = data;
    const knownChildIds = Array.isArray(data.knownChildIds) ? data.knownChildIds : [];
    const knownAttendanceKeys = new Set(Array.isArray(data.knownAttendanceKeys) ? data.knownAttendanceKeys : []);
    const pushedChildIds = new Set(children.map((child: { id: string }) => child.id));
    const pushedAttendanceKeys = new Set(
      attendances.map((attendance: { childId: string; date: string }) => `${attendance.childId}:${attendance.date}`),
    );
    const lastSyncDate = typeof data.lastSyncAt === "string" ? new Date(data.lastSyncAt) : null;
    const hasValidLastSyncDate = lastSyncDate instanceof Date && !Number.isNaN(lastSyncDate.getTime());
    const serverSyncedAt = new Date();

    // 1. Synchronisation des enfants (Upsert : Création si nouveau, Mise à jour si existant)
    for (const child of children) {
      await prisma.child.upsert({
        where: { id: child.id },
        update: {
          firstName: child.firstName,
          lastName: child.lastName,
          postName: child.postName ?? "",
          classLevel: child.classLevel ?? "FIRST",
          parentPhone: child.parentPhone,
          address: child.address,
          birthDate: child.birthDate,
          notes: child.notes,
          photoUrl: child.photoUrl,
        },
        create: {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          postName: child.postName ?? "",
          classLevel: child.classLevel ?? "FIRST",
          parentPhone: child.parentPhone,
          address: child.address,
          birthDate: child.birthDate,
          notes: child.notes,
          photoUrl: child.photoUrl,
        },
      });
    }

    // 2. Synchronisation des présences
    for (const att of attendances) {
      const status = att.status ?? (att.present ? "PRESENT" : "ABSENT");

      // IndexedDB auto-increments don't easily map to CUIDs, so we use childId + date as unique identifier
      const existing = await prisma.attendance.findUnique({
        where: {
          childId_date: {
            childId: att.childId,
            date: att.date
          }
        }
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            present: status === "PRESENT",
            status,
            markedAt: new Date(att.markedAt)
          }
        });
      } else {
        await prisma.attendance.create({
          data: {
            id: att.id,
            childId: att.childId,
            date: att.date,
            present: status === "PRESENT",
            status,
            markedAt: new Date(att.markedAt)
          }
        });
      }
    }

    if (mode === "sync-delta") {
      const childWhere = hasValidLastSyncDate
        ? knownChildIds.length > 0
          ? {
              OR: [
                { id: { notIn: knownChildIds } },
                { updatedAt: { gt: lastSyncDate } },
              ],
            }
          : undefined
        : knownChildIds.length > 0
          ? { id: { notIn: knownChildIds } }
          : undefined;
      const [serverChildren, serverAttendances] = await Promise.all([
        prisma.child.findMany({
          where: childWhere,
          orderBy: [
            { lastName: "asc" },
            { postName: "asc" },
            { firstName: "asc" },
          ],
        }),
        prisma.attendance.findMany({
          orderBy: [
            { date: "asc" },
            { childId: "asc" },
          ],
        }),
      ]);
      const deltaChildren = serverChildren.filter((child) => !pushedChildIds.has(child.id));
      const deltaAttendances = serverAttendances.filter((attendance) => {
        const key = `${attendance.childId}:${attendance.date}`;
        const isMissing = !knownAttendanceKeys.has(key);
        const isUpdatedSinceLastSync = hasValidLastSyncDate && attendance.markedAt > lastSyncDate;

        return !pushedAttendanceKeys.has(key) && (isMissing || isUpdatedSinceLastSync);
      });

      return NextResponse.json({
        success: true,
        message: "Synchronisation réussie",
        serverSyncedAt: serverSyncedAt.toISOString(),
        children: deltaChildren.map((child) => ({
          ...child,
          createdAt: child.createdAt.toISOString(),
          updatedAt: child.updatedAt.toISOString(),
        })),
        attendances: deltaAttendances.map((attendance) => ({
          ...attendance,
          markedAt: attendance.markedAt.toISOString(),
        })),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Synchronisation réussie",
      serverSyncedAt: serverSyncedAt.toISOString(),
    });
  } catch (error) {
    console.error("Erreur de synchronisation:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
