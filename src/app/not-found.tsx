import React from "react";
import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-gray-100 p-6">
      <div className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-fiverr/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-fiverr/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-6 shadow-inner">
            <FileQuestion className="w-12 h-12 text-fiverr" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 mb-2">
            404
          </h1>
          <h2 className="text-xl font-bold text-gray-200 mb-4">
            Page introuvable
          </h2>
          <p className="text-sm text-gray-400 mb-8 font-medium max-w-xs mx-auto leading-relaxed">
            Oups ! La ressource ou la page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <BackButton />
            <Link 
              href="/"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-fiverr hover:bg-fiverr-dark text-white font-bold transition shadow-lg shadow-fiverr/20"
            >
              <Home className="w-4 h-4" />
              Accueil
            </Link>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-xs text-gray-600 font-medium">
        Goshen - École du Dimanche
      </div>
    </main>
  );
}
