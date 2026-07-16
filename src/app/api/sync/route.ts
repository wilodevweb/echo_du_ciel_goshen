import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { SYNC_ATTENDANCE_MIN_DATE } from "@/lib/constants";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

type ChildPatch = [string, string, ...string[]];
type AttendancePatch = [string, string, string];
type EventPatch = [string, string, string, string];
type TaskPatch = [string, string, string, string, string, string];

interface CustomUser {
  id: string;
  username: string;
}

interface SyncAttendance {
  id: string;
  childId: string;
  date: string;
  status?: string;
  present?: boolean;
  markedAt: string | Date;
}



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
  u: "parentName",
  p: "parentId",
};

function normalizeName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}



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

function deduplicateAttendancePatches(patches: AttendancePatch[]) {
  const patchByKey = new Map<string, AttendancePatch>();

  for (const patch of patches) {
    const [childId, compactDate] = patch;
    patchByKey.set(`${childId}:${compactDate}`, patch);
  }

  return Array.from(patchByKey.values());
}

function deduplicateSyncAttendances(attendances: SyncAttendance[]) {
  const attendanceByKey = new Map<string, SyncAttendance>();

  for (const attendance of attendances) {
    const key = `${attendance.childId}:${attendance.date}`;
    const existingAttendance = attendanceByKey.get(key);

    if (!existingAttendance || new Date(attendance.markedAt) >= new Date(existingAttendance.markedAt)) {
      attendanceByKey.set(key, attendance);
    }
  }

  return Array.from(attendanceByKey.values());
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

function decodeEventPatch(patch: EventPatch) {
  const [id, title, date, description] = patch;
  return { id, title, date: decodeDate(date), description: description || null };
}

function decodeTaskPatch(patch: TaskPatch) {
  const [id, eventId, childId, title, type, done] = patch;
  return { id, eventId, childId, title, type: type || null, done: done === "1" };
}

function compactChild(child: {
  id: string;
  firstName: string;
  lastName: string;
  postName: string;
  classLevel: string;
  parentPhone: string;
  parentName: string;
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
    child.parentName,
    child.parentId ?? "",
  ];
}

function compactParent(parent: {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return [
    parent.id,
    parent.name,
    parent.phone ?? "",
    parent.address ?? "",
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

function compactEvent(event: {
  id: string;
  title: string;
  date: string;
  description: string | null;
  createdAt: Date;
}) {
  return [
    event.id,
    event.title,
    encodeDate(event.date),
    event.description ?? "",
    event.createdAt.toISOString(),
  ];
}

function compactTask(task: {
  id: string;
  eventId: string;
  childId: string;
  title: string;
  type: string | null;
  done: boolean;
  createdAt: Date;
}) {
  return [
    task.id,
    task.eventId,
    task.childId,
    task.title,
    task.type ?? "",
    task.done ? "1" : "0",
    task.createdAt.toISOString(),
  ];
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session ? (session.user as CustomUser).id : "anonymous";
    const username = session ? (session.user as CustomUser)?.username || "anonymous" : "anonymous";
    const userFullName = session ? session.user?.name || "Moniteur anonyme" : "Moniteur anonyme";

    const data = await req.json();
    const { mode } = data;

    if (mode === "delete-parent") {
      const { parentId } = data;
      if (!parentId) {
        return NextResponse.json({ success: false, error: "ID parent manquant" }, { status: 400 });
      }
      await prisma.parent.deleteMany({
        where: { id: parentId }
      });
      return NextResponse.json({ success: true });
    }

    if (mode === "sync-v2") {
      const childPatches = Array.isArray(data.c) ? data.c as ChildPatch[] : [];
      const attendancePatches = Array.isArray(data.a) ? data.a as AttendancePatch[] : [];
      const knownChildIds = Array.isArray(data.kc) ? data.kc : [];
      const knownAttendanceKeys = new Set(Array.isArray(data.ka) ? data.ka : []);
      const eventPatches = Array.isArray(data.e) ? data.e as EventPatch[] : [];
      const taskPatches = Array.isArray(data.t) ? data.t as TaskPatch[] : [];
      
      const pushedChildIds = new Set(childPatches.map((patch) => patch[0]));
      const pushedAttendanceKeys = new Set(attendancePatches.map((patch) => `${patch[0]}:${patch[1]}`));
      const pushedEventIds = new Set(eventPatches.map((patch) => patch[0]));
      const pushedTaskIds = new Set(taskPatches.map((patch) => patch[0]));
      
      const lastSyncDate = typeof data.l === "string" ? new Date(data.l) : null;
      const hasValidLastSyncDate = lastSyncDate instanceof Date && !Number.isNaN(lastSyncDate.getTime());
      const serverSyncedAt = new Date();

      const deletedChildIds = new Set<string>();
      const remappedChildIds = new Set<string>();
      const canonicalChildIdByClientId = new Map<string, string>();


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
            
            // On force la suppression UNIQUEMENT si le prénom ou le nom est explicitement vide dans le patch
            // Si le patch ne contient pas le prénom (undefined), on ne supprime pas !
            const explicitEmptyFirstName = childData.firstName !== undefined && (childData.firstName || "").trim() === "";
            const explicitEmptyLastName = childData.lastName !== undefined && (childData.lastName || "").trim() === "";
            const isInvalid = explicitEmptyFirstName || explicitEmptyLastName;

            if (isInvalid) {
              if (existingChildIds.has(id)) {
                await tx.child.delete({
                  where: { id },
                });
                deletedChildIds.add(id);
              }
              continue;
            }

            const childUpdateFields: Prisma.ChildUpdateInput = {};
            const createFirstName = childData.firstName !== undefined ? normalizeName(String(childData.firstName)) : "Inconnu";
            const createLastName = childData.lastName !== undefined ? normalizeName(String(childData.lastName)) : "Inconnu";
            const createPostName = childData.postName !== undefined ? normalizeName(String(childData.postName)) : "";
            const createGender = childData.gender !== undefined ? String(childData.gender) : "M";
            const createClassLevel = childData.classLevel !== undefined ? String(childData.classLevel) : "FIRST";
            const createParentPhone = childData.parentPhone !== undefined ? String(childData.parentPhone) : "";
            const createParentName = childData.parentName !== undefined ? normalizeName(String(childData.parentName)) : normalizeName(String(childData.lastName ?? ""));
            const createAddress = childData.address !== undefined ? String(childData.address) : "";
            const createBirthDate = childData.birthDate !== undefined ? (typeof childData.birthDate === "string" ? childData.birthDate : null) : null;
            const createNotes = childData.notes !== undefined ? (typeof childData.notes === "string" ? childData.notes : null) : null;

            if (childData.firstName !== undefined) childUpdateFields.firstName = createFirstName;
            if (childData.lastName !== undefined) childUpdateFields.lastName = createLastName;
            if (childData.postName !== undefined) childUpdateFields.postName = createPostName;
            if (childData.gender !== undefined) childUpdateFields.gender = createGender;
            if (childData.classLevel !== undefined) childUpdateFields.classLevel = createClassLevel;
            if (childData.parentName !== undefined) childUpdateFields.parentName = createParentName;
            if (childData.address !== undefined) childUpdateFields.address = createAddress;
            if (childData.birthDate !== undefined) childUpdateFields.birthDate = createBirthDate;
            if (childData.notes !== undefined) childUpdateFields.notes = createNotes;

            // 1. Gérer le Parent
            const parentPhone = String(childData.parentPhone ?? "");
            let parentId = childData.parentId ? String(childData.parentId) : null;

            if (parentPhone) {
              const hasParentName = childData.parentName !== undefined;
              const hasAddress = childData.address !== undefined;

              const parentName = hasParentName ? normalizeName(String(childData.parentName)) : normalizeName(String(childData.lastName ?? ""));
              const address = hasAddress ? String(childData.address) : "";

              const parentWithPhone = await tx.parent.findUnique({
                where: { phone: parentPhone }
              });

              if (parentWithPhone) {
                // Le téléphone existe déjà, on met à jour
                await tx.parent.update({
                  where: { id: parentWithPhone.id },
                  data: {
                    name: hasParentName ? parentName : undefined,
                    address: hasAddress ? address : undefined,
                  }
                });
                parentId = parentWithPhone.id;
              } else if (parentId) {
                // Le téléphone n'existe pas, mais on a un parentId
                const parentById = await tx.parent.findUnique({
                  where: { id: parentId }
                });

                if (parentById) {
                  // Le parent existe (probablement sans téléphone), on lui ajoute le téléphone
                  await tx.parent.update({
                    where: { id: parentId },
                    data: {
                      phone: parentPhone,
                      name: hasParentName ? parentName : undefined,
                      address: hasAddress ? address : undefined,
                    }
                  });
                } else {
                  // Le parent n'existe pas sur le serveur, on le crée avec l'ID client
                  await tx.parent.create({
                    data: {
                      id: parentId,
                      name: parentName || "Parent",
                      phone: parentPhone,
                      address: address || null,
                    }
                  });
                }
              } else {
                // Pas de parentId fourni, création standard
                const newParent = await tx.parent.create({
                  data: {
                    name: parentName || "Parent",
                    phone: parentPhone,
                    address: address || null,
                  },
                });
                parentId = newParent.id;
              }
            } else if (parentId) {
              // Pas de téléphone mais parentId fourni par le client
              const parentName = childData.parentName
                ? normalizeName(String(childData.parentName))
                : normalizeName(String(childData.lastName ?? "Parent"));
                
              const parentExists = await tx.parent.findUnique({
                where: { id: parentId },
                select: { id: true },
              });
              if (!parentExists) {
                // Le parent n'est pas encore sur le serveur — le créer avec l'ID client
                await tx.parent.create({
                  data: {
                    id: parentId,
                    name: parentName || "Parent",
                    phone: null,
                    address: null,
                  },
                });
              } else {
                // Le parent existe, on met à jour ses infos
                await tx.parent.update({
                  where: { id: parentId },
                  data: {
                    name: parentName || "Parent",
                  }
                });
              }
            }

            // 2. Gérer le Child
            if (childData.parentPhone !== undefined) {
              childUpdateFields.parentPhone = createParentPhone;
            }
            if (childData.parentId !== undefined || childData.parentPhone !== undefined) {
              if (parentId) {
                childUpdateFields.parent = { connect: { id: parentId } };
              } else {
                childUpdateFields.parent = { disconnect: true };
              }
            }

            const targetChildId = id;

            let createPhotoUrl = childData.photoUrl !== undefined ? (typeof childData.photoUrl === "string" ? childData.photoUrl : null) : null;

            // Pour la création (nouveau child), on doit fournir toutes les valeurs obligatoires
              const childCreateFields = {
              id: targetChildId,
              firstName: createFirstName,
              lastName: createLastName,
              postName: createPostName,
              gender: createGender,
              classLevel: createClassLevel,
              parentPhone: createParentPhone,
              parentName: createParentName,
              address: createAddress,
              birthDate: createBirthDate,
              notes: createNotes,
              photoUrl: createPhotoUrl,
              parentId: parentId || null,
            };

            // Mise à jour si c'est un patch
            if (childData.photoUrl !== undefined) {
               childUpdateFields.photoUrl = createPhotoUrl;
            }

            await tx.child.upsert({
              where: { id: targetChildId },
              update: childUpdateFields,
              create: childCreateFields,
            });
          }
        }



        const filteredAttendancePatches = deduplicateAttendancePatches(
          attendancePatches.filter((patch) => {
            const date = decodeDate(patch[1]);
            return date >= SYNC_ATTENDANCE_MIN_DATE;
          }).map((patch) => {
            const [childId, compactDate, statusCode] = patch;
            return [
              canonicalChildIdByClientId.get(childId) ?? childId,
              compactDate,
              statusCode,
            ] as AttendancePatch;
          }),
        );

        if (filteredAttendancePatches.length > 0) {
          const uniqueChildIds = Array.from(new Set(filteredAttendancePatches.map(p => p[0])));
          const validChildren = await tx.child.findMany({
            where: { id: { in: uniqueChildIds } },
            select: { id: true }
          });
          const validChildIds = new Set(validChildren.map(c => c.id));

          const validAttendancePatches = filteredAttendancePatches.filter(p => validChildIds.has(p[0]));

          const attendanceKeys = validAttendancePatches.map((patch) => {
            const [childId, compactDate] = patch;
            return { childId, date: decodeDate(compactDate) };
          });

          if (attendanceKeys.length === 0) {
             // Aucune présence valide à traiter
             // On laisse la suite s'exécuter, elle ne fera rien car les tableaux seront vides
          }

          let existingAttendances: { childId: string; date: string }[] = [];
          if (attendanceKeys.length > 0) {
            existingAttendances = await tx.attendance.findMany({
              where: {
                OR: attendanceKeys,
              },
              select: { childId: true, date: true },
            });
          }

          const existingKeys = new Set(
            existingAttendances.map((a) => `${a.childId}:${a.date}`)
          );

          const attendanceCreates: Array<{ childId: string; date: string; present: boolean; status: string; markedAt: Date }> = [];
          const attendanceUpdates: Array<{ childId: string; date: string; status: string }> = [];

          for (const patch of validAttendancePatches) {
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

        // Supprimer les parents demandés par le client
        const deletedParentIds = Array.isArray(data.dp) ? (data.dp as string[]).filter(Boolean) : [];
        if (deletedParentIds.length > 0) {
          await tx.parent.deleteMany({
            where: { id: { in: deletedParentIds } },
          });
        }
        
        // 4. Gérer les Événements
        if (eventPatches.length > 0) {
          for (const patch of eventPatches) {
            const eventData = decodeEventPatch(patch);
            await tx.event.upsert({
              where: { id: eventData.id },
              update: {
                title: eventData.title,
                date: eventData.date,
                description: eventData.description,
              },
              create: {
                id: eventData.id,
                title: eventData.title,
                date: eventData.date,
                description: eventData.description,
              },
            });
          }
        }
        
        // 5. Gérer les Tâches
        if (taskPatches.length > 0) {
          // Pré-charger les IDs valides en 2 requêtes au lieu de N*2
          const taskChildIds = [...new Set(taskPatches.map((p) => p[2]))];
          const taskEventIds = [...new Set(taskPatches.map((p) => p[1]))];
          const [validTaskChildren, validTaskEvents] = await Promise.all([
            tx.child.findMany({ where: { id: { in: taskChildIds } }, select: { id: true } }),
            tx.event.findMany({ where: { id: { in: taskEventIds } }, select: { id: true } }),
          ]);
          const validChildIdSet = new Set(validTaskChildren.map((c) => c.id));
          const validEventIdSet = new Set(validTaskEvents.map((e) => e.id));

          for (const patch of taskPatches) {
            const taskData = decodeTaskPatch(patch);
            if (!validChildIdSet.has(taskData.childId) || !validEventIdSet.has(taskData.eventId)) continue;

            await tx.task.upsert({
              where: { id: taskData.id },
              update: {
                title: taskData.title,
                type: taskData.type,
                done: taskData.done,
              },
              create: {
                id: taskData.id,
                eventId: taskData.eventId,
                childId: taskData.childId,
                title: taskData.title,
                type: taskData.type,
                done: taskData.done,
              },
            });
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
                ...(remappedChildIds.size > 0 ? [{ id: { in: Array.from(remappedChildIds) } }] : []),
              ],
            }
          : remappedChildIds.size > 0
            ? {
                OR: [
                  { updatedAt: { gt: lastSyncDate } },
                  { id: { in: Array.from(remappedChildIds) } },
                ],
              }
            : { updatedAt: { gt: lastSyncDate } }
        : knownChildIds.length > 0
          ? remappedChildIds.size > 0
            ? {
                OR: [
                  { id: { notIn: knownChildIds } },
                  { id: { in: Array.from(remappedChildIds) } },
                ],
              }
            : { id: { notIn: knownChildIds } }
          : undefined;

      const parentWhere = hasValidLastSyncDate
        ? { updatedAt: { gt: lastSyncDate } }
        : undefined;

      const [serverChildren, serverParents, serverAttendances, serverEvents, serverTasks] = await Promise.all([
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
            ? { markedAt: { gt: lastSyncDate }, date: { gte: SYNC_ATTENDANCE_MIN_DATE } }
            : { date: { gte: SYNC_ATTENDANCE_MIN_DATE } },
          orderBy: [
            { date: "asc" },
            { childId: "asc" },
          ],
        }),
        prisma.event.findMany({
          where: hasValidLastSyncDate ? { updatedAt: { gt: lastSyncDate } } : undefined,
        }),
        prisma.task.findMany({
          where: hasValidLastSyncDate ? { updatedAt: { gt: lastSyncDate } } : undefined,
        }),
      ]);
      const deltaChildren = serverChildren.filter((child) => !pushedChildIds.has(child.id));
      const deltaEvents = serverEvents.filter((event) => !pushedEventIds.has(event.id));
      const deltaTasks = serverTasks.filter((task) => !pushedTaskIds.has(task.id));
      
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

      const [allChildIds, allParentIds] = await Promise.all([
        prisma.child.findMany({ select: { id: true } }),
        prisma.parent.findMany({ select: { id: true } }),
      ]);

      return NextResponse.json({
        success: true,
        serverSyncedAt: serverSyncedAt.toISOString(),
        c: deltaChildren.map(compactChild),
        d: Array.from(deletedChildIds),
        p: serverParents.map(compactParent),
        a: deltaAttendances.map(compactAttendance),
        e: deltaEvents.map(compactEvent),
        t: deltaTasks.map(compactTask),
        activeChildIds: allChildIds.map((c) => c.id),
        activeParentIds: allParentIds.map((p) => p.id),
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
    const legacyDeletedChildIds = new Set<string>();
    const legacyRemappedChildIds = new Set<string>();
    const legacyCanonicalChildIdByClientId = new Map<string, string>();

    await prisma.$transaction(async (tx) => {
      // 1. Synchronisation des enfants (Optimisée)
      if (children.length > 0) {
        const childIds = children.map((c: { id: string }) => c.id);
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
            const parentName = String(child.parentName ?? child.lastName ?? "Parent");
            const address = String(child.address ?? "");

            const parent = await tx.parent.upsert({
              where: { phone: parentPhone },
              update: { name: parentName, address: address },
              create: { name: parentName || "Parent", phone: parentPhone, address: address || null },
            });
            parentId = parent.id;
          } else if (parentId) {
            // Pas de téléphone : créer le parent par son ID si absent du serveur ou le mettre à jour
            const parentName = normalizeName(String(child.parentName ?? child.lastName ?? "Parent"));
            
            const parentExists = await tx.parent.findUnique({
              where: { id: parentId },
              select: { id: true },
            });
            if (!parentExists) {
              await tx.parent.create({
                data: {
                  id: parentId,
                  name: parentName || "Parent",
                  phone: null,
                  address: null,
                },
              });
            } else {
              await tx.parent.update({
                where: { id: parentId },
                data: {
                  name: parentName || "Parent",
                },
              });
            }
          }

          const childFields = {
            firstName: normalizeName(child.firstName),
            lastName: normalizeName(child.lastName),
            postName: normalizeName(child.postName ?? ""),
            gender: child.gender ?? "M",
            classLevel: child.classLevel ?? "FIRST",
            parentPhone: parentPhone,
            parentName: normalizeName(child.parentName ?? ""),
            address: child.address,
            birthDate: child.birthDate,
            notes: child.notes,
            photoUrl: child.photoUrl,
            parentId: parentId,
          };
          const targetChildId = child.id;

          await tx.child.upsert({
            where: { id: targetChildId },
            update: childFields,
            create: {
              id: targetChildId,
              ...childFields,
            },
          });
        }
      }



      // 2. Synchronisation des présences (Optimisée)
      const filteredAttendances = deduplicateSyncAttendances(
        (attendances as SyncAttendance[])
          .filter((att) => att.date >= SYNC_ATTENDANCE_MIN_DATE)
          .map((att) => ({
            ...att,
            childId: legacyCanonicalChildIdByClientId.get(att.childId) ?? att.childId,
          })),
      );
      if (filteredAttendances.length > 0) {
        const attendanceKeys = filteredAttendances.map((att) => ({
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

        const attendanceCreates: Array<{ id: string; childId: string; date: string; present: boolean; status: string; markedAt: Date }> = [];
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
                ...(legacyRemappedChildIds.size > 0 ? [{ id: { in: Array.from(legacyRemappedChildIds) } }] : []),
              ],
            }
          : legacyRemappedChildIds.size > 0
            ? {
                OR: [
                  { updatedAt: { gt: lastSyncDate } },
                  { id: { in: Array.from(legacyRemappedChildIds) } },
                ],
              }
            : { updatedAt: { gt: lastSyncDate } }
        : knownChildIds.length > 0
          ? legacyRemappedChildIds.size > 0
            ? {
                OR: [
                  { id: { notIn: knownChildIds } },
                  { id: { in: Array.from(legacyRemappedChildIds) } },
                ],
              }
            : { id: { notIn: knownChildIds } }
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
            ? { markedAt: { gt: lastSyncDate }, date: { gte: SYNC_ATTENDANCE_MIN_DATE } }
            : { date: { gte: SYNC_ATTENDANCE_MIN_DATE } },
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
        d: Array.from(legacyDeletedChildIds),
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
  } catch (error: unknown) {
    console.error("Erreur de synchronisation détaillée:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({
      success: false,
      error: errorMessage || "Erreur serveur",
      stack: errorStack,
    }, { status: 500 });
  }
}
