"use client";

import React, { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Info,
  Phone,
  Save,
  User,
} from "lucide-react";
import db, {
  CLASS_FILTERS,
  CLASS_LEVELS,
  type Attendance,
  type AttendanceStatus,
  type Child,
  type ClassFilter,
  type ClassLevel,
  generateId,
  getAttendanceStatus,
  getClassLabel,
  getStatusLabel,
  markPendingChange,
} from "@/lib/db";
import { Card, CardContent } from "@/components/ui/Card";

type NewChildForm = {
  firstName: string;
  lastName: string;
  classLevel: ClassLevel;
  parentPhone: string;
  address: string;
  birthDate: string;
  notes: string;
};

const emptyNewChild: NewChildForm = {
  firstName: "",
  lastName: "",
  classLevel: "FIRST",
  parentPhone: "",
  address: "",
  birthDate: "",
  notes: "",
};

export default function PointagePage() {
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [classFilter, setClassFilter] = useState<ClassFilter>("ALL");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState({ firstName: "", lastName: "" });
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
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "fr", {
        sensitivity: "base",
      }),
    );
  }, [children]);

  const filteredChildren = useMemo(() => {
    if (classFilter === "ALL") return sortedChildren;
    return sortedChildren.filter((child) => child.classLevel === classFilter);
  }, [classFilter, sortedChildren]);

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

    if (existingRecord?.id) {
      await db.attendances.update(existingRecord.id, payload);
    } else {
      await db.attendances.add({
        id: generateId(),
        childId,
        date: selectedDate,
        ...payload,
      });
    }

    await markPendingChange();
  };

  const startNameEdit = (child: Child) => {
    setEditingChildId(child.id);
    setNameDraft({ firstName: child.firstName, lastName: child.lastName });
  };

  const saveNameEdit = async (childId: string) => {
    const firstName = nameDraft.firstName.trim();
    const lastName = nameDraft.lastName.trim();

    if (!firstName || !lastName) return;

    await db.children.update(childId, { firstName, lastName });
    await markPendingChange();
    setEditingChildId(null);
  };

  const addChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdding(true);

    try {
      await db.children.add({
        id: generateId(),
        firstName: newChild.firstName.trim(),
        lastName: newChild.lastName.trim(),
        classLevel: newChild.classLevel,
        parentPhone: newChild.parentPhone.trim(),
        address: newChild.address.trim(),
        birthDate: newChild.birthDate,
        notes: newChild.notes.trim(),
        createdAt: new Date().toISOString(),
      });
      await markPendingChange();
      setNewChild(emptyNewChild);
      setCurrentIndex(filteredChildren.length);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-center">
            <Link href="/" className="mr-4 rounded-lg p-2 text-gray-700 hover:bg-gray-100">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-950">Appel</h1>
              <p className="text-sm text-gray-500">{markedCount} appeles sur {filteredChildren.length}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                resetCarousel();
              }}
              className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />

            <div className="grid grid-cols-4 gap-2">
              {CLASS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setClassFilter(filter.value);
                    resetCarousel();
                  }}
                  className={`h-10 rounded-lg text-xs font-semibold transition-colors ${
                    classFilter === filter.value
                      ? "bg-[#00b22d] text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5">
        <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold text-gray-600">Presents</span>
          <span className="rounded-lg bg-[#00b22d]/10 px-3 py-1 font-bold text-[#00b22d]">
            {presentCount} / {filteredChildren.length}
          </span>
        </div>

        {children === undefined || attendances === undefined ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#00b22d]" />
          </div>
        ) : (
          <>
            <div className="flex flex-1 items-center">
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

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveCard(-1)}
                disabled={currentIndex === 0}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-gray-700 shadow-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold text-gray-500">
                {visibleIndex + 1} / {totalCards}
              </span>
              <button
                type="button"
                onClick={() => moveCard(1)}
                disabled={visibleIndex >= totalCards - 1}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-gray-700 shadow-sm disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
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
  nameDraft: { firstName: string; lastName: string };
  showDetails: boolean;
  onNameClick: () => void;
  onNameDraftChange: (value: { firstName: string; lastName: string }) => void;
  onSaveName: () => void;
  onToggleDetails: () => void;
  onSetStatus: (status: AttendanceStatus) => void;
}) {
  return (
    <Card padding="none" className="w-full rounded-lg border-gray-200 shadow-md">
      <CardContent className="p-5">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {child.photoUrl ? (
              <Image
                src={child.photoUrl}
                alt={`${child.firstName} ${child.lastName}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <User className="h-9 w-9 text-gray-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div className="grid gap-2">
                <input
                  value={nameDraft.firstName}
                  onChange={(event) =>
                    onNameDraftChange({ ...nameDraft, firstName: event.target.value })
                  }
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
                  placeholder="Ajouter un prenom"
                />
                <input
                  value={nameDraft.lastName}
                  onChange={(event) =>
                    onNameDraftChange({ ...nameDraft, lastName: event.target.value })
                  }
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
                  placeholder="Ajouter un nom"
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
              <button type="button" onClick={onNameClick} className="text-left">
                <h2 className="text-2xl font-bold leading-tight text-gray-950">
                  {child.firstName} {child.lastName}
                </h2>
              </button>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-lg bg-[#00b22d]/10 px-2 py-1 text-xs font-bold text-[#00b22d]">
                {getClassLabel(child.classLevel)}
              </span>
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                {getStatusLabel(status)}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-2 text-sm text-gray-600">
          <a href={`tel:${child.parentPhone}`} className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4 text-[#00b22d]" />
            {child.parentPhone || "Telephone parent"}
          </a>
          {child.notes && <p className="line-clamp-2">{child.notes}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatusButton
            label="Absent"
            colorClass="bg-red-500 text-white"
            active={status === "ABSENT"}
            onClick={() => onSetStatus("ABSENT")}
          />
          <StatusButton
            label="Present"
            colorClass="bg-[#00b22d] text-white"
            active={status === "PRESENT"}
            onClick={() => onSetStatus("PRESENT")}
          />
          <StatusButton
            label="Malade"
            colorClass="bg-yellow-400 text-gray-950"
            active={status === "SICK"}
            onClick={() => onSetStatus("SICK")}
          />
        </div>

        <button
          type="button"
          onClick={onToggleDetails}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700"
        >
          <Info className="h-4 w-4" />
          Details
        </button>

        {showDetails && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
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
      onClick={onClick}
      className={`h-12 rounded-lg text-sm font-bold shadow-sm transition-transform ${colorClass} ${
        active ? "scale-[1.03] ring-2 ring-offset-2 ring-gray-900/20" : "opacity-90"
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
              value={value.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              placeholder="Ajouter un prenom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
            <input
              required
              value={value.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              placeholder="Ajouter un nom"
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
