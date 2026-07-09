"use client";

import React, { useState, useDeferredValue, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, Smile } from 'lucide-react';
import db, { getClassLabel, isDeletedChildRecord, type Child } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/Card';
import { MobileHeader } from '@/components/ui/MobileHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { PointageCard } from '@/components/pointage/PointageCard';
import { ChildDetailsModal } from '@/components/pointage/ChildDetailsModal';
import { SearchFilterHeader } from '@/components/ui/SearchFilterHeader';

export default function ChildrenList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [detailsChild, setDetailsChild] = useState<Child | null>(null);

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

  // Récupérer et filtrer les enfants depuis IndexedDB en utilisant l'index createdAt
  const children = useLiveQuery(async () => {
    // orderBy est beaucoup plus rapide que sortBy car il utilise l'index de la base de données
    const allChildren = await db.children.orderBy('createdAt').reverse().toArray();
    let visibleChildren = allChildren.filter((c) => !isDeletedChildRecord(c) && !c.notes?.includes('[ARCHIVE]'));

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
  }, [deferredSearchQuery, activeFilter]);

  const rightAction = (
    <Link href="/enfants/nouveau" className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
      <UserPlus className="w-5 h-5" />
    </Link>
  );

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      <MobileHeader title="Annuaire" rightElement={rightAction} />
      
      <SearchFilterHeader 
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

      <div className="p-4 flex-1 overflow-y-auto">
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
