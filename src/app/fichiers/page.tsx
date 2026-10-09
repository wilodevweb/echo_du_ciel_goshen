"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, ImageOff, Play, Plus, Search } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { type MediaResource } from "@/lib/db";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchFilterHeader } from "@/components/ui/SearchFilterHeader";
import { ActionGroup } from "@/components/ui/ActionGroup";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseResources(payload: unknown): MediaResource[] {
  if (!isRecord(payload) || !Array.isArray(payload.resources)) return [];
  return payload.resources.flatMap((value): MediaResource[] => {
    if (!isRecord(value)) return [];
    const { id, type, title, url, thumbnail, aspectRatio, createdAt } = value;
    if (typeof id !== "string" || typeof title !== "string" || typeof url !== "string" || typeof createdAt !== "string") return [];
    return [{
      id,
      title,
      type: type === "video" || type === "pdf" ? type : "image",
      url,
      thumbnail: typeof thumbnail === "string" ? thumbnail : undefined,
      aspectRatio: typeof aspectRatio === "string" ? aspectRatio : "square",
      createdAt,
    }];
  });
}

function isCacheableUrl(value?: string) {
  return Boolean(value && (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/")));
}

function getAspectRatioClass(ratio: string) {
  if (ratio === "tall") return "aspect-[3/4]";
  if (ratio === "wide") return "aspect-[4/3]";
  return "aspect-square";
}

export default function FichiersPage() {
  const cachedResources = useLiveQuery(() => db.mediaResources.orderBy("createdAt").reverse().toArray(), [], []);
  const [onlineResources, setOnlineResources] = useState<MediaResource[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshResources = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/mobile/resources", { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("Ressources indisponibles");
      const resources = parseResources(await response.json());
      const metadata = resources.map((resource) => ({
        ...resource,
        // Les data-URI de fichiers ne sont jamais dupliquées dans IndexedDB.
        url: isCacheableUrl(resource.url) ? resource.url : "",
        thumbnail: isCacheableUrl(resource.thumbnail) ? resource.thumbnail : undefined,
      }));
      await db.transaction("rw", db.mediaResources, async () => {
        await db.mediaResources.clear();
        if (metadata.length > 0) await db.mediaResources.bulkPut(metadata);
      });
      setOnlineResources(resources);
    } catch {
      // La liste Dexie reste utilisable si l'API ou la base distante est indisponible.
      setOnlineResources(null);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshResources();
    window.addEventListener("online", refreshResources);
    return () => window.removeEventListener("online", refreshResources);
  }, [refreshResources]);

  const resources = useMemo(() => {
    const byId = new Map((cachedResources ?? []).map((resource) => [resource.id, resource]));
    for (const resource of onlineResources ?? []) byId.set(resource.id, resource);
    return [...byId.values()]
      .filter((resource) => activeFilter === "all" || resource.type === activeFilter)
      .filter((resource) => resource.title.toLocaleLowerCase("fr").includes(searchQuery.trim().toLocaleLowerCase("fr")))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activeFilter, cachedResources, onlineResources, searchQuery]);

  const rightAction = (
    <ActionGroup buttons={[
      { id: "search", icon: Search, isActive: false, onClick: () => document.querySelector<HTMLInputElement>("#resource-search-container input")?.focus() },
      { id: "new", icon: Plus, href: "/fichiers/nouveau" },
    ]} />
  );

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <MobileHeader title="Ressources" rightElement={rightAction} />
      <Suspense fallback={<div className="h-24 bg-fiverr" />}>
        <div id="resource-search-container">
        <SearchFilterHeader
          serverMode={false}
          placeholder="Rechercher des fichiers, leçons..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filters={[
            { label: "Tous", value: "all" },
            { label: "Images", value: "image" },
            { label: "Vidéos", value: "video" },
            { label: "Documents", value: "pdf" },
          ]}
        />
        </div>
      </Suspense>
      <div className="px-4 pb-2 text-xs text-gray-500" aria-live="polite">
        {isRefreshing ? "Mise à jour des ressources…" : onlineResources === null ? "Liste locale · les fichiers distants s’ouvrent avec internet" : "Liste actualisée"}
      </div>
      <div className="mt-2 px-4">
        {resources.length === 0 ? (
          <EmptyState title="Aucun fichier trouvé" description={cachedResources?.length ? "Essayez une autre recherche ou un autre filtre." : "Les ressources apparaîtront ici après leur premier chargement en ligne."} />
        ) : (
          <div className="columns-2 gap-4 space-y-4">
            {resources.map((file) => {
              const mediaUrl = file.url || "";
              const thumbnailUrl = file.thumbnail || (onlineResources?.find((resource) => resource.id === file.id)?.url ?? "");
              return (
                <article key={file.id} className="break-inside-avoid relative">
                  {file.type === "image" && (
                    <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-sm ${getAspectRatioClass(file.aspectRatio)}`}>
                      {thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnailUrl} alt={file.title} className="h-full w-full object-cover" />
                      ) : <ImageOff className="h-8 w-8 text-gray-500" aria-label="Aperçu disponible en ligne" />}
                      {mediaUrl && <a href={mediaUrl} download className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-gray-800" aria-label={`Télécharger ${file.title}`}><Download className="h-4 w-4" /></a>}
                    </div>
                  )}
                  {file.type === "video" && (
                    <a href={mediaUrl || undefined} className={`relative flex items-center justify-center overflow-hidden rounded-2xl ${file.thumbnail || "bg-indigo-500"} ${getAspectRatioClass(file.aspectRatio)}`} aria-label={mediaUrl ? `Ouvrir ${file.title}` : `${file.title}, disponible en ligne`}>
                      <Play className="z-10 h-10 w-10 rounded-full bg-white/90 p-2 text-gray-900" />
                    </a>
                  )}
                  {file.type === "pdf" && (
                    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${getAspectRatioClass(file.aspectRatio)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600"><FileText className="h-5 w-5" /></div>
                        {mediaUrl && <a href={mediaUrl} download className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600" aria-label={`Télécharger ${file.title}`}><Download className="h-4 w-4" /></a>}
                      </div>
                      <div className="mt-4"><h2 className="mb-1 line-clamp-3 text-sm font-bold text-gray-900">{file.title}</h2><p className="text-xs font-medium text-gray-400">Document PDF</p></div>
                    </div>
                  )}
                  <div className="mt-2 px-1"><h2 className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">{file.title}</h2>{!mediaUrl && <p className="mt-1 text-[11px] text-gray-500">Fichier à récupérer en ligne</p>}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
