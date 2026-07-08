import React, { useState } from "react";
import { Camera, Save, Pencil, Trash2, X, User, Smile, GraduationCap, Calendar, MapPin, NotebookText, Loader2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AttendanceStatus, Child, ChildSyncField } from "@/lib/db";
import db, { markEntityForSync, normalizeName } from "@/lib/db";
import type { ChildDetailsDraft } from "../types";
import { SiblingsList } from "../SiblingsList";
import { AttendanceHistoryList } from "../AttendanceHistoryList";

import type { ModalTab, ParentItem } from "./types";
import { ConfirmDialog, AlertDialog } from "./Dialogs";
import { EditableParentRow } from "./ParentEditor";
import { InlineTextEditor } from "./InlineTextEditor";
import { EditableClassRow, EditableGenderRow, EditableDetailRow } from "./EditableRows";
import { calculateAgeLabel, formatDisplayName, uploadChildPhoto } from "../utils";

export function ChildDetailsModal({
  child,
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
    photoUrl: child.photoUrl,
  }));
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>("infos");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  
  const [confirmConfig, setConfirmConfig] = useState<{ title: string, message: string, action: () => void } | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string, message: string } | null>(null);

  const localParents = useLiveQuery(async () => {
    // OPTIMISATION : Ne charger la lourde liste des parents/enfants
    // QUE si l'utilisateur est effectivement en train de modifier le champ parent.
    if (activeField !== "parent") return [];

    const parentList = await db.parents.toArray();
    const childrenList = await db.children.toArray();
    
    const parentMap = new Map<string, ParentItem>();
    
    parentList.forEach(p => {
      // On utilise l'ID réel du parent comme clé unique principale
      parentMap.set(p.id, {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        address: p.address,
      });
    });
    
    childrenList.forEach(c => {
      // Si l'enfant est lié à un parent via parentId, on vérifie s'il est déjà dans la map
      if (c.parentId) {
        if (!parentMap.has(c.parentId)) {
          parentMap.set(c.parentId, {
            id: c.parentId,
            firstName: c.parentFirstName || "",
            lastName: c.parentLastName || c.lastName || "",
            phone: c.parentPhone || "",
            address: c.address,
          });
        }
      } 
      // Sinon, s'il a des informations parentales "legacy" (sans ID), on déduplique par nom
      else if (c.parentLastName || c.parentFirstName) {
        const nameKey = `legacy-name:${(c.parentLastName || "").toLowerCase()}-${(c.parentFirstName || "").toLowerCase()}`;
        if (!parentMap.has(nameKey)) {
          parentMap.set(nameKey, {
            id: undefined, // Pas d'ID réel car c'est un parent legacy
            firstName: c.parentFirstName || "",
            lastName: c.parentLastName || c.lastName || "",
            phone: c.parentPhone || "",
            address: c.address,
          });
        }
      }
    });
    
    return Array.from(parentMap.values());
  }, [activeField]) || [];
  const isDeletion = draft.firstName.trim() === "" && draft.lastName.trim() === "" && draft.postName.trim() === "";
  const canSave = isDeletion || Boolean(draft.firstName.trim() && draft.lastName.trim());

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditMode) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setIsPhotoUploading(true);
    try {
      const photoUrl = await uploadChildPhoto(file);
      updateDraft("photoUrl", photoUrl);
    } catch (error) {
      console.error("Erreur lors du téléversement de la photo", error);
      setAlertConfig({
        title: "Photo non enregistrée",
        message: error instanceof Error ? error.message : "Le téléversement de la photo a échoué.",
      });
    } finally {
      setIsPhotoUploading(false);
      e.currentTarget.value = "";
    }
  };

  const updateDraft = (field: keyof ChildDetailsDraft, value: string) => {
    if (!isEditMode) return;

    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  };

  const handleSave = async () => {
    if (!isEditMode) {
      setIsEditMode(true);
      return;
    }

    if (!canSave || isSaving) return;

    if (draft.birthDate) {
      const today = new Date().toISOString().split('T')[0];
      if (draft.birthDate > today) {
        setAlertConfig({
          title: "Date Invalide",
          message: "La date de naissance ne peut pas être dans le futur."
        });
        return;
      }
    }

    if (isDeletion) {
      setConfirmConfig({
        title: "Suppression de l'enfant",
        message: "Êtes-vous sûr de vouloir supprimer définitivement cet enfant ?",
        action: async () => {
          setIsSaving(true);
          try {
            if (onSave) {
              await onSave(draft);
            } else {
              await db.children.delete(child.id);
              await markEntityForSync('child', child.id, ['firstName', 'lastName', 'postName']);
              onClose();
            }
          } finally {
            setIsSaving(false);
            setConfirmConfig(null);
          }
        }
      });
      return;
    }

    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(draft);
      } else {
        const nextChild = {
          firstName: normalizeName(draft.firstName.trim()),
          lastName: normalizeName(draft.lastName.trim()),
          postName: normalizeName(draft.postName.trim()),
          gender: draft.gender,
          classLevel: draft.classLevel,
          parentPhone: draft.parentPhone.trim(),
          parentFirstName: normalizeName(draft.parentFirstName.trim()),
          parentLastName: normalizeName(draft.parentLastName.trim()),
          address: draft.address.trim(),
          birthDate: draft.birthDate || undefined,
          notes: draft.notes.trim(),
          parentId: draft.parentId,
          photoUrl: draft.photoUrl,
          updatedAt: new Date().toISOString(),
        };
        await db.children.update(child.id, nextChild);
        const changedFields = (Object.keys(nextChild) as Array<keyof typeof nextChild>)
          .filter((field) => field !== 'updatedAt')
          .filter((field) => child[field] !== nextChild[field]) as ChildSyncField[];
        if (changedFields.length > 0) {
          await markEntityForSync('child', child.id, changedFields);
        }
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={confirmConfig !== null}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
        onConfirm={() => {
          if (confirmConfig) confirmConfig.action();
          setConfirmConfig(null);
        }}
        onCancel={() => setConfirmConfig(null)}
      />
      <AlertDialog
        isOpen={alertConfig !== null}
        title={alertConfig?.title || ""}
        message={alertConfig?.message || ""}
        onClose={() => setAlertConfig(null)}
      />

      <div className="fixed inset-0 z-50 flex items-end bg-black/45 px-0" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={onClose} />
      <div className="attendance-sheet-in relative h-[92vh] flex flex-col w-full rounded-t-[32px] bg-[#1b1b1b] px-6 pb-6 pt-3 text-white shadow-2xl">
        {/* Header - Fixed */}
        <div className="shrink-0">
          <div className="mx-auto mb-5 h-1.5 w-28 rounded-full bg-white/55" />
        <div className="relative mb-5">
          <div className="flex min-w-0 flex-col items-center text-center">
            {/* Avatar Photo */}
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#342ee8]/20 to-fiverr/30 overflow-hidden border-4 border-white/10 shadow-inner">
                {draft.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.photoUrl} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <Smile className="h-12 w-12 text-[#342ee8]/40" strokeWidth={1.5} />
                )}
              </div>
              {isEditMode && (
                <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-fiverr text-white shadow-lg hover:bg-fiverr-dark transition">
                  {isPhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isPhotoUploading} />
                </label>
              )}
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isEditMode) setActiveField("name");
              }}
              onKeyDown={(event) => {
                if (isEditMode && (event.key === "Enter" || event.key === " ")) setActiveField("name");
              }}
              className="mt-4 w-full min-w-0 text-center"
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
                    style={{ textTransform: "uppercase" }}
                    className="text-xl md:text-2xl font-black uppercase"
                  />
                  <InlineTextEditor
                    value={draft.postName}
                    onChange={(value) => updateDraft("postName", value)}
                    placeholder="Post-nom (Optionnel)"
                    style={{ textTransform: "uppercase" }}
                    className="text-xl md:text-2xl font-black uppercase"
                  />
                  <InlineTextEditor
                    value={draft.firstName}
                    onChange={(value) => updateDraft("firstName", value)}
                    placeholder="Prénom"
                    style={{ textTransform: "capitalize" }}
                    className="text-xl md:text-2xl font-light capitalize"
                  />
                </div>
              ) : (
                <div className="mt-2 flex flex-col items-center gap-0.5 text-xl md:text-2xl leading-tight tracking-tight text-white">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="font-black uppercase">{formatDisplayName(draft.lastName || "nom", "upper")}</span>
                    {draft.postName && <span className="font-black uppercase">{formatDisplayName(draft.postName, "upper")}</span>}
                  </div>
                  <span className="font-light capitalize">{formatDisplayName(draft.firstName || "prénom", "first")}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveTab("infos")}
            className={`flex h-10 shrink-0 items-center px-4 rounded-full text-sm font-semibold transition ${
              activeTab === "infos" ? "bg-white text-[#1b1b1b]" : "bg-white/10 text-white/65 hover:bg-white/15"
            }`}
          >
            Infos
          </button>
          <button
            onClick={() => setActiveTab("famille")}
            className={`flex h-10 shrink-0 items-center px-4 rounded-full text-sm font-semibold transition ${
              activeTab === "famille" ? "bg-white text-[#1b1b1b]" : "bg-white/10 text-white/65 hover:bg-white/15"
            }`}
          >
            Famille
          </button>
          <button
            onClick={() => setActiveTab("pointages")}
            className={`flex h-10 shrink-0 items-center px-4 rounded-full text-sm font-semibold transition ${
              activeTab === "pointages" ? "bg-white text-[#1b1b1b]" : "bg-white/10 text-white/65 hover:bg-white/15"
            }`}
          >
            Historique
          </button>
        </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-2 pb-20">
          {activeTab === "infos" && (
            <>
              <EditableClassRow
                icon={<GraduationCap className="h-6 w-6" />}
                title="Classe"
                value={draft.classLevel}
                isEditing={activeField === "classLevel"}
                onEdit={() => {
                  if (isEditMode) setActiveField("classLevel");
                }}
                onChange={(value) => updateDraft("classLevel", value)}
              />
              <EditableGenderRow
                icon={<User className="h-6 w-6" />}
                title="Sexe"
                value={draft.gender}
                isEditing={activeField === "gender"}
                onEdit={() => {
                  if (isEditMode) setActiveField("gender");
                }}
                onChange={(value) => updateDraft("gender", value)}
              />
              <EditableDetailRow
                icon={<Calendar className="h-6 w-6" />}
                title="Naissance"
                value={draft.birthDate}
                placeholder="Non renseignée"
                inputType="date"
                isEditing={activeField === "birthDate"}
                onEdit={() => {
                  if (isEditMode) setActiveField("birthDate");
                }}
                onChange={(value) => updateDraft("birthDate", value)}
              />
              <div className="flex w-full gap-4 text-left">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight text-white">Âge</p>
                  <p className="mt-1 text-base leading-snug text-white/55">
                    {calculateAgeLabel(draft.birthDate)}
                  </p>
                </div>
              </div>
              <EditableDetailRow
                icon={<MapPin className="h-6 w-6" />}
                title="Adresse"
                value={draft.address}
                placeholder="Non renseignée"
                isEditing={activeField === "address"}
                onEdit={() => {
                  if (isEditMode) setActiveField("address");
                }}
                onChange={(value) => updateDraft("address", value)}
              />
              <EditableDetailRow
                icon={<NotebookText className="h-6 w-6" />}
                title="Notes"
                value={draft.notes}
                placeholder="Aucune note"
                multiline
                isEditing={activeField === "notes"}
                onEdit={() => {
                  if (isEditMode) setActiveField("notes");
                }}
                onChange={(value) => updateDraft("notes", value)}
              />
            </>
          )}

          {activeTab === "famille" && (
            <div className="space-y-6">
              <div>
                <EditableParentRow
                  parents={localParents}
                  draft={draft}
                  isEditing={activeField === "parent"}
                  onEdit={() => {
                    if (isEditMode) setActiveField("parent");
                  }}
                  onChange={(selectedParent) => {
                    if (!isEditMode) return;

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
                  onRequestConfirm={(title, message, onConfirm) => {
                    setConfirmConfig({ title, message, action: onConfirm });
                  }}
                />
              </div>

              <div className="min-h-[150px] border-t border-white/10 pt-5">
                <p className="text-lg font-semibold leading-tight text-white mb-1">Frères et Sœurs</p>
                <p className="text-xs text-white/50 mb-3">Enfants partageant le même responsable.</p>
                <SiblingsList 
                  currentChildId={child.id}
                  parentId={draft.parentId} 
                />
              </div>
            </div>
          )}

          {activeTab === "pointages" && (
            <div className="min-h-[150px]">
              <p className="text-lg font-semibold leading-tight text-white mb-1">Historique des Présences</p>
              <p className="text-xs text-white/50 mb-3">Détail des pointages passés pour cet enfant.</p>
              <AttendanceHistoryList childId={child.id} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isEditMode ? !canSave || isSaving : false}
          title={!isEditMode ? "Modifier" : isDeletion ? "Supprimer" : "Enregistrer"}
          aria-label={!isEditMode ? "Modifier" : isDeletion ? "Supprimer" : "Enregistrer"}
          className={`absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all active:scale-90 disabled:opacity-45 ${
            isEditMode && isDeletion
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-fiverr text-white hover:bg-fiverr-dark"
          }`}
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : !isEditMode ? (
            <Pencil className="h-5 w-5" />
          ) : isDeletion ? (
            <Trash2 className="h-5 w-5" />
          ) : (
            <Save className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
    </>
  );
}
