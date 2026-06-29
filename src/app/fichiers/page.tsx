import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, FileText, Play, Download } from 'lucide-react';
import { prisma } from "@/lib/prisma";
import { MobileHeader } from '@/components/ui/MobileHeader';
import { EmptyState } from '@/components/ui/EmptyState';

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function FichiersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q || "";
  const filterType = params.type || "all";

  // Charger depuis la base de données
  const dbFiles = await prisma.mediaResource.findMany({
    where: {
      AND: [
        filterType !== "all" ? { type: filterType } : {},
        q ? {
          title: {
            contains: q,
          }
        } : {},
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  // Mock files si la BDD est vide, pour ne pas avoir un écran vide au départ
  const mockFiles = [
    { id: 'mock-1', type: 'image', title: 'Culte des enfants - Pâques', url: '#', thumbnail: '', aspectRatio: 'tall' },
    { id: 'mock-2', type: 'video', title: 'Chorale des petits', url: '#', thumbnail: '', aspectRatio: 'wide' },
    { id: 'mock-3', type: 'pdf', title: 'Programme de l\'année', url: '#', thumbnail: '', aspectRatio: 'square' },
    { id: 'mock-4', type: 'image', title: 'Sortie au parc', url: '#', thumbnail: '', aspectRatio: 'square' },
    { id: 'mock-5', type: 'image', title: 'Activité manuelle', url: '#', thumbnail: '', aspectRatio: 'tall' },
    { id: 'mock-6', type: 'pdf', title: 'Règlement intérieur', url: '#', thumbnail: '', aspectRatio: 'tall' },
  ];

  const files = dbFiles.length > 0 ? dbFiles.map(file => ({
    id: file.id,
    type: file.type,
    title: file.title,
    url: file.url,
    thumbnail: file.thumbnail || '',
    aspectRatio: file.aspectRatio
  })) : mockFiles;

  function getAspectRatioClass(ratio: string) {
    if (ratio === 'tall') return 'aspect-[3/4]';
    if (ratio === 'wide') return 'aspect-[4/3]';
    return 'aspect-square';
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <MobileHeader title="Ressources" />
      
      <div className="bg-fiverr px-4 pb-4 sticky top-[60px] z-20 shadow-md">
        {/* Formulaire de recherche */}
        <form method="GET" action="/fichiers" className="relative">
          <input type="hidden" name="type" value={filterType} />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            name="q"
            defaultValue={q}
            className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white sm:text-sm"
            placeholder="Rechercher des fichiers, leçons..."
          />
        </form>
      </div>

      {/* Filtres rapides */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        <Link 
          href={`/fichiers?type=all${q ? `&q=${q}` : ''}`}
          className={`whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-full transition ${filterType === 'all' ? 'bg-gray-950 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Tous
        </Link>
        <Link 
          href={`/fichiers?type=image${q ? `&q=${q}` : ''}`}
          className={`whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-full transition ${filterType === 'image' ? 'bg-gray-950 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Images
        </Link>
        <Link 
          href={`/fichiers?type=video${q ? `&q=${q}` : ''}`}
          className={`whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-full transition ${filterType === 'video' ? 'bg-gray-950 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Vidéos
        </Link>
        <Link 
          href={`/fichiers?type=pdf${q ? `&q=${q}` : ''}`}
          className={`whitespace-nowrap px-4 py-1.5 text-sm font-semibold rounded-full transition ${filterType === 'pdf' ? 'bg-gray-950 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Documents
        </Link>
      </div>

      {/* Grid */}
      <div className="px-4 mt-2">
        {files.length === 0 ? (
          <EmptyState title="Aucun fichier trouvé" description="Essayez une autre recherche ou un autre filtre." />
        ) : (
          <div className="columns-2 gap-4 space-y-4">
            {files.map((file) => (
              <div key={file.id} className="break-inside-avoid relative group cursor-pointer">
                
                {/* Type: IMAGE */}
                {file.type === 'image' && (
                  <div className={`w-full rounded-2xl overflow-hidden shadow-sm border border-gray-150 ${getAspectRatioClass(file.aspectRatio)} relative bg-gray-200`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={file.thumbnail || file.url} 
                      alt={file.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex justify-end">
                        <a href={file.url} download className="bg-white/90 p-1.5 rounded-full text-gray-800 hover:bg-white transition"><Download className="w-4 h-4" /></a>
                      </div>
                      <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{file.title}</p>
                    </div>
                  </div>
                )}

                {/* Type: VIDEO */}
                {file.type === 'video' && (
                  <div className={`w-full rounded-2xl overflow-hidden shadow-sm ${file.thumbnail || 'bg-indigo-500'} ${getAspectRatioClass(file.aspectRatio)} relative flex items-center justify-center`}>
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center z-10 shadow-lg group-hover:scale-115 transition">
                      <Play className="w-5 h-5 text-gray-900 ml-0.5" />
                    </div>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/45 flex flex-col justify-between p-3 z-20">
                      <div className="flex justify-end">
                        <a href={file.url} download className="bg-white/90 p-1.5 rounded-full text-gray-800 hover:bg-white transition"><Download className="w-4 h-4" /></a>
                      </div>
                      <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{file.title}</p>
                    </div>
                  </div>
                )}

                {/* Type: PDF */}
                {file.type === 'pdf' && (
                  <div className={`w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition ${getAspectRatioClass(file.aspectRatio)}`}>
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <a href={file.url} download className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-3 mb-1">{file.title}</h3>
                      <p className="text-xs text-gray-400 font-medium">Document PDF</p>
                    </div>
                  </div>
                )}

                {/* Titre pour Image et Vidéo */}
                {file.type !== 'pdf' && (
                  <div className="mt-2 px-1 flex justify-between items-start">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{file.title}</h3>
                    <a href={file.url} download className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 transition">
                      <Download className="w-4 h-4" />
                    </a>
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
