import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

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
  g: "gender",
  u: "parentFirstName",
  v: "parentLastName",
  p: "parentId",
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
  parentFirstName: string;
  parentLastName: string;
  address: string;
  birthDate: string | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  gender: string;
  parentId: string | null;
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
    child.gender,
    child.parentFirstName,
    child.parentLastName,
    child.parentId ?? "",
  ];
}

function compactParent(parent: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return [
    parent.id,
    parent.firstName,
    parent.lastName,
    parent.phone,
    parent.address,
    parent.createdAt.toISOString(),
    parent.updatedAt.toISOString(),
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
    const session = await getServerSession(authOptions);
    const userId = session ? (session.user as any).id : "anonymous";
    const username = session ? (session.user as any)?.username || "anonymous" : "anonymous";
    const userFullName = session ? session.user?.name || "Moniteur anonyme" : "Moniteur anonyme";

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

      await prisma.$transaction(async (tx) => {
        if (childPatches.length > 0) {
          const childIds = childPatches.map((patch) => patch[0]);
          const existingChildren = await tx.child.findMany({
            where: { id: { in: childIds } },
            select: { id: true },
          });
          const existingChildIds = new Set(existingChildren.map((c) => c.id));

          for (const patch of childPatches) {
            const { id, data: childData } = decodeChildPatch(patch);
            const isDeletion = childData.firstName === "" && childData.lastName === "" && childData.postName === "";

            if (isDeletion) {
              if (existingChildIds.has(id)) {
                await tx.child.delete({
                  where: { id },
                });
              }
              continue;
            }

            // 1. Gérer le Parent
            const parentPhone = String(childData.parentPhone ?? "");
            let parentId = childData.parentId ? String(childData.parentId) : null;

            if (parentPhone) {
              const parentFirstName = String(childData.parentFirstName ?? "Parent");
              const parentLastName = String(childData.parentLastName ?? childData.lastName ?? "Parent");
              const address = String(childData.address ?? "");

              const parent = await tx.parent.upsert({
                where: { phone: parentPhone },
                update: {
                  firstName: parentFirstName || undefined,
                  lastName: parentLastName || undefined,
                  address: address || undefined,
                },
                create: {
                  firstName: parentFirstName || "Parent",
                  lastName: parentLastName || "Parent",
                  phone: parentPhone,
                  address: address || "",
                },
              });
              parentId = parent.id;
            }

            // 2. Gérer le Child
            const childFields = {
              firstName: String(childData.firstName ?? ""),
              lastName: String(childData.lastName ?? ""),
              postName: String(childData.postName ?? ""),
              gender: String(childData.gender ?? "M"),
              classLevel: String(childData.classLevel ?? "FIRST"),
              parentPhone: parentPhone,
              parentFirstName: String(childData.parentFirstName ?? ""),
              parentLastName: String(childData.parentLastName ?? ""),
              address: String(childData.address ?? ""),
              birthDate: typeof childData.birthDate === "string" ? childData.birthDate : null,
              notes: typeof childData.notes === "string" ? childData.notes : null,
              photoUrl: typeof childData.photoUrl === "string" ? childData.photoUrl : null,
              parentId: parentId,
            };

            await tx.child.upsert({
              where: { id },
              update: childFields,
              create: {
                id,
                ...childFields,
              },
            });
          }
        }

        const filteredAttendancePatches = attendancePatches.filter((patch) => {
          const date = decodeDate(patch[1]);
          return date >= "2026-06-28";
        });

        if (filteredAttendancePatches.length > 0) {
          const attendanceKeys = filteredAttendancePatches.map((patch) => {
            const [childId, compactDate] = patch;
            return { childId, date: decodeDate(compactDate) };
          });

          const existingAttendances = await tx.attendance.findMany({
            where: {
              OR: attendanceKeys,
            },
            select: { childId: true, date: true },
          });
          const existingKeys = new Set(
            existingAttendances.map((a) => `${a.childId}:${a.date}`)
          );

          const attendanceCreates: any[] = [];
          const attendanceUpdates: Array<{ childId: string; date: string; status: string }> = [];

          for (const patch of filteredAttendancePatches) {
            const [childId, compactDate, statusCode] = patch;
            const date = decodeDate(compactDate);
            const status = decodeStatus(statusCode);
            const key = `${childId}:${date}`;

            if (existingKeys.has(key)) {
              attendanceUpdates.push({ childId, date, status });
            } else {
              attendanceCreates.push({
                childId,
                date,
                present: status === "PRESENT",
                status,
                markedAt: serverSyncedAt,
              });
            }
          }

          if (attendanceCreates.length > 0) {
            await tx.attendance.createMany({
              data: attendanceCreates,
            });
          }

          if (attendanceUpdates.length > 0) {
            await Promise.all(
              attendanceUpdates.map((up) =>
                tx.attendance.update({
                  where: {
                    childId_date: {
                      childId: up.childId,
                      date: up.date,
                    },
                  },
                  data: {
                    present: up.status === "PRESENT",
                    status: up.status,
                    markedAt: serverSyncedAt,
                  },
                })
              )
            );
          }
        }
      }, {
        maxWait: 15000,
        timeout: 30000,
      });

      const childWhere = hasValidLastSyncDate
        ? knownChildIds.length > 0
          ? {
              OR: [
                { id: { notIn: knownChildIds } },
                { updatedAt: { gt: lastSyncDate } },
              ],
            }
          : { updatedAt: { gt: lastSyncDate } }
        : knownChildIds.length > 0
          ? { id: { notIn: knownChildIds } }
          : undefined;

      const parentWhere = hasValidLastSyncDate
        ? { updatedAt: { gt: lastSyncDate } }
        : undefined;

      const [serverChildren, serverParents, serverAttendances] = await Promise.all([
        prisma.child.findMany({
          where: childWhere,
          orderBy: [
            { lastName: "asc" },
            { postName: "asc" },
            { firstName: "asc" },
          ],
        }),
        prisma.parent.findMany({
          where: parentWhere,
        }),
        prisma.attendance.findMany({
          where: hasValidLastSyncDate
            ? { markedAt: { gt: lastSyncDate }, date: { gte: "2026-06-28" } }
            : { date: { gte: "2026-06-28" } },
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

      // Enregistrer l'activité de synchronisation v2
      await prisma.activityLog.create({
        data: {
          userId,
          username,
          userFullName,
          action: "SYNC_DATA",
          details: `Synchronisation (v2) : ${childPatches.length} modifications d'enfants et ${attendancePatches.length} pointages de présence envoyés.`,
        },
      });

      return NextResponse.json({
        success: true,
        serverSyncedAt: serverSyncedAt.toISOString(),
        c: deltaChildren.map(compactChild),
        p: serverParents.map(compactParent),
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

    await prisma.$transaction(async (tx) => {
      // 1. Synchronisation des enfants (Optimisée)
      if (children.length > 0) {
        const childIds = children.map((c: any) => c.id);
        const existingChildren = await tx.child.findMany({
          where: { id: { in: childIds } },
          select: { id: true },
        });
        const existingChildIds = new Set(existingChildren.map((c) => c.id));

        for (const child of children) {
          const isDeletion = child.firstName === "" && child.lastName === "" && (child.postName ?? "") === "";

          if (isDeletion) {
            if (existingChildIds.has(child.id)) {
              await tx.child.delete({
                where: { id: child.id },
              });
            }
            continue;
          }

          // Gérer le Parent
          const parentPhone = String(child.parentPhone ?? "");
          let parentId = child.parentId ? String(child.parentId) : null;

          if (parentPhone) {
            const parentFirstName = String(child.parentFirstName ?? "Parent");
            const parentLastName = String(child.parentLastName ?? child.lastName ?? "Parent");
            const address = String(child.address ?? "");

            const parent = await tx.parent.upsert({
              where: { phone: parentPhone },
              update: {
                firstName: parentFirstName || undefined,
                lastName: parentLastName || undefined,
                address: address || undefined,
              },
              create: {
                firstName: parentFirstName || "Parent",
                lastName: parentLastName || "Parent",
                phone: parentPhone,
                address: address || "",
              },
            });
            parentId = parent.id;
          }

          const childFields = {
            firstName: child.firstName,
            lastName: child.lastName,
            postName: child.postName ?? "",
            gender: child.gender ?? "M",
            classLevel: child.classLevel ?? "FIRST",
            parentPhone: parentPhone,
            parentFirstName: child.parentFirstName ?? "",
            parentLastName: child.parentLastName ?? "",
            address: child.address,
            birthDate: child.birthDate,
            notes: child.notes,
            photoUrl: child.photoUrl,
            parentId: parentId,
          };

          await tx.child.upsert({
            where: { id: child.id },
            update: childFields,
            create: {
              id: child.id,
              ...childFields,
            },
          });
        }
      }

      // 2. Synchronisation des présences (Optimisée)
      const filteredAttendances = attendances.filter((att: any) => att.date >= "2026-06-28");
      if (filteredAttendances.length > 0) {
        const attendanceKeys = filteredAttendances.map((att: any) => ({
          childId: att.childId,
          date: att.date,
        }));

        const existingAttendances = await tx.attendance.findMany({
          where: {
            OR: attendanceKeys,
          },
          select: { childId: true, date: true },
        });
        const existingKeys = new Set(
          existingAttendances.map((a) => `${a.childId}:${a.date}`)
        );

        const attendanceCreates: any[] = [];
        const attendanceUpdates: Array<{ id: string; childId: string; date: string; status: string; markedAt: Date }> = [];

        for (const att of filteredAttendances) {
          const status = att.status ?? (att.present ? "PRESENT" : "ABSENT");
          const key = `${att.childId}:${att.date}`;
          const markedAtDate = new Date(att.markedAt);

          if (existingKeys.has(key)) {
            attendanceUpdates.push({
              id: att.id,
              childId: att.childId,
              date: att.date,
              status,
              markedAt: markedAtDate,
            });
          } else {
            attendanceCreates.push({
              id: att.id,
              childId: att.childId,
              date: att.date,
              present: status === "PRESENT",
              status,
              markedAt: markedAtDate,
            });
          }
        }

        if (attendanceCreates.length > 0) {
          await tx.attendance.createMany({
            data: attendanceCreates,
          });
        }

        if (attendanceUpdates.length > 0) {
          await Promise.all(
            attendanceUpdates.map((up) =>
              tx.attendance.update({
                where: {
                  childId_date: {
                    childId: up.childId,
                    date: up.date,
                  },
                },
                data: {
                  present: up.status === "PRESENT",
                  status: up.status,
                  markedAt: up.markedAt,
                },
              })
            )
          );
        }
      }
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    if (mode === "sync-delta") {
      const childWhere = hasValidLastSyncDate
        ? knownChildIds.length > 0
          ? {
              OR: [
                { id: { notIn: knownChildIds } },
                { updatedAt: { gt: lastSyncDate } },
              ],
            }
          : { updatedAt: { gt: lastSyncDate } }
        : knownChildIds.length > 0
          ? { id: { notIn: knownChildIds } }
          : undefined;

      const parentWhere = hasValidLastSyncDate
        ? { updatedAt: { gt: lastSyncDate } }
        : undefined;

      const [serverChildren, serverParents, serverAttendances] = await Promise.all([
        prisma.child.findMany({
          where: childWhere,
          orderBy: [
            { lastName: "asc" },
            { postName: "asc" },
            { firstName: "asc" },
          ],
        }),
        prisma.parent.findMany({
          where: parentWhere,
        }),
        prisma.attendance.findMany({
          where: hasValidLastSyncDate
            ? { markedAt: { gt: lastSyncDate }, date: { gte: "2026-06-28" } }
            : { date: { gte: "2026-06-28" } },
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

      // Enregistrer l'activité de synchronisation delta
      await prisma.activityLog.create({
        data: {
          userId,
          username,
          userFullName,
          action: "SYNC_DATA",
          details: `Synchronisation (delta) : ${children.length} enfants et ${attendances.length} présences envoyés`,
        },
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
        parents: serverParents.map((parent) => ({
          ...parent,
          createdAt: parent.createdAt.toISOString(),
          updatedAt: parent.updatedAt.toISOString(),
        })),
        attendances: deltaAttendances.map((attendance) => ({
          ...attendance,
          markedAt: attendance.markedAt.toISOString(),
        })),
      });
    }

    // Enregistrer l'activité de synchronisation simple
    await prisma.activityLog.create({
      data: {
        userId,
        username,
        userFullName,
        action: "SYNC_DATA",
        details: `Synchronisation réussie sans envoi de modifications`,
      },
    });

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
