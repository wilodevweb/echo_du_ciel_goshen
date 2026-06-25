"use client";

import React, { FormEvent, useMemo, useState } from "react";
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
  markEntityForSync,
} from "@/lib/db";
import {
  AttendanceDateSelector,
  getMostRecentSundayDateString,
} from "@/components/attendance/AttendanceDateSelector";
import { ClassSelectionScreen } from "@/components/attendance/ClassSelectionScreen";
import { AttendanceSkeleton } from "@/components/pointage/AttendanceSkeleton";
import { ChildAttendanceCard } from "@/components/pointage/ChildAttendanceCard";
import { ChildDetailsModal } from "@/components/pointage/ChildDetailsModal";
import { AddChildCard } from "@/components/pointage/AddChildCard";
import {
  type ChildDetailsDraft,
  type NewChildForm,
  emptyNewChild,
} from "@/components/pointage/types";
import { isBirthdayInWeek, resizeImageFile } from "@/components/pointage/utils";

export default function PointagePage() {
  const [selectedDate, setSelectedDate] = useState(() => getMostRecentSundayDateString());
  const [selectedClasses, setSelectedClasses] = useState<ClassLevel[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [detailsChild, setDetailsChild] = useState<Child | null>(null);
  const [newChild, setNewChild] = useState<NewChildForm>(emptyNewChild);
  const [isAdding, setIsAdding] = useState(false);

  const children = useLiveQuery(() => db.children.toArray());
  const attendances = useLiveQuery(
    () => db.attendances.where("date").equals(selectedDate).toArray(),
    [selectedDate],
  );

  const sortedChildren = useMemo(() => {
    return [...(children ?? [])].sort((a, b) =>
      `${a.lastName} ${a.postName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.postName} ${b.firstName}`, "fr", {
        sensitivity: "base",
      }),
    );
  }, [children]);

  const filteredChildren = useMemo(() => {
    if (selectedClasses.length === 0) return [];
    return sortedChildren.filter((child) => selectedClasses.includes(child.classLevel));
  }, [selectedClasses, sortedChildren]);

  const filteredChildrenIds = useMemo(() => {
    return filteredChildren.map((c) => c.id);
  }, [filteredChildren]);

  const activeAttendances = useLiveQuery(
    async () => {
      if (filteredChildrenIds.length === 0) return [];
      return db.attendances.where("childId").anyOf(filteredChildrenIds).toArray();
    },
    [filteredChildrenIds],
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendances?.forEach((attendance) => {
      map.set(attendance.childId, attendance);
    });
    return map;
  }, [attendances]);

  const attendanceHistoryMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus[]>();
    const sortedAttendances = [...(activeAttendances ?? [])].sort((a, b) => b.date.localeCompare(a.date));

    sortedAttendances.forEach((attendance) => {
      const status = getAttendanceStatus(attendance);
      if (!status) return;

      const history = map.get(attendance.childId) ?? [];
      if (history.length >= 3) return;

      history.push(status);
      map.set(attendance.childId, history);
    });

    return map;
  }, [activeAttendances]);

  const totalCards = filteredChildren.length + 1;
  const visibleIndex = Math.min(currentIndex, totalCards - 1);
  const currentChild = filteredChildren[visibleIndex];
  const isAddCard = visibleIndex >= filteredChildren.length;
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
    const existingRecord = await db.attendances
      .where({ childId, date: selectedDate })
      .first();

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

  const updateChildPhoto = async (childId: string, file: File) => {
    const photoUrl = await resizeImageFile(file);
    await db.children.update(childId, { photoUrl });
    await markEntityForSync('child', childId, ['photoUrl']);
  };

  const saveChildDetails = async (childId: string, draft: ChildDetailsDraft) => {
    const existingChild = await db.children.get(childId);
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const postName = draft.postName.trim();

    if (!firstName || !lastName || !postName) return;

    const nextChild = {
      firstName,
      lastName,
      postName,
      classLevel: draft.classLevel,
      parentPhone: draft.parentPhone.trim(),
      address: draft.address.trim(),
      birthDate: draft.birthDate,
      notes: draft.notes.trim(),
    };
    const changedFields = (Object.keys(nextChild) as Array<keyof typeof nextChild>).filter((field) => {
      return existingChild?.[field] !== nextChild[field];
    });

    await db.children.update(childId, nextChild);
    if (changedFields.length > 0) {
      await markEntityForSync('child', childId, changedFields);
    }
    setDetailsChild(null);
  };

  const addChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdding(true);

    try {
      const childId = generateId();
      await db.children.add({
        id: childId,
        firstName: newChild.firstName.trim(),
        lastName: newChild.lastName.trim(),
        postName: newChild.postName.trim(),
        classLevel: newChild.classLevel,
        parentPhone: newChild.parentPhone.trim(),
        address: newChild.address.trim(),
        birthDate: newChild.birthDate,
        notes: newChild.notes.trim(),
        createdAt: new Date().toISOString(),
      });
      await markEntityForSync('child', childId);
      setNewChild(emptyNewChild);
      setCurrentIndex(filteredChildren.length);
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
  };

  const toggleAllClasses = () => {
    setSelectedClasses((classes) =>
      classes.length === CLASS_LEVELS.length ? [] : CLASS_LEVELS.map((level) => level.value),
    );
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
        onSelectAll={toggleAllClasses}
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
              <div key={isAddCard ? "add-child-card" : currentChild?.id} className="attendance-card-in w-full">
                {isAddCard ? (
                  <AddChildCard
                    value={newChild}
                    isAdding={isAdding}
                    onChange={setNewChild}
                    onSubmit={addChild}
                  />
                ) : currentChild ? (
                  <ChildAttendanceCard
                    child={currentChild}
                    status={getAttendanceStatus(attendanceMap.get(currentChild.id))}
                    recentStatuses={attendanceHistoryMap.get(currentChild.id) ?? []}
                    hasBirthdayThisWeek={isBirthdayInWeek(currentChild.birthDate, selectedDate)}
                    onNameClick={() => setDetailsChild(currentChild)}
                    onPhotoChange={(file) => updateChildPhoto(currentChild.id, file)}
                    onSetStatus={(status) => setAttendanceStatus(currentChild.id, status)}
                  />
                ) : (
                  <AddChildCard
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

