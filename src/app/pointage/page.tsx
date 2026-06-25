"use client";

import React, { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Calendar,
  Camera,
  CirclePlus,
  Crown,
  GraduationCap,
  MapPin,
  NotebookText,
  Phone,
  User,
  X,
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

type ChildDetailsDraft = NewChildForm;

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
  const maxSize = 720;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");

  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
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

function isBirthdayInWeek(birthDate: string | undefined, weekStartDate: string) {
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
    await markEntityForSync('child', childId);
  };

  const saveChildDetails = async (childId: string, draft: ChildDetailsDraft) => {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const postName = draft.postName.trim();

    if (!firstName || !lastName || !postName) return;

    await db.children.update(childId, {
      firstName,
      lastName,
      postName,
      classLevel: draft.classLevel,
      parentPhone: draft.parentPhone.trim(),
      address: draft.address.trim(),
      birthDate: draft.birthDate,
      notes: draft.notes.trim(),
    });
    await markEntityForSync('child', childId);
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
              {visibleIndex + 1} / {totalCards} · Balaye pour revenir
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
  hasBirthdayThisWeek,
  onNameClick,
  onPhotoChange,
  onSetStatus,
}: {
  child: Child;
  status: AttendanceStatus | null;
  hasBirthdayThisWeek: boolean;
  onNameClick: () => void;
  onPhotoChange: (file: File) => Promise<void>;
  onSetStatus: (status: AttendanceStatus) => void;
}) {
  const statusLabel =
    status === "ABSENT" ? "Absent" : status === "PRESENT" ? "Présent" : status === "SICK" ? "Malade" : "Non marqué";

  return (
    <Card padding="none" className="w-full overflow-hidden rounded-[28px] border-0 bg-[#1b1b1b] shadow-2xl">
      <CardContent className="relative px-5 pb-5 pt-3 text-white">
        <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-white/45" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">
            {getClassLabel(child.classLevel)}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
            <span className={`h-2.5 w-2.5 rounded-full ${status === "ABSENT" ? "bg-red-500" : "bg-red-500/35"}`} />
            <span className={`h-2.5 w-2.5 rounded-full ${status === "PRESENT" ? "bg-green-500" : "bg-green-500/35"}`} />
            <span className={`h-2.5 w-2.5 rounded-full ${status === "SICK" ? "bg-yellow-400" : "bg-yellow-400/35"}`} />
            <span className="text-xs font-semibold text-white/60">{statusLabel}</span>
          </div>
        </div>

        <div className="mb-4 flex justify-center">
          <label className="relative flex h-44 w-44 cursor-pointer items-center justify-center rounded-full bg-[#d7efe8]/90">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onPhotoChange(file);
                event.currentTarget.value = "";
              }}
            />
            {hasBirthdayThisWeek && (
              <div className="absolute -top-7 left-1/2 z-10 flex -translate-x-1/2 rotate-[-8deg] items-center justify-center rounded-full bg-yellow-300 p-2 text-[#1b1b1b] shadow-lg ring-4 ring-[#1b1b1b]">
                <Crown className="h-8 w-8 fill-yellow-300" />
              </div>
            )}
            <div className="h-36 w-36 overflow-hidden rounded-full bg-white/35">
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
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-14 w-14 text-[#1b1b1b]/45" />
                </div>
              )}
            </div>
            <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#342ee8] text-2xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
              {getClassNumber(child.classLevel)}
            </div>
            <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#1b1b1b] text-white ring-4 ring-[#d7efe8]">
              <Camera className="h-5 w-5" />
            </div>
          </label>
        </div>

        <div className="mb-5 text-center">
          <button
            type="button"
            onClick={onNameClick}
            className="mx-auto block w-full max-w-full rounded-[22px] bg-white px-4 py-3 text-center shadow-sm"
          >
            <h2 className="grid gap-0.5 text-[1.35rem] leading-[1.02] tracking-tight text-[#111827]">
              <span className="block font-black uppercase">{child.lastName}</span>
              <span className="block font-black uppercase">{child.postName}</span>
              <span className="block font-normal uppercase">{child.firstName}</span>
            </h2>
            <p className="mt-2 text-xs font-semibold text-gray-400">
              Toucher le nom pour ouvrir la fiche
            </p>
          </button>
        </div>

        <div className="sr-only">
          <a href={`tel:${child.parentPhone}`} className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4 text-[#00b22d]" />
            {child.parentPhone || "Telephone parent"}
          </a>
          {child.notes && <p className="line-clamp-2">{child.notes}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-white/7 p-2">
          <StatusButton
            label="Malade"
            colorClass="bg-yellow-400 text-[#1b1b1b]"
            active={status === "SICK"}
            onClick={() => onSetStatus("SICK")}
          />
          <StatusButton
            label="Absent"
            colorClass="bg-red-500 text-white"
            active={status === "ABSENT"}
            onClick={() => onSetStatus("ABSENT")}
          />
          <StatusButton
            label="Présent"
            colorClass="bg-green-500 text-white col-span-2"
            active={status === "PRESENT"}
            onClick={() => onSetStatus("PRESENT")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ChildDetailsModal({
  child,
  status,
  onClose,
  onSave,
}: {
  child: Child;
  status: AttendanceStatus | null;
  onClose: () => void;
  onSave: (draft: ChildDetailsDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ChildDetailsDraft>(() => ({
    firstName: child.firstName,
    lastName: child.lastName,
    postName: child.postName,
    classLevel: child.classLevel,
    parentPhone: child.parentPhone,
    address: child.address,
    birthDate: child.birthDate ?? "",
    notes: child.notes ?? "",
  }));
  const [activeField, setActiveField] = useState<keyof ChildDetailsDraft | "name" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canSave = Boolean(draft.firstName.trim() && draft.lastName.trim() && draft.postName.trim());

  const updateDraft = (field: keyof ChildDetailsDraft, value: string) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 px-0" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={onClose} />
      <div className="attendance-sheet-in relative max-h-[88vh] w-full overflow-y-auto rounded-t-[32px] bg-[#1b1b1b] px-6 pb-8 pt-3 text-white shadow-2xl">
        <div className="mx-auto mb-5 h-1.5 w-28 rounded-full bg-white/55" />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveField("name")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setActiveField("name");
            }}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Fiche enfant
            </p>
            {activeField === "name" ? (
              <div className="mt-2 grid gap-1">
                <InlineTextEditor
                  value={draft.lastName}
                  onChange={(value) => updateDraft("lastName", value)}
                  placeholder="Nom"
                  autoFocus
                  className="text-2xl font-semibold"
                />
                <InlineTextEditor
                  value={draft.postName}
                  onChange={(value) => updateDraft("postName", value)}
                  placeholder="Post-nom"
                  className="text-2xl font-semibold"
                />
                <InlineTextEditor
                  value={draft.firstName}
                  onChange={(value) => updateDraft("firstName", value)}
                  placeholder="Prénom"
                  className="text-2xl font-semibold"
                />
              </div>
            ) : (
              <h2 className="mt-2 text-2xl font-semibold leading-tight">
                {draft.lastName || "Nom"} {draft.postName || "Post-nom"} {draft.firstName || "Prénom"}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
          <DetailPill colorClass="bg-red-500" active={status === "ABSENT"} label="Absent" />
          <DetailPill colorClass="bg-green-500" active={status === "PRESENT"} label="Présent" />
          <DetailPill colorClass="bg-yellow-400" active={status === "SICK"} label="Malade" />
        </div>

        <div className="space-y-5">
          <EditableClassRow
            icon={<GraduationCap className="h-6 w-6" />}
            title="Classe"
            value={draft.classLevel}
            isEditing={activeField === "classLevel"}
            onEdit={() => setActiveField("classLevel")}
            onChange={(value) => updateDraft("classLevel", value)}
          />
          <EditableDetailRow
            icon={<Calendar className="h-6 w-6" />}
            title="Naissance"
            value={draft.birthDate}
            placeholder="Non renseignée"
            inputType="date"
            isEditing={activeField === "birthDate"}
            onEdit={() => setActiveField("birthDate")}
            onChange={(value) => updateDraft("birthDate", value)}
          />
          <EditableDetailRow
            icon={<Phone className="h-6 w-6" />}
            title="Téléphone parent"
            value={draft.parentPhone}
            placeholder="Non renseigné"
            inputType="tel"
            isEditing={activeField === "parentPhone"}
            onEdit={() => setActiveField("parentPhone")}
            onChange={(value) => updateDraft("parentPhone", value)}
          />
          <EditableDetailRow
            icon={<MapPin className="h-6 w-6" />}
            title="Adresse"
            value={draft.address}
            placeholder="Non renseignée"
            isEditing={activeField === "address"}
            onEdit={() => setActiveField("address")}
            onChange={(value) => updateDraft("address", value)}
          />
          <EditableDetailRow
            icon={<NotebookText className="h-6 w-6" />}
            title="Notes"
            value={draft.notes}
            placeholder="Aucune note"
            multiline
            isEditing={activeField === "notes"}
            onEdit={() => setActiveField("notes")}
            onChange={(value) => updateDraft("notes", value)}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-bold text-[#1b1b1b] disabled:opacity-45"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function InlineTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`w-full border-0 bg-transparent p-0 leading-tight text-white placeholder:text-white/30 outline-none ${className}`}
    />
  );
}

function DetailPill({
  label,
  colorClass,
  active,
}: {
  label: string;
  colorClass: string;
  active: boolean;
}) {
  return (
    <div className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
      active ? "bg-white text-[#1b1b1b]" : "bg-white/8 text-white/65"
    }`}>
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      {label}
    </div>
  );
}

function EditableDetailRow({
  icon,
  title,
  value,
  placeholder,
  isEditing,
  onEdit,
  onChange,
  inputType = "text",
  multiline = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  placeholder: string;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: string) => void;
  inputType?: "text" | "tel" | "date";
  multiline?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
      className="flex w-full gap-4 text-left"
    >
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-white">{title}</p>
        {isEditing ? (
          multiline ? (
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              autoFocus
              rows={2}
              className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-base leading-snug text-white placeholder:text-white/30 outline-none"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <input
              type={inputType}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              autoFocus
              className="mt-1 w-full border-0 bg-transparent p-0 text-base leading-snug text-white placeholder:text-white/30 outline-none"
              onClick={(event) => event.stopPropagation()}
            />
          )
        ) : (
          <p className="mt-1 line-clamp-2 text-base leading-snug text-white/55">
            {value || placeholder}
          </p>
        )}
      </div>
    </div>
  );
}

function EditableClassRow({
  icon,
  title,
  value,
  isEditing,
  onEdit,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: ClassLevel;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: ClassLevel) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
      className="flex w-full gap-4 text-left"
    >
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight text-white">{title}</p>
        {isEditing ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CLASS_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(level.value);
                }}
                className={`h-9 rounded-full px-2 text-sm font-semibold ${
                  value === level.value ? "bg-white text-[#1b1b1b]" : "bg-white/8 text-white/65"
                }`}
              >
                {getClassNumber(level.value)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-base leading-snug text-white/55">{getClassLabel(value)}</p>
        )}
      </div>
    </div>
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
      className={`h-12 rounded-2xl px-3 text-sm font-black shadow-sm transition-all ${colorClass} ${
        active ? "scale-[1.02] opacity-100 ring-2 ring-white/80" : "opacity-55"
      }`}
    >
      {label}
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
