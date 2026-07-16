"use client";

import React, { useState, useMemo } from "react";
import { Search, CheckCircle2 } from "lucide-react";
import { getClassLabel, type ClassLevel } from "@/lib/db";

export interface ChildRecord {
  id: string;
  firstName: string;
  lastName: string;
  postName?: string;
  classLevel: ClassLevel;
}

interface ChildSelectorProps {
  children: ChildRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Fond sombre (modale enfant) ou clair (page événements) */
  variant?: "dark" | "light";
  maxHeight?: string;
}

export function ChildSelector({
  children: allChildren,
  selectedIds,
  onChange,
  variant = "light",
  maxHeight = "max-h-48",
}: ChildSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allChildren;
    return allChildren.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        (c.postName ?? "").toLowerCase().includes(q) ||
        getClassLabel(c.classLevel).toLowerCase().includes(q)
    );
  }, [allChildren, search]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => onChange(allChildren.map((c) => c.id));
  const selectNone = () => onChange([]);

  // Styles conditionnels selon le contexte
  const isDark = variant === "dark";
  const containerCls = isDark
    ? "rounded-xl border border-white/10 bg-white/3 text-sm overflow-hidden"
    : "rounded-xl border border-gray-200 bg-white text-sm overflow-hidden shadow-sm";

  const headerCls = isDark
    ? "flex items-center justify-between px-3 py-1.5 border-b border-white/8 bg-white/5"
    : "flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50";

  const searchCls = isDark
    ? "flex items-center gap-2 px-3 py-1.5 border-b border-white/8"
    : "flex items-center gap-2 px-3 py-1.5 border-b border-gray-100";

  const searchInputCls = isDark
    ? "flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
    : "flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none";

  const searchIconCls = isDark ? "w-3.5 h-3.5 text-white/30 shrink-0" : "w-3.5 h-3.5 text-gray-400 shrink-0";

  const itemCls = isDark
    ? "flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
    : "flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors";

  const nameCls = isDark ? "flex-1 text-white/85 font-medium text-sm" : "flex-1 text-gray-800 font-medium text-sm";
  const classBadgeCls = isDark
    ? "text-[11px] text-white/40 bg-white/8 px-1.5 py-0.5 rounded"
    : "text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded";

  const countText = isDark ? "text-xs text-white/40" : "text-xs text-gray-500";
  const allBtnCls = isDark ? "text-[10px] font-bold text-[#00b22d] hover:underline" : "text-[10px] font-bold text-[#00b22d] hover:underline";
  const noneBtnCls = isDark ? "text-[10px] font-bold text-white/30 hover:text-white/60 hover:underline" : "text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:underline";
  const dividerCls = isDark ? "text-white/20" : "text-gray-300";
  const emptyText = isDark ? "text-xs text-white/35 italic" : "text-xs text-gray-400 italic";

  return (
    <div className={containerCls}>
      {/* En-tête Tout / Aucun */}
      <div className={headerCls}>
        <span className={countText}>
          {selectedIds.length > 0
            ? `${selectedIds.length} sélectionné${selectedIds.length > 1 ? "s" : ""}`
            : "Aucun sélectionné"}
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={selectAll} className={allBtnCls}>
            Tout
          </button>
          <span className={dividerCls}>·</span>
          <button type="button" onClick={selectNone} className={noneBtnCls}>
            Aucun
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className={searchCls}>
        <Search className={searchIconCls} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un enfant…"
          className={searchInputCls}
        />
      </div>

      {/* Liste */}
      <div className={`${maxHeight} overflow-y-auto divide-y ${isDark ? "divide-white/5" : "divide-gray-50"}`}>
        {filtered.length === 0 ? (
          <p className={`${emptyText} px-3 py-3 text-center`}>
            {search ? "Aucun résultat." : "Aucun enfant."}
          </p>
        ) : (
          filtered.map((child) => {
            const isChecked = selectedIds.includes(child.id);
            return (
              <label key={child.id} className={itemCls}>
                {/* Case à cocher custom */}
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all shrink-0 ${
                    isChecked
                      ? "bg-[#00b22d] border-[#00b22d] text-white"
                      : isDark
                      ? "bg-white/5 border-white/20"
                      : "bg-white border-gray-300"
                  }`}
                >
                  {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <span className={nameCls}>
                  {child.lastName} {child.firstName}
                  {child.postName ? ` ${child.postName}` : ""}
                </span>
                <span className={classBadgeCls}>{getClassLabel(child.classLevel)}</span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={() => toggle(child.id)}
                />
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
