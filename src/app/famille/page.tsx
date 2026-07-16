"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Users, Phone, ChevronRight, Search, UserCircle2, Baby } from "lucide-react";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import db, { getClassLabel } from "@/lib/db";

// ─── Type unifié pour une "famille" (parent réel ou parent legacy) ────────────
interface FamilyItem {
  id: string;           // id du parent dans db.parents, ou id synthétique pour legacy
  name: string;
  phone?: string;
  isLegacy: boolean;    // true = pas encore dans db.parents
  children: {
    id: string;
    firstName: string;
    lastName: string;
    postName?: string;
    classLevel: string;
  }[];
}

export default function FamillePage() {
  const [search, setSearch] = useState("");

  const parents = useLiveQuery(() => db.parents.orderBy("name").toArray(), []);
  const children = useLiveQuery(() => db.children.toArray(), []);

  // ─── Construction de la liste unifiée ─────────────────────────────────────
  const families = React.useMemo((): FamilyItem[] => {
    if (!parents || !children) return [];

    const map = new Map<string, FamilyItem>();

    // 1. Parents réels (dans db.parents)
    for (const p of parents) {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        phone: p.phone || undefined,
        isLegacy: false,
        children: [],
      });
    }

    // 2. Rattacher les enfants — et créer les familles legacy si nécessaire
    for (const child of children) {
      const childItem = {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        postName: child.postName,
        classLevel: child.classLevel,
      };

      if (child.parentId && map.has(child.parentId)) {
        // Enfant lié à un parent réel
        map.get(child.parentId)!.children.push(childItem);
      } else if (child.parentId && !map.has(child.parentId)) {
        // parentId pointe vers un parent qui n'est pas encore dans db.parents
        // (cas de migration) → créer une entrée legacy avec cet id
        map.set(child.parentId, {
          id: child.parentId,
          name: child.parentName || child.lastName || "Parent inconnu",
          phone: child.parentPhone || undefined,
          isLegacy: true,
          children: [childItem],
        });
      } else if (!child.parentId && child.parentName) {
        // Enfant legacy (parentName sur l'enfant, pas de parentId)
        const nameKey = `legacy:${child.parentName.toLowerCase().trim()}`;
        if (!map.has(nameKey)) {
          map.set(nameKey, {
            id: nameKey,
            name: child.parentName,
            phone: child.parentPhone || undefined,
            isLegacy: true,
            children: [],
          });
        }
        // Mettre à jour le numéro si on en trouve un
        const fam = map.get(nameKey)!;
        if (!fam.phone && child.parentPhone) fam.phone = child.parentPhone;
        fam.children.push(childItem);
      }
      // Enfant sans aucune info parent → ignoré
    }

    return Array.from(map.values())
      .filter((f) => f.children.length > 0 || !f.isLegacy)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [parents, children]);

  // ─── Filtrage recherche ────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return families;
    return families.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.phone || "").includes(q) ||
        f.children.some(
          (c) =>
            `${c.lastName} ${c.firstName}`.toLowerCase().includes(q)
        )
    );
  }, [families, search]);

  const isLoading = parents === undefined || children === undefined;

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <MobileHeader title="Familles" rightElement={<Users className="w-6 h-6 ml-2" />} />

      <div className="p-4 max-w-md mx-auto w-full space-y-4">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une famille…"
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00b22d]/30 focus:border-[#00b22d]"
          />
        </div>

        {isLoading ? (
          <LoadingState message="Chargement des familles…" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <UserCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 font-medium">
              {search ? "Aucune famille trouvée." : "Aucune famille enregistrée."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium px-1">
              {filtered.length} famille{filtered.length > 1 ? "s" : ""}
            </p>
            {filtered.map((family) => (
              <div
                key={family.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* En-tête parent */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00b22d]/10 text-[#00b22d]">
                    <UserCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{family.name}</p>
                    {family.phone ? (
                      <a
                        href={`tel:${family.phone}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#00b22d] transition-colors mt-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        {family.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 italic mt-0.5">Pas de téléphone</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    {family.children.length} enfant{family.children.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Liste enfants */}
                {family.children.length > 0 && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {family.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Baby className="w-4 h-4 shrink-0 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {child.lastName} {child.postName} {child.firstName}
                          </p>
                          <p className="text-xs text-gray-400">{getClassLabel(child.classLevel)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
