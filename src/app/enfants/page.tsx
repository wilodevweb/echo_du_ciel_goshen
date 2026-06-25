"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, Phone, ArrowLeft, User } from 'lucide-react';
import db, { getClassLabel } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/Card';

export default function ChildrenList() {
  const [searchQuery, setSearchQuery] = useState('');

  // Récupérer et filtrer les enfants depuis IndexedDB
  const children = useLiveQuery(async () => {
    const allChildren = await db.children.toArray();
    allChildren.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!searchQuery) return allChildren;
    
    const lowerQuery = searchQuery.toLowerCase();
    return allChildren.filter(child => 
      child.firstName.toLowerCase().includes(lowerQuery) || 
      child.lastName.toLowerCase().includes(lowerQuery) ||
      child.parentPhone.includes(searchQuery)
    );
  }, [searchQuery]);

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Header Mobile */}
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold">Annuaire</h1>
          </div>
          <Link href="/enfants/nouveau" className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
            <UserPlus className="w-5 h-5" />
          </Link>
        </div>
        
        {/* Barre de recherche */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white sm:text-sm"
            placeholder="Rechercher un enfant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="p-4 flex-1 overflow-y-auto">
        {children === undefined ? (
          <div className="flex justify-center mt-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00b22d]"></div>
          </div>
        ) : children.length === 0 ? (
          <div className="text-center mt-10 text-gray-500">
            {searchQuery ? "Aucun résultat trouvé." : "Aucun enfant enregistré."}
            {!searchQuery && (
              <div className="mt-4">
                <Link href="/enfants/nouveau" className="text-[#00b22d] font-semibold underline">
                  Ajouter le premier enfant
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {children.map(child => (
              <Card key={child.id} padding="none" className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center p-4">
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
                        <User className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    
                    {/* Infos */}
                    <div className="ml-4 flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                        {child.firstName} {child.lastName}
                      </h3>
                      <p className="text-xs font-semibold text-[#00b22d]">
                        {getClassLabel(child.classLevel)}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {child.parentPhone}
                      </p>
                    </div>

                    {/* Action Appeler */}
                    <a 
                      href={`tel:${child.parentPhone}`} 
                      className="ml-2 w-10 h-10 rounded-full bg-[#00b22d]/10 flex items-center justify-center text-[#00b22d] hover:bg-[#00b22d] hover:text-white transition-colors"
                      title="Appeler le parent"
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
