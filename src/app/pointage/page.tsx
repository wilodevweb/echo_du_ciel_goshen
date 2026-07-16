"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import db, {
  CLASS_LEVELS,
  type Attendance,
  type AttendanceStatus,
  type Child,
  type ClassLevel,
  generateId,
  getAttendanceStatus,
  getClassLabel,
  isDeletedChildRecord,
  markEntityForSync,
  normalizeName,
  type ChildSyncField,
} from "@/lib/db";
import {
  AttendanceDateSelector,
  getMostRecentSundayDateString,
} from "@/components/pointage/AttendanceDateSelector";
import { ClassSelectionScreen } from "@/components/pointage/ClassSelectionScreen";
import { AttendanceSkeleton } from "@/components/pointage/AttendanceSkeleton";
import { PointageCard } from "@/components/pointage/PointageCard";
import { ChildDetailsModal } from "@/components/children/ChildDetailsModal";
import {
  type ChildDetailsDraft,
  type NewChildForm,
  emptyNewChild,
} from "@/components/pointage/types";
import { isBirthdayInWeek } from "@/components/pointage/utils";

const STORAGE_KEY = "attendance-selected-classes";

function isValidClassLevel(value: unknown): value is ClassLevel {
  return typeof value === "string" && CLASS_LEVELS.some((level) => level.value === value);
}

export default function PointagePage() {
  const [selectedDate, setSelectedDate] = useState(() => getMostRecentSundayDateString());
  const [selectedClasses, setSelectedClasses] = useState<ClassLevel[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [detailsChild, setDetailsChild] = useState<Child | null>(null);
  const [newChild, setNewChild] = useState<NewChildForm>(emptyNewChild);
  const [isAdding, setIsAdding] = useState(false);
  const hasLoadedStoredClasses = useRef(false);

  const children = useLiveQuery(() => db.children.toArray());
  const attendances = useLiveQuery(
    () => db.attendances.where("date").equals(selectedDate).toArray(),
    [selectedDate],
  );

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);
      if (Array.isArray(parsedValue) && parsedValue.every(isValidClassLevel)) {
        queueMicrotask(() => {
          hasLoadedStoredClasses.current = true;
          setSelectedClasses(parsedValue);
        });
        return;
      }
    } catch {
      // Ignore invalid stored values and keep the default selection.
    }

    hasLoadedStoredClasses.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedStoredClasses.current) return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedClasses));
  }, [selectedClasses]);

  const sortedChildren = useMemo(() => {
    if (!children) return [];
    const mapped = children
      .filter((c) => !isDeletedChildRecord(c) && !c.notes?.includes('[ARCHIVE]'))
      .map((c) => ({
        child: c,
        sortKey: `${c.lastName} ${c.postName} ${c.firstName}`,
      }));
    mapped.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "fr", { sensitivity: "base" }));
    return mapped.map((item) => item.child);
  }, [children]);

  const filteredChildren = useMemo(() => {
    if (selectedClasses.length === 0) return [];
    return sortedChildren.filter((child) => selectedClasses.includes(child.classLevel));
  }, [selectedClasses, sortedChildren]);

  const totalCards = filteredChildren.length + 1;
  const visibleIndex = Math.max(0, Math.min(currentIndex, Math.max(totalCards - 1, 0)));
  const currentChild = filteredChildren[visibleIndex];
  const currentChildId = currentChild?.id;

  const activeAttendances = useLiveQuery(
    async () => {
      if (!currentChildId) return [];
      return db.attendances
        .where("[childId+date]")
        .between([currentChildId, ""], [currentChildId, "\uffff"])
        .reverse()
        .limit(4)
        .toArray();
    },
    [currentChildId],
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendances?.forEach((attendance) => {
      map.set(attendance.childId, attendance);
    });
    return map;
  }, [attendances]);

  const recentStatuses = useMemo(() => {
    return (activeAttendances ?? [])
      .map((att) => getAttendanceStatus(att))
      .filter((status): status is AttendanceStatus => Boolean(status));
  }, [activeAttendances]);

  const selectedClassLabel = selectedClasses.length === CLASS_LEVELS.length
    ? "Toutes les classes"
    : selectedClasses.map(getClassLabel).join(" + ");

  const resetCarousel = () => {
    setCurrentIndex(0);
    setDetailsChild(null);
  };

  const moveCard = (direction: -1 | 1) => {
    setCurrentIndex((index) => Math.min(Math.max(index + direction, 0), totalCards - 1));
  };

  const setAttendanceStatus = async (childId: string, status: AttendanceStatus) => {
    const maxSunday = getMostRecentSundayDateString(new Date());
    if (selectedDate > maxSunday) {
      alert("Le pointage pour le dimanche prochain (" + selectedDate + ") ou une date future est refusé car il n'est pas encore ouvert.");
      return;
    }

    const existingRecord = await db.attendances
      .where({ childId, date: selectedDate })
      .first();

    if (existingRecord && existingRecord.status === status) {
      // Évite de déclencher une synchronisation inutile si le statut n'a pas changé
      moveCard(1);
      return;
    }

    const payload = {
      present: status === "PRESENT",
      status,
      markedAt: new Date().toISOString(),
    };

    let attendanceId = existingRecord?.id;

    if (attendanceId) {
      await db.attendances.update(attendanceId, payload);
    } else {
      attendanceId = generateId();
      await db.attendances.add({
        id: attendanceId,
        childId,
        date: selectedDate,
        ...payload,
      });
    }

    await markEntityForSync('attendance', attendanceId);
    moveCard(1);
  };

  const saveChildDetails = async (childId: string, draft: ChildDetailsDraft) => {
    const existingChild = await db.children.get(childId);
    const firstName = normalizeName(draft.firstName.trim());
    const lastName = normalizeName(draft.lastName.trim());
    const postName = normalizeName(draft.postName.trim());

    const isDeletion = firstName === "" && lastName === "" && postName === "";

    if (isDeletion) {
      // Nettoyer pendingSync pour les présences supprimées
      const attendancesToDelete = await db.attendances.where("childId").equals(childId).toArray();
      const attendanceKeysToDelete = attendancesToDelete.map(a => `attendance:${a.id}`);
      if (attendanceKeysToDelete.length > 0) {
        await db.pendingSync.bulkDelete(attendanceKeysToDelete);
      }
      await db.attendances.where("childId").equals(childId).delete();

      // Nettoyer pendingSync pour les tâches supprimées
      const tasksToDelete = await db.tasks.where("childId").equals(childId).toArray();
      const taskKeysToDelete = tasksToDelete.map(t => `task:${t.id}`);
      if (taskKeysToDelete.length > 0) {
        await db.pendingSync.bulkDelete(taskKeysToDelete);
      }
      await db.tasks.where("childId").equals(childId).delete();
      await db.children.update(childId, {
        firstName: "",
        lastName: "",
        postName: "",
      });
      await markEntityForSync('child', childId);
      setDetailsChild(null);
      return;
    }

    if (!firstName || !lastName) return;

    if (draft.birthDate) {
      const today = new Date().toISOString().split('T')[0];
      if (draft.birthDate > today) {
        alert("La date de naissance ne peut pas être dans le futur.");
        return;
      }
    }

    const nextChild = {
      firstName,
      lastName,
      postName,
      gender: draft.gender,
      classLevel: draft.classLevel,
      parentPhone: draft.parentPhone.trim(),
      parentName: normalizeName(draft.parentName.trim()),
      address: draft.address.trim(),
      birthDate: draft.birthDate || undefined,
      notes: draft.notes.trim(),
      photoUrl: draft.photoUrl,
    };
    const changedFields = (Object.keys(nextChild) as Array<keyof typeof nextChild>).filter((field) => {
      return existingChild?.[field] !== nextChild[field];
    });

    if (changedFields.length === 0) {
      setDetailsChild(null);
      return;
    }

    await db.children.update(childId, nextChild);
    await markEntityForSync('child', childId, changedFields as ChildSyncField[]);
    setDetailsChild(null);
  };

  const addChild = async () => {
    if (isAdding) return;

    if (!newChild.firstName.trim() || !newChild.lastName.trim()) {
      alert("Le prénom et le nom sont obligatoires.");
      return;
    }

    if (newChild.birthDate) {
      const today = new Date().toISOString().split('T')[0];
      if (newChild.birthDate > today) {
        alert("La date de naissance ne peut pas être dans le futur.");
        return;
      }
    }

    setIsAdding(true);

    try {
      const childId = generateId();
      await db.children.add({
        id: childId,
        firstName: normalizeName(newChild.firstName.trim()),
        lastName: normalizeName(newChild.lastName.trim()),
        postName: normalizeName(newChild.postName.trim()),
        gender: newChild.gender,
        classLevel: newChild.classLevel,
        parentPhone: newChild.parentPhone.trim(),
        parentName: normalizeName(newChild.parentName.trim()),
        address: newChild.address.trim(),
        birthDate: newChild.birthDate || undefined,
        notes: newChild.notes.trim(),
        photoUrl: newChild.photoUrl,
        createdAt: new Date().toISOString(),
      });
      await markEntityForSync('child', childId, [
        'firstName',
        'lastName',
        'postName',
        'gender',
        'classLevel',
        'parentPhone',
        'parentName',
        'address',
        'birthDate',
        'notes',
        'photoUrl',
        'parentId',
      ]);

      // Enregistrer le statut de pointage pour ce jour (Présent par défaut)
      const payload = {
        present: true,
        status: "PRESENT" as AttendanceStatus,
        markedAt: new Date().toISOString(),
      };
      const attendanceId = generateId();
      await db.attendances.add({
        id: attendanceId,
        childId,
        date: selectedDate,
        ...payload,
      });
      await markEntityForSync('attendance', attendanceId);

      setNewChild(emptyNewChild);
      setCurrentIndex(filteredChildren.length);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleClass = (classLevel: ClassLevel) => {
    setSelectedClasses((classes) => {
      if (classes.includes(classLevel)) {
        return classes.filter((value) => value !== classLevel);
      }

      return [...classes, classLevel];
    });
    setCurrentIndex(0);
  };

  const startAttendance = () => {
    const firstClass = selectedClasses[0] ?? "FIRST";
    setNewChild((child) => ({ ...child, classLevel: firstClass }));
    setHasStarted(true);
    resetCarousel();
  };

  const handleTouchEnd = (positionX: number) => {
    if (touchStartX === null) return;

    const deltaX = positionX - touchStartX;
    setTouchStartX(null);

    if (Math.abs(deltaX) < 48) return;
    moveCard(deltaX > 0 ? -1 : 1);
  };

  if (!hasStarted) {
    return (
      <ClassSelectionScreen
        selectedDate={selectedDate}
        childList={children}
        selectedClasses={selectedClasses}
        onDateChange={(value) => {
          setSelectedDate(value);
          resetCarousel();
        }}
        onToggleClass={toggleClass}
        onStart={startAttendance}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 px-4 py-5">
      <header className="mx-auto w-full max-w-md">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              setHasStarted(false);
              resetCarousel();
            }}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1 pr-10 text-center">
            <AttendanceDateSelector
              value={selectedDate}
              onChange={(value) => {
                setSelectedDate(value);
                resetCarousel();
              }}
            />
            <p className="text-sm font-semibold text-gray-500">
              {selectedClassLabel}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col py-5">
        {children === undefined || attendances === undefined || activeAttendances === undefined ? (
          <AttendanceSkeleton />
        ) : (
          <>
            <div
              className="flex flex-1 items-center touch-pan-y"
              onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              <div key={currentChild ? currentChild.id : "add-child-card"} className="attendance-card-in w-full">
                {currentChild ? (
                  <PointageCard
                    mode="attendance"
                    child={currentChild}
                    status={getAttendanceStatus(attendanceMap.get(currentChild.id))}
                    recentStatuses={recentStatuses}
                    hasBirthdayThisWeek={isBirthdayInWeek(currentChild.birthDate, selectedDate)}
                    onNameClick={() => setDetailsChild(currentChild)}
                    onSetStatus={(status) => setAttendanceStatus(currentChild.id, status)}
                  />
                ) : (
                  <PointageCard
                    mode="add"
                    value={newChild}
                    isAdding={isAdding}
                    onChange={setNewChild}
                    onSubmit={addChild}
                  />
                )}
              </div>
            </div>

            <p className="mt-4 text-center text-sm font-semibold text-gray-400">
              {visibleIndex + 1} / {totalCards}
            </p>
          </>
        )}
      </section>

      {detailsChild && (
        <ChildDetailsModal
          child={detailsChild}
          status={getAttendanceStatus(attendanceMap.get(detailsChild.id))}
          onClose={() => setDetailsChild(null)}
          onSave={(draft) => saveChildDetails(detailsChild.id, draft)}
        />
      )}
    </main>
  );
}
