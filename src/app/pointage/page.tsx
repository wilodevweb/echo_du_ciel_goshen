"use client";

import React, { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  CirclePlus,
  Info,
  Phone,
  Save,
  User,
} from "lucide-react";
import db, {
  CLASS_LEVELS,
  type Attendance,
  type AttendanceStatus,
  type Child,
  type ClassLevel,
  generateId,
  getAttendanceStatus,
  getClassLabel,
  getClassNumber,
  getStatusLabel,
  markEntityForSync,
} from "@/lib/db";
import {
  AttendanceDateSelector,
  getMostRecentSundayDateString,
} from "@/components/attendance/AttendanceDateSelector";
import { ClassSelectionScreen } from "@/components/attendance/ClassSelectionScreen";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type NewChildForm = {
  firstName: string;
  lastName: string;
  postName: string;
  classLevel: ClassLevel;
  parentPhone: string;
  address: string;
  birthDate: string;
  notes: string;
};

const emptyNewChild: NewChildForm = {
  firstName: "",
  lastName: "",
  postName: "",
  classLevel: "FIRST",
  parentPhone: "",
  address: "",
  birthDate: "",
  notes: "",
};

export default function PointagePage() {
  const [selectedDate, setSelectedDate] = useState(() => getMostRecentSundayDateString());
  const [selectedClasses, setSelectedClasses] = useState<ClassLevel[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState({ firstName: "", lastName: "", postName: "" });
  const [detailsChildId, setDetailsChildId] = useState<string | null>(null);
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

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendances?.forEach((attendance) => {
      map.set(attendance.childId, attendance);
    });
    return map;
  }, [attendances]);

  const totalCards = filteredChildren.length + 1;
  const visibleIndex = Math.min(currentIndex, totalCards - 1);
  const currentChild = filteredChildren[visibleIndex];
  const isAddCard = visibleIndex >= filteredChildren.length;
  const markedCount = filteredChildren.filter((child) =>
    getAttendanceStatus(attendanceMap.get(child.id)),
  ).length;
  const presentCount = filteredChildren.filter(
    (child) => getAttendanceStatus(attendanceMap.get(child.id)) === "PRESENT",
  ).length;
  const selectedClassLabel = selectedClasses.length === CLASS_LEVELS.length
    ? "Toutes les classes"
    : selectedClasses.map(getClassLabel).join(" + ");

  const resetCarousel = () => {
    setCurrentIndex(0);
    setEditingChildId(null);
    setDetailsChildId(null);
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

  const startNameEdit = (child: Child) => {
    setEditingChildId(child.id);
    setNameDraft({ firstName: child.firstName, lastName: child.lastName, postName: child.postName });
  };

  const saveNameEdit = async (childId: string) => {
    const firstName = nameDraft.firstName.trim();
    const lastName = nameDraft.lastName.trim();
    const postName = nameDraft.postName.trim();

    if (!firstName || !lastName || !postName) return;

    await db.children.update(childId, { firstName, lastName, postName });
    await markEntityForSync('child', childId);
    setEditingChildId(null);
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
              {selectedClassLabel} · {markedCount}/{filteredChildren.length}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col py-5">
        <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold text-gray-600">Presents</span>
          <span className="rounded-lg bg-[#00b22d]/10 px-3 py-1 font-bold text-[#00b22d]">
            {presentCount} / {filteredChildren.length}
          </span>
        </div>

        {children === undefined || attendances === undefined ? (
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
                    isEditingName={editingChildId === currentChild.id}
                    nameDraft={nameDraft}
                    showDetails={detailsChildId === currentChild.id}
                    onNameClick={() => startNameEdit(currentChild)}
                    onNameDraftChange={setNameDraft}
                    onSaveName={() => saveNameEdit(currentChild.id)}
                    onToggleDetails={() =>
                      setDetailsChildId((id) => (id === currentChild.id ? null : currentChild.id))
                    }
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
              {visibleIndex + 1} / {totalCards} · Balaye pour revenir
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="flex flex-1 items-center">
      <Card padding="none" className="w-full rounded-lg border-gray-200 shadow-md">
        <CardContent className="p-5">
          <div className="mb-5 flex items-start gap-4">
            <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-7 w-44" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </div>
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="mb-5 h-4 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
          <Skeleton className="mt-4 h-11 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ChildAttendanceCard({
  child,
  status,
  isEditingName,
  nameDraft,
  showDetails,
  onNameClick,
  onNameDraftChange,
  onSaveName,
  onToggleDetails,
  onSetStatus,
}: {
  child: Child;
  status: AttendanceStatus | null;
  isEditingName: boolean;
  nameDraft: { firstName: string; lastName: string; postName: string };
  showDetails: boolean;
  onNameClick: () => void;
  onNameDraftChange: (value: { firstName: string; lastName: string; postName: string }) => void;
  onSaveName: () => void;
  onToggleDetails: () => void;
  onSetStatus: (status: AttendanceStatus) => void;
}) {
  return (
    <Card padding="none" className="w-full rounded-lg border-gray-100 bg-white shadow-md">
      <CardContent className="relative px-6 py-7">
        <div className="absolute right-5 top-5 flex gap-2">
          <span className={`h-3 w-3 rounded-full ${status === "ABSENT" ? "bg-red-600" : "bg-red-300"}`} />
          <span className={`h-3 w-3 rounded-full ${status === "PRESENT" ? "bg-green-600" : "bg-green-300"}`} />
          <span className={`h-3 w-3 rounded-full ${status === "SICK" ? "bg-yellow-500" : "bg-yellow-200"}`} />
        </div>

        <div className="mb-7 flex justify-center">
          <div className="relative h-36 w-36">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#d7efe8]">
            {child.photoUrl ? (
              <Image
                src={child.photoUrl}
                alt={`${child.lastName} ${child.postName} ${child.firstName}`}
                width={144}
                height={144}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <User className="h-14 w-14 text-gray-400" />
            )}
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#342ee8] text-2xl font-black text-white shadow-sm">
              {getClassNumber(child.classLevel)}
            </div>
          </div>
        </div>

        <div className="mb-9 text-center">
            {isEditingName ? (
              <div className="grid gap-2">
                <input
                  value={nameDraft.lastName}
                  onChange={(event) =>
                    onNameDraftChange({ ...nameDraft, lastName: event.target.value })
                  }
                  className="h-10 rounded-lg border border-gray-300 px-3 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
                  placeholder="Ajouter un nom"
                />
                <input
                  value={nameDraft.postName}
                  onChange={(event) =>
                    onNameDraftChange({ ...nameDraft, postName: event.target.value })
                  }
                  className="h-10 rounded-lg border border-gray-300 px-3 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
                  placeholder="Ajouter un post-nom"
                />
                <input
                  value={nameDraft.firstName}
                  onChange={(event) =>
                    onNameDraftChange({ ...nameDraft, firstName: event.target.value })
                  }
                  className="h-10 rounded-lg border border-gray-300 px-3 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
                  placeholder="Ajouter un prenom"
                />
                <button
                  type="button"
                  onClick={onSaveName}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#00b22d] px-3 text-sm font-semibold text-white"
                >
                  <Save className="h-4 w-4" />
                  Enregistrer
                </button>
              </div>
            ) : (
              <button type="button" onClick={onNameClick} className="text-center">
                <h2 className="text-2xl leading-tight tracking-tight text-black">
                  <span className="font-black uppercase">{child.lastName}</span>{" "}
                  <span className="font-black uppercase">{child.postName}</span>{" "}
                  <span className="font-normal uppercase">{child.firstName}</span>
                </h2>
              </button>
            )}
        </div>

        <div className="sr-only">
          <a href={`tel:${child.parentPhone}`} className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4 text-[#00b22d]" />
            {child.parentPhone || "Telephone parent"}
          </a>
          {child.notes && <p className="line-clamp-2">{child.notes}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatusButton
            label="Marquer absent"
            colorClass="border-red-200 bg-red-50 text-red-700"
            active={status === "ABSENT"}
            onClick={() => onSetStatus("ABSENT")}
          />
          <StatusButton
            label="Marquer present"
            colorClass="border-green-200 bg-green-50 text-green-700"
            active={status === "PRESENT"}
            onClick={() => onSetStatus("PRESENT")}
          />
          <StatusButton
            label="Marquer malade"
            colorClass="border-yellow-200 bg-yellow-50 text-yellow-700 col-span-2"
            active={status === "SICK"}
            onClick={() => onSetStatus("SICK")}
          />
        </div>

        <button
          type="button"
          onClick={onToggleDetails}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700"
        >
          <Info className="h-4 w-4" />
          Details
        </button>

        {showDetails && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p><span className="font-semibold text-gray-900">Classe:</span> {getClassLabel(child.classLevel)}</p>
            <p><span className="font-semibold text-gray-900">Statut:</span> {getStatusLabel(status)}</p>
            <p><span className="font-semibold text-gray-900">Adresse:</span> {child.address || "Non renseignee"}</p>
            <p><span className="font-semibold text-gray-900">Naissance:</span> {child.birthDate || "Non renseignee"}</p>
            <p><span className="font-semibold text-gray-900">Notes:</span> {child.notes || "Aucune note"}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusButton({
  label,
  colorClass,
  active,
  onClick,
}: {
  label: string;
  colorClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`h-11 rounded-lg border text-sm font-semibold shadow-sm transition-transform ${colorClass} ${
        active ? "scale-[1.02] ring-2 ring-offset-2 ring-gray-900/15" : "opacity-95"
      }`}
    >
      <span className="sr-only">{label}</span>
    </button>
  );
}

function AddChildCard({
  value,
  isAdding,
  onChange,
  onSubmit,
}: {
  value: NewChildForm;
  isAdding: boolean;
  onChange: (value: NewChildForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (field: keyof NewChildForm, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <Card padding="none" className="w-full rounded-lg border-dashed border-gray-300 shadow-md">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#00b22d]/10 text-[#00b22d]">
            <CirclePlus className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-950">Ajouter un enfant</h2>
            <p className="text-sm text-gray-500">Carte rapide hors ligne</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={value.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              placeholder="Ajouter un nom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
            <input
              required
              value={value.postName}
              onChange={(event) => update("postName", event.target.value)}
              placeholder="Ajouter un post-nom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
            <input
              required
              value={value.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              placeholder="Ajouter un prenom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
          </div>

          <select
            required
            value={value.classLevel}
            onChange={(event) => update("classLevel", event.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          >
            {CLASS_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>

          <input
            required
            value={value.parentPhone}
            onChange={(event) => update("parentPhone", event.target.value)}
            placeholder="Telephone parent"
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <input
            required
            value={value.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="Adresse"
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <input
            type="date"
            value={value.birthDate}
            onChange={(event) => update("birthDate", event.target.value)}
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <textarea
            value={value.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Details, allergies, notes"
            rows={3}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />

          <button
            type="submit"
            disabled={isAdding}
            className="h-12 rounded-lg bg-[#00b22d] text-sm font-bold text-white disabled:opacity-60"
          >
            {isAdding ? "Ajout..." : "+ Ajouter"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
