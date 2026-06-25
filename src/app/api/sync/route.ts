import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { mode } = data;

    if (mode === "pull-missing") {
      const childIds = Array.isArray(data.childIds) ? data.childIds : [];
      const attendanceKeys = new Set(Array.isArray(data.attendanceKeys) ? data.attendanceKeys : []);
      const [children, attendances] = await Promise.all([
        prisma.child.findMany({
          where: childIds.length > 0 ? { id: { notIn: childIds } } : undefined,
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
      const missingAttendances = attendances.filter(
        (attendance) => !attendanceKeys.has(`${attendance.childId}:${attendance.date}`),
      );

      return NextResponse.json({
        success: true,
        children: children.map((child) => ({
          ...child,
          createdAt: child.createdAt.toISOString(),
          updatedAt: child.updatedAt.toISOString(),
        })),
        attendances: missingAttendances.map((attendance) => ({
          ...attendance,
          markedAt: attendance.markedAt.toISOString(),
        })),
      });
    }

    const { children = [], attendances = [] } = data;

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

    return NextResponse.json({ success: true, message: "Synchronisation réussie" });
  } catch (error) {
    console.error("Erreur de synchronisation:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
