"use client";

import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

export default function FichiersLoading() {
  const skeletonItems = [
    { id: 1, aspect: 'aspect-[3/4]' },
    { id: 2, aspect: 'aspect-[4/3]' },
    { id: 3, aspect: 'aspect-square' },
    { id: 4, aspect: 'aspect-square' },
    { id: 5, aspect: 'aspect-[3/4]' },
    { id: 6, aspect: 'aspect-[4/3]' },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold">Ressources</h1>
          </div>
        </div>
        
        {/* Formulaire de recherche simulé */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <div className="block w-full h-9 pl-10 pr-3 py-2 bg-white/20 rounded-xl" />
        </div>
      </header>

      {/* Filtres rapides simulés */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        {['Tous', 'Images', 'Vidéos', 'Documents'].map((label, idx) => (
          <div
            key={idx}
            className="whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-full bg-gray-200 text-gray-400 animate-pulse"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid de Skeletons */}
      <div className="px-4 mt-2">
        <div className="columns-2 gap-4 space-y-4">
          {skeletonItems.map((item) => (
            <div key={item.id} className="break-inside-avoid relative animate-pulse flex flex-col gap-2">
              <div className={`w-full rounded-2xl bg-gray-200 ${item.aspect} shadow-sm border border-gray-100`} />
              <div className="h-4 bg-gray-200 rounded-lg w-3/4 mt-1" />
              <div className="h-3 bg-gray-200 rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
