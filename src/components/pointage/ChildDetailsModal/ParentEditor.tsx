import React, { useState } from "react";
import { Search, Pencil, Plus, Trash2, User, Users } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { generateId, normalizeName } from "@/lib/db";
import type { ChildDetailsDraft } from "../types";
import type { ParentItem } from "./types";

export function ParentEditor({
  parents,
  draft,
  onChange,
  onCancel,
  onRequestConfirm,
}: {
  parents: ParentItem[];
  draft: ChildDetailsDraft;
  onChange: (value: ParentItem) => void;
  onCancel: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [mode, setMode] = useState<'search' | 'edit_list' | 'new' | 'edit_form'>('search');
  const [showSearch, setShowSearch] = useState(false);
  const [editingParentId, setEditingParentId] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const allChildren = useLiveQuery(() => db.children.toArray());
  const [manualLastName, setManualLastName] = useState(draft.parentLastName || "");
  const [manualPhone, setManualPhone] = useState(draft.parentPhone || "");

  const childCountByParent = React.useMemo(() => {
    const counts = new Map<string, number>();
    (allChildren ?? []).forEach((child) => {
      if (child.parentId) {
        counts.set(child.parentId, (counts.get(child.parentId) ?? 0) + 1);
      }
    });
    return counts;
  }, [allChildren]);

  const filteredParents = React.useMemo(() => {
    let result = parents;
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = parents.filter(p => {
        return (
          (p.firstName || "").toLowerCase().includes(query) ||
          (p.lastName || "").toLowerCase().includes(query) ||
          (p.phone || "").includes(query)
        );
      });
    }
    return result.slice(0, 30);
  }, [parents, debouncedSearchQuery]);

  return (
    <div className="mt-3 rounded-2xl bg-white/5 p-4 border border-white/10" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs font-bold text-white/60">
          {mode === 'new' ? "Nouveau Parent" : 
           mode === 'edit_form' ? "Modifier le parent" : 
           mode === 'edit_list' ? "Choisir à modifier" : "Sélectionner un parent"}
        </p>
        <div className="flex bg-white/10 rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              if (mode !== 'search') {
                setMode('search');
                setShowSearch(true);
              } else {
                setShowSearch(!showSearch);
              }
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              (mode === 'search' && showSearch) ? "bg-fiverr text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode === 'edit_list' || mode === 'edit_form') {
                setMode('search');
                setShowSearch(false);
              } else {
                setMode('edit_list');
                setShowSearch(true);
              }
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              mode === 'edit_list' || mode === 'edit_form' ? "bg-fiverr text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode === 'new') {
                setMode('search');
              } else {
                setMode('new');
                setShowSearch(false);
                setManualLastName("");
                setManualPhone("");
                setEditingParentId(undefined);
              }
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              mode === 'new' ? "bg-fiverr text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(mode === 'search' || mode === 'edit_list') ? (
        <>
          {showSearch && (
            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom ou téléphone..."
                className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-fiverr focus:ring-1 focus:ring-fiverr"
                autoFocus
              />
            </div>
          )}

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar">
            {filteredParents.length === 0 ? (
              <p className="text-xs text-white/45 text-center py-2">Aucun parent trouvé</p>
            ) : (
              <>
                {filteredParents.map((p, idx) => (
                  <button
                    key={p.id || p.phone || `${p.lastName}-${p.firstName}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (mode === 'edit_list') {
                        setMode('edit_form');
                        setShowSearch(false);
                        setEditingParentId(p.id);
                        setManualLastName(p.lastName);
                        setManualPhone(p.phone);
                      } else {
                        onChange(p);
                        onCancel();
                      }
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-all flex items-center justify-between border border-transparent hover:border-white/5"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-semibold text-white truncate flex items-center justify-between">
                        <span>{p.lastName} {p.firstName}</span>
                        {p.id && (
                          <span className="text-[10px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 ml-2">
                            <Users className="w-3 h-3" />
                            {childCountByParent.get(p.id) ?? 0} enfant(s)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/45 truncate">{p.phone}</p>
                    </div>
                  </button>
                ))}
                {filteredParents.length === 30 && (
                  <p className="text-[10px] text-center text-white/30 pt-1">
                    Affinez votre recherche pour voir plus de résultats...
                  </p>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2">
            <input
              type="text"
              value={manualLastName}
              onChange={(e) => setManualLastName(e.target.value)}
              placeholder="Nom complet du parent"
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-fiverr"
              autoFocus
            />
            <input
              type="tel"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="Téléphone du parent (Optionnel)"
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-fiverr"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!manualLastName.trim()}
              onClick={async () => {
                const pId = mode === 'edit_form' && editingParentId ? editingParentId : generateId();
                const savedParent = {
                  id: pId,
                  firstName: "",
                  lastName: normalizeName(manualLastName.trim()),
                  phone: manualPhone.trim(),
                  address: draft.address || "",
                  createdAt: new Date().toISOString(),
                };
                
                await db.parents.put(savedParent);

                if (mode === 'edit_form') {
                  // Ne l'assigner à l'enfant que si c'était déjà son parent
                  if (savedParent.id === draft.parentId) {
                    onChange(savedParent);
                  }
                } else {
                  // Mode 'new': on l'assigne à l'enfant car on vient de le créer
                  onChange(savedParent);
                }
                
                // Retourner à la liste de sélection au lieu de tout fermer
                setMode('edit_list');
                setShowSearch(true);
              }}
              className="flex-1 h-10 flex items-center justify-center rounded-xl bg-fiverr hover:bg-fiverr-dark disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-xs font-black text-white shadow-sm transition-all"
            >
              Enregistrer
            </button>
            
            {mode === 'edit_form' && editingParentId && (
              <button
                type="button"
                onClick={() => {
                  onRequestConfirm(
                    "Suppression",
                    "Êtes-vous sûr de vouloir supprimer définitivement ce parent de la base de données ?",
                    async () => {
                      await db.parents.delete(editingParentId);
                      if (draft.parentId === editingParentId) {
                        onChange({ id: undefined, firstName: "", lastName: "", phone: "", address: "" } as ParentItem);
                      }
                      setMode('edit_list');
                      setShowSearch(true);
                    }
                  );
                }}
                className="w-10 h-10 flex shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                title="Supprimer ce parent"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EditableParentRow({
  parents,
  draft,
  isEditing,
  onEdit,
  onChange,
  onCancel,
  onRequestConfirm,
}: {
  parents: ParentItem[];
  draft: ChildDetailsDraft;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: ParentItem) => void;
  onCancel: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
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
            onRequestConfirm={onRequestConfirm}
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
