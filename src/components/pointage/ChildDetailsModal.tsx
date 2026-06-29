import React, { useState } from "react";
import {
  Calendar,
  GraduationCap,
  MapPin,
  NotebookText,
  Phone,
  X,
} from "lucide-react";
import type { AttendanceStatus, Child, ClassLevel } from "@/lib/db";
import db, { CLASS_LEVELS, getClassLabel, getClassNumber, markEntityForSync } from "@/lib/db";
import type { ChildDetailsDraft } from "./types";

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

export function ChildDetailsModal({
  child,
  status = null,
  onClose,
  onSave,
}: {
  child: Child;
  status?: AttendanceStatus | null;
  onClose: () => void;
  onSave?: (draft: ChildDetailsDraft) => Promise<void>;
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
  const isDeletion = draft.firstName.trim() === "" && draft.lastName.trim() === "" && draft.postName.trim() === "";
  const canSave = isDeletion || Boolean(draft.firstName.trim() && draft.lastName.trim() && draft.postName.trim());

  const updateDraft = (field: keyof ChildDetailsDraft, value: string) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    if (isDeletion) {
      const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cet enfant ?");
      if (!confirmDelete) return;
    }

    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(draft);
      } else {
        if (isDeletion) {
          await db.children.delete(child.id);
          await markEntityForSync('child', child.id);
        } else {
          const nextChild = {
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            postName: draft.postName.trim(),
            classLevel: draft.classLevel,
            parentPhone: draft.parentPhone.trim(),
            address: draft.address.trim(),
            birthDate: draft.birthDate || undefined,
            notes: draft.notes.trim(),
            updatedAt: new Date().toISOString(),
          };
          await db.children.update(child.id, nextChild);
          await markEntityForSync('child', child.id);
        }
        onClose();
      }
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
          className={`mt-7 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold disabled:opacity-45 transition-colors ${
            isDeletion
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-white text-[#1b1b1b] hover:bg-gray-100"
          }`}
        >
          {isSaving ? "Enregistrement..." : isDeletion ? "Supprimer l'enfant" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
