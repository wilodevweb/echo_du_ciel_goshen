import React, { useState } from "react";
import {
  Calendar,
  GraduationCap,
  MapPin,
  NotebookText,
  X,
  User,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AttendanceStatus, Child, ClassLevel } from "@/lib/db";
import db, { CLASS_LEVELS, getClassLabel, getClassNumber, markEntityForSync } from "@/lib/db";
import type { ChildDetailsDraft } from "./types";

interface ParentItem {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
}

function ParentEditor({
  parents,
  draft,
  onChange,
  onCancel,
}: {
  parents: ParentItem[];
  draft: ChildDetailsDraft;
  onChange: (value: ParentItem) => void;
  onCancel: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  
  const [manualFirstName, setManualFirstName] = useState(draft.parentFirstName || "");
  const [manualLastName, setManualLastName] = useState(draft.parentLastName || "");
  const [manualPhone, setManualPhone] = useState(draft.parentPhone || "");

  const filteredParents = parents.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      (p.firstName || "").toLowerCase().includes(query) ||
      (p.lastName || "").toLowerCase().includes(query) ||
      (p.phone || "").includes(query)
    );
  });

  return (
    <div className="mt-3 rounded-2xl bg-white/5 p-4 border border-white/10" onClick={(e) => e.stopPropagation()}>
      {!isManualMode ? (
        <>
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou téléphone..."
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#00b22d] focus:ring-1 focus:ring-[#00b22d]"
              autoFocus
            />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar mb-3">
            {filteredParents.length === 0 ? (
              <p className="text-xs text-white/45 text-center py-2">Aucun parent trouvé</p>
            ) : (
              filteredParents.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    onCancel();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all flex items-center justify-between border border-transparent hover:border-white/5"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {p.lastName} {p.firstName}
                    </p>
                    <p className="text-xs text-white/45 truncate">{p.phone}</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#00b22d] bg-[#00b22d]/10 px-2 py-0.5 rounded-full border border-[#00b22d]/20 shrink-0">
                    Choisir
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsManualMode(true);
            }}
            className="w-full h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-xs font-black text-white shadow-sm transition-all"
          >
            + Nouveau parent (Saisir un nom)
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-white/60">Nouveau Parent</p>
            <button
              type="button"
              onClick={() => setIsManualMode(false)}
              className="text-xs text-white/45 hover:text-white/80 underline"
            >
              Retour à la liste
            </button>
          </div>

          <div className="grid gap-2">
            <input
              type="text"
              value={manualLastName}
              onChange={(e) => setManualLastName(e.target.value)}
              placeholder="Nom du parent"
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#00b22d]"
            />
            <input
              type="text"
              value={manualFirstName}
              onChange={(e) => setManualFirstName(e.target.value)}
              placeholder="Prénom du parent"
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#00b22d]"
            />
            <input
              type="tel"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="Téléphone du parent"
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#00b22d]"
            />
          </div>

          <button
            type="button"
            disabled={!manualLastName.trim() || !manualPhone.trim()}
            onClick={() => {
              onChange({
                firstName: manualFirstName.trim(),
                lastName: manualLastName.trim(),
                phone: manualPhone.trim(),
              });
              onCancel();
            }}
            className="w-full h-10 flex items-center justify-center rounded-xl bg-[#00b22d] hover:bg-[#008f24] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-xs font-black text-white shadow-sm transition-all"
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

function EditableParentRow({
  parents,
  draft,
  isEditing,
  onEdit,
  onChange,
  onCancel,
}: {
  parents: ParentItem[];
  draft: ChildDetailsDraft;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: ParentItem) => void;
  onCancel: () => void;
}) {
  const parentName = (draft.parentFirstName || draft.parentLastName)
    ? `${draft.parentFirstName} ${draft.parentLastName}`.trim()
    : "";

  return (
    <div className="flex w-full gap-4 text-left">
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        <User className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold leading-tight text-white">Parent</p>
          {isEditing && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-white/45 hover:text-white/80 underline"
            >
              Annuler
            </button>
          )}
        </div>

        {isEditing ? (
          <ParentEditor
            parents={parents}
            draft={draft}
            onChange={onChange}
            onCancel={onCancel}
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={onEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onEdit();
            }}
            className="mt-1 block text-left cursor-pointer"
          >
            {parentName ? (
              <>
                <p className="text-base font-semibold leading-snug text-white/85">
                  {parentName}
                </p>
                <p className="text-sm font-medium leading-snug text-white/55">
                  {draft.parentPhone || "Pas de téléphone"}
                </p>
              </>
            ) : (
              <p className="text-base leading-snug text-white/55">Non renseigné</p>
            )}
          </div>
        )}
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

function EditableGenderRow({
  icon,
  title,
  value,
  isEditing,
  onEdit,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: 'M' | 'F';
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: 'M' | 'F') => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
      className="flex items-start gap-4 text-left"
    >
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight text-white">{title}</p>
        {isEditing ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange('M');
              }}
              className={`h-9 rounded-full px-2 text-sm font-semibold ${
                value === 'M' ? "bg-white text-[#1b1b1b]" : "bg-white/8 text-white/65"
              }`}
            >
              Garçon (M)
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange('F');
              }}
              className={`h-9 rounded-full px-2 text-sm font-semibold ${
                value === 'F' ? "bg-white text-[#1b1b1b]" : "bg-white/8 text-white/65"
              }`}
            >
              Fille (F)
            </button>
          </div>
        ) : (
          <p className="mt-1 text-base leading-snug text-white/55">
            {value === 'M' ? 'Garçon (M)' : 'Fille (F)'}
          </p>
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
    gender: child.gender ?? "M",
    classLevel: child.classLevel,
    parentPhone: child.parentPhone,
    parentFirstName: child.parentFirstName ?? "",
    parentLastName: child.parentLastName ?? "",
    address: child.address,
    birthDate: child.birthDate ?? "",
    notes: child.notes ?? "",
    parentId: child.parentId,
  }));
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const localParents = useLiveQuery(async () => {
    const parentList = await db.parents.toArray();
    const childrenList = await db.children.toArray();
    
    const parentMap = new Map<string, ParentItem>();
    
    parentList.forEach(p => {
      parentMap.set(p.phone, {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        address: p.address,
      });
    });
    
    childrenList.forEach(c => {
      if (c.parentPhone && !parentMap.has(c.parentPhone)) {
        parentMap.set(c.parentPhone, {
          id: c.parentId,
          firstName: c.parentFirstName || "",
          lastName: c.parentLastName || c.lastName || "",
          phone: c.parentPhone,
          address: c.address,
        });
      }
    });
    
    return Array.from(parentMap.values());
  }) || [];
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

    if (draft.birthDate) {
      const today = new Date().toISOString().split('T')[0];
      if (draft.birthDate > today) {
        alert("La date de naissance ne peut pas être dans le futur.");
        return;
      }
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
            gender: draft.gender,
            classLevel: draft.classLevel,
            parentPhone: draft.parentPhone.trim(),
            parentFirstName: draft.parentFirstName.trim(),
            parentLastName: draft.parentLastName.trim(),
            address: draft.address.trim(),
            birthDate: draft.birthDate || undefined,
            notes: draft.notes.trim(),
            parentId: draft.parentId,
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
          <EditableGenderRow
            icon={<User className="h-6 w-6" />}
            title="Sexe"
            value={draft.gender}
            isEditing={activeField === "gender"}
            onEdit={() => setActiveField("gender")}
            onChange={(value) => updateDraft("gender", value)}
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
          <EditableParentRow
            parents={localParents}
            draft={draft}
            isEditing={activeField === "parent"}
            onEdit={() => setActiveField("parent")}
            onChange={(selectedParent) => {
              setDraft(current => ({
                ...current,
                parentId: selectedParent.id || undefined,
                parentPhone: selectedParent.phone,
                parentFirstName: selectedParent.firstName,
                parentLastName: selectedParent.lastName,
                address: selectedParent.address || current.address,
              }));
            }}
            onCancel={() => setActiveField(null)}
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
