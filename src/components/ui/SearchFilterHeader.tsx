"use client";

import React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface FilterOption {
  label: string;
  value: string;
}

interface SearchFilterHeaderProps {
  placeholder?: string;
  filters: FilterOption[];
  
  // Si serverMode est true, le composant utilise les paramètres de l'URL (?q=...&type=...)
  // Sinon, il utilise les callbacks fournis (pour l'annuaire hors-ligne)
  serverMode?: boolean;
  
  // Props pour le mode Client (Annuaire)
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  activeFilter?: string;
  onFilterChange?: (val: string) => void;
  
  // Props pour le mode Server (Ressources)
  searchParamName?: string;
  filterParamName?: string;
}

export function SearchFilterHeader({
  placeholder = "Rechercher...",
  filters,
  serverMode = false,
  searchQuery = "",
  onSearchChange,
  activeFilter = "all",
  onFilterChange,
  searchParamName = "q",
  filterParamName = "type",
}: SearchFilterHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Valeurs effectives
  const currentSearch = serverMode ? (searchParams.get(searchParamName) || "") : searchQuery;
  const currentFilter = serverMode ? (searchParams.get(filterParamName) || "all") : activeFilter;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (serverMode) {
      // En mode serveur, on utilise un formulaire standard pour la recherche,
      // l'input est donc non contrôlé ou géré par le submit.
      // Mais si on veut une mise à jour en direct (déconseillé en serveur), on pourrait le faire ici.
    } else {
      onSearchChange?.(val);
    }
  };

  return (
    <>
      <div className="bg-fiverr px-4 pb-4 sticky top-[60px] z-10 shadow-md">
        {/* Barre de recherche */}
        {serverMode ? (
          <form method="GET" action={pathname} className="relative">
            <input type="hidden" name={filterParamName} value={currentFilter} />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name={searchParamName}
              defaultValue={currentSearch}
              className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white sm:text-sm"
              placeholder={placeholder}
            />
          </form>
        ) : (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={currentSearch}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white sm:text-sm"
              placeholder={placeholder}
            />
          </div>
        )}
      </div>

      {/* Filtres rapides (sous le header, sur fond clair comme dans Ressources) */}
      {filters.length > 0 && (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((filter) => {
            const isActive = currentFilter === filter.value;
            const baseClasses = "whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-full transition cursor-pointer";
            const activeClasses = isActive 
              ? "bg-gray-950 text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300";

            if (serverMode) {
              return (
                <Link
                  key={filter.value}
                  href={`${pathname}?${filterParamName}=${filter.value}${currentSearch ? `&${searchParamName}=${currentSearch}` : ""}`}
                  className={`${baseClasses} ${activeClasses}`}
                >
                  {filter.label}
                </Link>
              );
            }

            return (
              <button
                key={filter.value}
                onClick={() => onFilterChange?.(filter.value)}
                className={`${baseClasses} ${activeClasses}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
