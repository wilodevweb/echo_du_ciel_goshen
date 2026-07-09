import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { SYNC_ATTENDANCE_MIN_DATE } from "@/lib/constants";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { uploadBase64ToVercelBlob } from "@/lib/blob";

type ChildPatch = [string, string, ...string[]];
type AttendancePatch = [string, string, string];

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

type ChildIdentityInput = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  postName?: string | null;
  classLevel?: string | null;
  parentPhone?: string | null;
  parentId?: string | null;
  birthDate?: string | null;
};

type MergeChildRecord = {
  id: string;
  firstName: string;
  lastName: string;
  postName: string;
  gender: string;
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
  parentId: string | null;
};

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

function normalizeName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeOptional(value?: string | null) {
  return (value ?? "").trim();
}

function hasCompleteChildName(child: ChildIdentityInput) {
  return Boolean(normalizeName(child.firstName) && normalizeName(child.lastName));
}

function getChildIdentityKey(child: Pick<MergeChildRecord, "firstName" | "lastName" | "postName" | "classLevel">) {
  return [
    normalizeName(child.lastName),
    normalizeName(child.postName),
    normalizeName(child.firstName),
    normalizeOptional(child.classLevel) || "FIRST",
  ].join("|");
}

function pickMergeValue(primary?: string | null, fallback?: string | null) {
  return normalizeOptional(primary) || normalizeOptional(fallback) || primary || fallback || "";
}

async function mergeDuplicateChildren(tx: Prisma.TransactionClient, targetIdentityKeys?: Set<string>) {
  if (targetIdentityKeys && targetIdentityKeys.size === 0) {
    return {
      deletedIds: new Set<string>(),
      canonicalIds: new Set<string>(),
      canonicalIdByDuplicateId: new Map<string, string>(),
    };
  }

  const children = await tx.child.findMany({
    where: {
      NOT: [
        { firstName: "" },
        { lastName: "" },
      ],
    },
    orderBy: [
      { lastName: "asc" },
      { postName: "asc" },
      { firstName: "asc" },
      { classLevel: "asc" },
      { createdAt: "asc" },
    ],
  }) as MergeChildRecord[];
  const childrenByIdentity = new Map<string, MergeChildRecord[]>();
  const deletedIds = new Set<string>();
  const canonicalIds = new Set<string>();
  const canonicalIdByDuplicateId = new Map<string, string>();

  for (const child of children) {
    const key = getChildIdentityKey(child);
    if (targetIdentityKeys && !targetIdentityKeys.has(key)) continue;

    const group = childrenByIdentity.get(key) ?? [];
    group.push(child);
    childrenByIdentity.set(key, group);
  }

  for (const group of childrenByIdentity.values()) {
    if (group.length < 2) continue;

    const [canonical, ...duplicates] = group.sort((a, b) => {
      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      return createdAtDiff || a.id.localeCompare(b.id);
    });

    canonicalIds.add(canonical.id);

    for (const duplicate of duplicates) {
      canonicalIdByDuplicateId.set(duplicate.id, canonical.id);
      deletedIds.add(duplicate.id);

      const canonicalAttendances = await tx.attendance.findMany({
        where: { childId: canonical.id },
        select: { id: true, date: true, markedAt: true },
      });
      const canonicalAttendanceByDate = new Map(canonicalAttendances.map((attendance) => [attendance.date, attendance]));
      const duplicateAttendances = await tx.attendance.findMany({
        where: { childId: duplicate.id },
      });

      for (const attendance of duplicateAttendances) {
        const existingAttendance = canonicalAttendanceByDate.get(attendance.date);

        if (existingAttendance) {
          if (attendance.markedAt > existingAttendance.markedAt) {
            await tx.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                present: attendance.present,
                status: attendance.status,
                markedAt: attendance.markedAt,
              },
            });
          }

          await tx.attendance.delete({ where: { id: attendance.id } });
        } else {
          await tx.attendance.update({
            where: { id: attendance.id },
            data: { childId: canonical.id },
          });
          canonicalAttendanceByDate.set(attendance.date, {
            id: attendance.id,
            date: attendance.date,
            markedAt: attendance.markedAt,
          });
        }
      }
    }

    const mergedData = duplicates.reduce((data, duplicate) => ({
      ...data,
      gender: pickMergeValue(data.gender, duplicate.gender),
      classLevel: pickMergeValue(data.classLevel, duplicate.classLevel),
      parentPhone: pickMergeValue(data.parentPhone, duplicate.parentPhone),
      parentFirstName: pickMergeValue(data.parentFirstName, duplicate.parentFirstName),
      parentLastName: pickMergeValue(data.parentLastName, duplicate.parentLastName),
      address: pickMergeValue(data.address, duplicate.address),
      birthDate: pickMergeValue(data.birthDate, duplicate.birthDate) || null,
      notes: pickMergeValue(data.notes, duplicate.notes) || null,
      photoUrl: pickMergeValue(data.photoUrl, duplicate.photoUrl) || null,
      parentId: pickMergeValue(data.parentId, duplicate.parentId) || null,
    }), canonical);

    await tx.child.update({
      where: { id: canonical.id },
      data: {
        gender: mergedData.gender,
        classLevel: mergedData.classLevel,
        parentPhone: mergedData.parentPhone,
        parentFirstName: mergedData.parentFirstName,
        parentLastName: mergedData.parentLastName,
        address: mergedData.address,
        birthDate: mergedData.birthDate,
        notes: mergedData.notes,
        photoUrl: mergedData.photoUrl,
        parentId: mergedData.parentId,
      },
    });

    await tx.child.deleteMany({
      where: { id: { in: duplicates.map((duplicate) => duplicate.id) } },
    });
  }

  return {
    deletedIds,
    canonicalIds,
    canonicalIdByDuplicateId,
  };
}

async function findDuplicateChild(
  tx: Prisma.TransactionClient,
  child: ChildIdentityInput,
) {
  if (!hasCompleteChildName(child)) return null;

  const firstName = normalizeName(child.firstName);
  const lastName = normalizeName(child.lastName);
  const postName = normalizeName(child.postName);
  const birthDate = normalizeOptional(child.birthDate);
  const parentPhone = normalizeOptional(child.parentPhone);
  const parentId = normalizeOptional(child.parentId);
  const classLevel = normalizeOptional(child.classLevel) || "FIRST";

  const candidates = await tx.child.findMany({
    where: {
      id: child.id ? { not: child.id } : undefined,
      firstName,
      lastName,
      postName,
    },
    select: {
      id: true,
      birthDate: true,
      parentPhone: true,
      parentId: true,
      classLevel: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return candidates.find((candidate) => {
    if (birthDate && candidate.birthDate === birthDate) return true;
    if (parentPhone && candidate.parentPhone === parentPhone) return true;
    if (parentId && candidate.parentId === parentId) return true;
    if (candidate.classLevel === classLevel) return true;

    const hasIncomingStrongIdentity = Boolean(birthDate || parentPhone || parentId);
    const hasCandidateStrongIdentity = Boolean(candidate.birthDate || candidate.parentPhone || candidate.parentId);

    return (!hasIncomingStrongIdentity || !hasCandidateStrongIdentity) && candidate.classLevel === classLevel;
  }) ?? null;
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
    const userId = session ? (session.user as CustomUser).id : "anonymous";
    const username = session ? (session.user as CustomUser)?.username || "anonymous" : "anonymous";
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

      const deletedChildIds = new Set<string>();
      const remappedChildIds = new Set<string>();
      const canonicalChildIdByClientId = new Map<string, string>();
      const touchedChildIdentityKeys = new Set<string>();

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
            const createParentFirstName = childData.parentFirstName !== undefined ? normalizeName(String(childData.parentFirstName)) : "";
            const createParentLastName = childData.parentLastName !== undefined ? normalizeName(String(childData.parentLastName)) : normalizeName(String(childData.lastName ?? ""));
            const createAddress = childData.address !== undefined ? String(childData.address) : "";
            const createBirthDate = childData.birthDate !== undefined ? (typeof childData.birthDate === "string" ? childData.birthDate : null) : null;
            const createNotes = childData.notes !== undefined ? (typeof childData.notes === "string" ? childData.notes : null) : null;
            const createPhotoUrl = childData.photoUrl !== undefined ? (typeof childData.photoUrl === "string" ? childData.photoUrl : null) : null;

            if (childData.firstName !== undefined) childUpdateFields.firstName = createFirstName;
            if (childData.lastName !== undefined) childUpdateFields.lastName = createLastName;
            if (childData.postName !== undefined) childUpdateFields.postName = createPostName;
            if (childData.gender !== undefined) childUpdateFields.gender = createGender;
            if (childData.classLevel !== undefined) childUpdateFields.classLevel = createClassLevel;
            if (childData.parentFirstName !== undefined) childUpdateFields.parentFirstName = createParentFirstName;
            if (childData.parentLastName !== undefined) childUpdateFields.parentLastName = createParentLastName;
            if (childData.address !== undefined) childUpdateFields.address = createAddress;
            if (childData.birthDate !== undefined) childUpdateFields.birthDate = createBirthDate;
            if (childData.notes !== undefined) childUpdateFields.notes = createNotes;

            // 1. Gérer le Parent
            const parentPhone = String(childData.parentPhone ?? "");
            let parentId = childData.parentId ? String(childData.parentId) : null;

            if (parentPhone) {
              const parentFirstName = normalizeName(String(childData.parentFirstName ?? "Parent"));
              const parentLastName = normalizeName(String(childData.parentLastName ?? childData.lastName ?? "Parent"));
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
            } else if (parentId) {
              const parentExists = await tx.parent.findUnique({
                where: { id: parentId },
                select: { id: true }
              });
              if (!parentExists) {
                parentId = null;
              }
            }

            // 2. Gérer le Child
            if (parentPhone) {
              childUpdateFields.parentPhone = createParentPhone;
            }
            if (parentId) {
              childUpdateFields.parent = { connect: { id: parentId } };
            }

            const duplicateChild = existingChildIds.has(id)
              ? null
              : await findDuplicateChild(tx, {
                  id,
                  firstName: createFirstName,
                  lastName: createLastName,
                  postName: createPostName,
                  classLevel: createClassLevel,
                  parentPhone: createParentPhone,
                  parentId,
                  birthDate: createBirthDate,
                });
            const targetChildId = duplicateChild?.id ?? id;
            touchedChildIdentityKeys.add(getChildIdentityKey({
              firstName: createFirstName,
              lastName: createLastName,
              postName: createPostName,
              classLevel: createClassLevel,
            }));

            if (duplicateChild) {
              canonicalChildIdByClientId.set(id, duplicateChild.id);
              deletedChildIds.add(id);
              remappedChildIds.add(duplicateChild.id);
            }

            let createPhotoUrl = childData.photoUrl !== undefined ? (typeof childData.photoUrl === "string" ? childData.photoUrl : null) : null;
            
            // Si la photo est un Base64 envoyé par le téléphone hors-ligne
            if (createPhotoUrl && createPhotoUrl.startsWith('data:image/')) {
               const blobUrl = await uploadBase64ToVercelBlob(createPhotoUrl, targetChildId);
               if (blobUrl) {
                  createPhotoUrl = blobUrl;
               }
            }

            // Pour la création (nouveau child), on doit fournir toutes les valeurs obligatoires
              const childCreateFields = {
              id: targetChildId,
              firstName: createFirstName,
              lastName: createLastName,
              postName: createPostName,
              gender: createGender,
              classLevel: createClassLevel,
              parentPhone: createParentPhone,
              parentFirstName: createParentFirstName,
              parentLastName: createParentLastName,
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

        const duplicateMerge = await mergeDuplicateChildren(tx, touchedChildIdentityKeys);
        duplicateMerge.deletedIds.forEach((id) => deletedChildIds.add(id));
        duplicateMerge.canonicalIds.forEach((id) => remappedChildIds.add(id));
        duplicateMerge.canonicalIdByDuplicateId.forEach((canonicalId, duplicateId) => {
          canonicalChildIdByClientId.set(duplicateId, canonicalId);
        });

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
        d: Array.from(deletedChildIds),
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
    const legacyDeletedChildIds = new Set<string>();
    const legacyRemappedChildIds = new Set<string>();
    const legacyCanonicalChildIdByClientId = new Map<string, string>();
    const legacyTouchedChildIdentityKeys = new Set<string>();

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
            firstName: normalizeName(child.firstName),
            lastName: normalizeName(child.lastName),
            postName: normalizeName(child.postName ?? ""),
            gender: child.gender ?? "M",
            classLevel: child.classLevel ?? "FIRST",
            parentPhone: parentPhone,
            parentFirstName: normalizeName(child.parentFirstName ?? ""),
            parentLastName: normalizeName(child.parentLastName ?? ""),
            address: child.address,
            birthDate: child.birthDate,
            notes: child.notes,
            photoUrl: child.photoUrl,
            parentId: parentId,
          };
          const duplicateChild = existingChildIds.has(child.id)
            ? null
            : await findDuplicateChild(tx, {
                id: child.id,
                firstName: childFields.firstName,
                lastName: childFields.lastName,
                postName: childFields.postName,
                classLevel: childFields.classLevel,
                parentPhone: childFields.parentPhone,
                parentId,
                birthDate: childFields.birthDate,
              });
          const targetChildId = duplicateChild?.id ?? child.id;
          legacyTouchedChildIdentityKeys.add(getChildIdentityKey(childFields));

          if (duplicateChild) {
            legacyCanonicalChildIdByClientId.set(child.id, duplicateChild.id);
            legacyDeletedChildIds.add(child.id);
            legacyRemappedChildIds.add(duplicateChild.id);
          }

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

      const legacyDuplicateMerge = await mergeDuplicateChildren(tx, legacyTouchedChildIdentityKeys);
      legacyDuplicateMerge.deletedIds.forEach((id) => legacyDeletedChildIds.add(id));
      legacyDuplicateMerge.canonicalIds.forEach((id) => legacyRemappedChildIds.add(id));
      legacyDuplicateMerge.canonicalIdByDuplicateId.forEach((canonicalId, duplicateId) => {
        legacyCanonicalChildIdByClientId.set(duplicateId, canonicalId);
      });

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
