import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, FileText, Play, MoreVertical } from 'lucide-react';

// --- MOCK DATA ---
type MediaType = 'image' | 'video' | 'pdf';

interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  url: string;
  thumbnail: string; // Color code for dummy or image url
  aspectRatio: 'tall' | 'wide' | 'square';
}

const mockFiles: MediaItem[] = [
  { id: '1', type: 'image', title: 'Culte des enfants - Pâques', url: '#', thumbnail: 'bg-rose-300', aspectRatio: 'tall' },
  { id: '2', type: 'video', title: 'Chorale des petits', url: '#', thumbnail: 'bg-indigo-400', aspectRatio: 'wide' },
  { id: '3', type: 'pdf', title: 'Programme de l\'année', url: '#', thumbnail: 'bg-gray-100', aspectRatio: 'square' },
  { id: '4', type: 'image', title: 'Sortie au parc', url: '#', thumbnail: 'bg-emerald-300', aspectRatio: 'square' },
  { id: '5', type: 'image', title: 'Activité manuelle', url: '#', thumbnail: 'bg-amber-300', aspectRatio: 'tall' },
  { id: '6', type: 'pdf', title: 'Règlement intérieur', url: '#', thumbnail: 'bg-gray-100', aspectRatio: 'tall' },
  { id: '7', type: 'video', title: 'Leçon: L\'Arche de Noé', url: '#', thumbnail: 'bg-cyan-400', aspectRatio: 'tall' },
  { id: '8', type: 'image', title: 'Remise des diplômes', url: '#', thumbnail: 'bg-purple-300', aspectRatio: 'wide' },
];

function getAspectRatioClass(ratio: 'tall' | 'wide' | 'square') {
  if (ratio === 'tall') return 'aspect-[3/4]';
  if (ratio === 'wide') return 'aspect-[4/3]';
  return 'aspect-square';
}

export default function FichiersPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold">Ressources</h1>
          </div>
        </div>
        
        {/* Barre de recherche */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white sm:text-sm"
            placeholder="Rechercher des fichiers, leçons..."
          />
        </div>
      </header>

      {/* Filtres rapides */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        <button className="whitespace-nowrap px-4 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-full">Tous</button>
        <button className="whitespace-nowrap px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-300 transition">Images</button>
        <button className="whitespace-nowrap px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-300 transition">Vidéos</button>
        <button className="whitespace-nowrap px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-300 transition">Documents</button>
      </div>

      {/* Masonry Grid */}
      <div className="px-4 mt-2">
        <div className="columns-2 gap-4 space-y-4">
          {mockFiles.map((file) => (
            <div key={file.id} className="break-inside-avoid relative group cursor-pointer">
              
              {/* Type: IMAGE */}
              {file.type === 'image' && (
                <div className={`w-full rounded-2xl overflow-hidden shadow-sm ${file.thumbnail} ${getAspectRatioClass(file.aspectRatio)} relative`}>
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end">
                      <button className="bg-white/90 p-1.5 rounded-full text-gray-800 hover:bg-white"><MoreVertical className="w-4 h-4" /></button>
                    </div>
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow-md">{file.title}</p>
                  </div>
                </div>
              )}

              {/* Type: VIDEO */}
              {file.type === 'video' && (
                <div className={`w-full rounded-2xl overflow-hidden shadow-sm ${file.thumbnail} ${getAspectRatioClass(file.aspectRatio)} relative flex items-center justify-center`}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center z-10 shadow-lg">
                    <Play className="w-5 h-5 text-gray-900 ml-1" />
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex flex-col justify-between p-3 z-20">
                    <div className="flex justify-end">
                      <button className="bg-white/90 p-1.5 rounded-full text-gray-800 hover:bg-white"><MoreVertical className="w-4 h-4" /></button>
                    </div>
                    <p className="text-white font-semibold text-sm line-clamp-2">{file.title}</p>
                  </div>
                </div>
              )}

              {/* Type: PDF */}
              {file.type === 'pdf' && (
                <div className={`w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm p-4 flex flex-col justify-between ${getAspectRatioClass(file.aspectRatio)}`}>
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <button className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-5 h-5" /></button>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-3 mb-1">{file.title}</h3>
                    <p className="text-xs text-gray-400 font-medium">Document PDF</p>
                  </div>
                </div>
              )}

              {/* Titre affiché sous la carte (sauf pour PDF qui a le titre intégré) */}
              {file.type !== 'pdf' && (
                <div className="mt-2 px-1 flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{file.title}</h3>
                  <button className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"><MoreVertical className="w-4 h-4" /></button>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
