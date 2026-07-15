"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Users, Phone, ChevronRight, Search, UserCircle2, Baby } from "lucide-react";
import Link from "next/link";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import db, { getClassLabel } from "@/lib/db";

export default function FamillePage() {
  const [search, setSearch] = useState("");

  const parents = useLiveQuery(() => db.parents.orderBy("name").toArray(), []);
  const children = useLiveQuery(() => db.children.toArray(), []);

  const childrenByParentId = React.useMemo(() => {
    const map = new Map<string, typeof children>();
    if (!children) return map;
    for (const child of children) {
      if (!child.parentId) continue;
      const list = map.get(child.parentId) ?? [];
      list.push(child);
      map.set(child.parentId, list);
    }
    return map;
  }, [children]);

  const filtered = React.useMemo(() => {
    if (!parents) return [];
    const q = search.toLowerCase().trim();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone || "").includes(q)
    );
  }, [parents, search]);

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
            {filtered.map((parent) => {
              const kids = childrenByParentId.get(parent.id) ?? [];
              return (
                <div
                  key={parent.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* En-tête parent */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00b22d]/10 text-[#00b22d]">
                      <UserCircle2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{parent.name}</p>
                      {parent.phone && (
                        <a
                          href={`tel:${parent.phone}`}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#00b22d] transition-colors mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          {parent.phone}
                        </a>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      {kids.length} enfant{kids.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Liste enfants */}
                  {kids.length > 0 && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {kids.map((child) => (
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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
