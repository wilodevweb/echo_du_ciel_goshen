"use client";

import React, { useState, useDeferredValue, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, Smile, Archive, ArrowLeft } from 'lucide-react';
import db, { getClassLabel, isDeletedChildRecord, type Child } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { PointageCard } from '@/components/pointage/PointageCard';
import { ChildDetailsModal } from '@/components/pointage/ChildDetailsModal';
import { SearchFilterHeader } from '@/components/ui/SearchFilterHeader';
import { ActionGroup } from '@/components/ui/ActionGroup';
import { Suspense } from 'react';

export default function ChildrenList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [detailsChild, setDetailsChild] = useState<Child | null>(null);

  const [scrollY, setScrollY] = useState(0);

  // Détecter un nouvel enfant ajouté pour afficher sa fiche de profil immédiatement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URL(window.location.href).searchParams;
      const newChildId = searchParams.get("newChildId");
      if (newChildId) {
        db.children.get(newChildId).then((child) => {
          if (child) {
            setSelectedChild(child);
            // Nettoyer l'URL
            router.replace("/enfants");
          }
        });
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Récupérer et filtrer les enfants depuis IndexedDB en utilisant l'index createdAt
  const children = useLiveQuery(async () => {
    // orderBy est beaucoup plus rapide que sortBy car il utilise l'index de la base de données
    const allChildren = await db.children.orderBy('createdAt').reverse().toArray();
    let visibleChildren = allChildren.filter((c) => {
      const isArchived = Boolean(c.notes?.includes('[ARCHIVE]'));
      if (showArchived) return !isDeletedChildRecord(c) && isArchived;
      return !isDeletedChildRecord(c) && !isArchived;
    });

    if (activeFilter !== 'all') {
      visibleChildren = visibleChildren.filter(child => child.classLevel === activeFilter);
    }

    if (!deferredSearchQuery) return visibleChildren;
    
    const lowerQuery = deferredSearchQuery.toLowerCase();
    return visibleChildren.filter(child => {
      return child.firstName.toLowerCase().includes(lowerQuery) || 
      child.lastName.toLowerCase().includes(lowerQuery) ||
      child.parentPhone.includes(deferredSearchQuery);
    });
  }, [deferredSearchQuery, activeFilter, showArchived]);

  const rightAction = (
    <ActionGroup
      buttons={[
        {
          id: "search",
          icon: Search,
          isActive: showSearch,
          onClick: () => setShowSearch(!showSearch)
        },
        {
          id: "archive",
          icon: Archive,
          isActive: showArchived,
          onClick: () => setShowArchived(!showArchived),
          title: "Afficher les enfants archivés"
        },
        {
          id: "new",
          icon: UserPlus,
          onClick: () => router.push("/enfants/nouveau")
        }
      ]}
    />
  );

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Sticky header collapsing */}
      <header 
        style={{
          backgroundColor: `rgba(52, 46, 232, ${Math.min(0.98, scrollY / 80)})`,
          backdropFilter: scrollY > 10 ? 'blur(16px)' : 'none',
          boxShadow: scrollY > 40 ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)' : 'none',
          borderBottom: scrollY > 40 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
        }}
        className="fixed top-0 left-0 right-0 z-30 transition-all duration-75 h-[60px] flex items-center justify-between px-4 text-white"
      >
        <div className="flex items-center">
          <Link href="/" className="mr-4 hover:opacity-85 transition-opacity p-2 rounded-xl bg-white/10 backdrop-blur-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 
            style={{ opacity: Math.min(1, scrollY / 80) }}
            className="text-lg font-extrabold tracking-tight transition-opacity duration-100"
          >
            {showArchived ? "Archives" : "Annuaire"}
          </h1>
        </div>
        <div className="flex items-center">
          {rightAction}
        </div>
      </header>

      {/* Hero Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-[#1e1b4b] via-[#312e81] to-[#342ee8] text-white pt-20 pb-8 px-6 rounded-b-[36px] shadow-lg">
        {/* Background blobs for premium decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#342ee8]/25 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-cyan-500/20 rounded-full -ml-16 -mb-16 blur-2xl" />
        
        <div 
          style={{ 
            opacity: Math.max(0, 1 - scrollY / 100),
            transform: `translateY(-${scrollY * 0.12}px)`
          }}
          className="relative transition-all duration-75"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Smile className="w-10 h-10 text-cyan-200" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                {showArchived ? "Archives" : "Annuaire"}
              </h2>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-[0.1em] mt-1.5 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                {children?.length ?? 0} {showArchived ? "enfants archivés" : "enfants actifs"}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Suspense fallback={<div className="h-[60px]" />}>
        <SearchFilterHeader 
          showSearchBar={showSearch}
          serverMode={false}
          placeholder="Rechercher un enfant..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filters={[
            { label: "Toutes", value: "all" },
            { label: "1ère Classe", value: "FIRST" },
            { label: "2ème Classe", value: "SECOND" },
            { label: "3ème Classe", value: "THIRD" },
          ]}
        />
      </Suspense>

      <div className="p-4 pb-20">
        {children === undefined ? (
          <ChildrenListSkeleton />
        ) : children.length === 0 ? (
          <div className="text-center mt-10 text-gray-500">
            {searchQuery ? "Aucun résultat trouvé." : "Aucun enfant enregistré."}
            {!searchQuery && (
              <div className="mt-4">
                <Link href="/enfants/nouveau" className="text-fiverr font-semibold underline">
                  Ajouter le premier enfant
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {children.map(child => (
              <Card key={child.id} padding="none" className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div 
                    className="flex items-center p-4 cursor-pointer"
                    onClick={() => setSelectedChild(child)}
                  >
                    {/* Photo/Avatar */}
                    <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-300">
                      {child.photoUrl ? (
                        <Image
                          src={child.photoUrl}
                          alt={`${child.firstName} ${child.lastName}`}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <Smile className="w-6 h-6 text-fiverr/60" strokeWidth={1.5} />
                      )}
                    </div>
                    
                    {/* Infos */}
                    <div className="ml-4 flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg leading-tight truncate">
                        {child.lastName} {child.postName} {child.firstName}
                      </h3>
                      <p className="text-xs font-semibold text-fiverr">
                        {getClassLabel(child.classLevel)}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {child.parentPhone}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Affichage de la 3e carte (Profil) au clic sur un élément de l'annuaire */}
      {selectedChild && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setSelectedChild(null)}
              className="absolute -top-3 -right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900 shadow-xl font-black text-base hover:bg-gray-200 transition-transform active:scale-95"
            >
              ✕
            </button>
            <PointageCard
              mode="profile"
              child={selectedChild}
              onNameClick={() => setDetailsChild(selectedChild)}
            />
          </div>
        </div>
      )}

      {/* Modale détail sombre */}
      {detailsChild && (
        <ChildDetailsModal
          child={detailsChild}
          onClose={() => {
            setDetailsChild(null);
            if (detailsChild) {
              db.children.get(detailsChild.id).then((updated) => {
                if (updated) setSelectedChild(updated);
                else setSelectedChild(null);
              });
            }
          }}
        />
      )}
    </main>
  );
}

function ChildrenListSkeleton() {
  return (
    <div className="space-y-4 pb-10">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} padding="none" className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
              <div className="ml-4 flex-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="mt-2 h-3 w-20" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
              <Skeleton className="ml-2 h-10 w-10 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
