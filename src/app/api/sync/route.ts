import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { mode } = data;

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
