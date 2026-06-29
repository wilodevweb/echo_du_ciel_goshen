"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RotateCw, Home } from "lucide-react";

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine);

    // Listen for online status changes
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkConnection = () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      if (navigator.onLine) {
        setIsOnline(true);
        window.history.back(); // Si on est à nouveau en ligne, on tente de recharger la page précédente
      }
    }, 1500);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-gray-100 p-6">
      <div className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-fiverr/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gray-600/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-gray-900 border border-gray-800 p-5 rounded-3xl mb-6 shadow-inner relative">
            <WifiOff className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
            {!isOnline && (
              <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
            )}
            {isOnline && (
              <div className="absolute top-0 right-0 w-3 h-3 bg-fiverr rounded-full border-2 border-gray-900"></div>
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            {isOnline ? "Connexion rétablie !" : "Vous êtes hors ligne"}
          </h1>
          <p className="text-sm text-gray-400 mb-8 font-medium max-w-[280px] mx-auto leading-relaxed">
            {isOnline 
              ? "Votre appareil est de nouveau connecté à Internet. Vous pouvez reprendre la navigation."
              : "La page que vous essayez d'afficher nécessite une connexion Internet car elle n'a pas été mise en cache."}
          </p>
          
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={checkConnection}
              disabled={isChecking}
              className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold transition shadow-lg ${
                isOnline
                  ? "bg-fiverr text-white shadow-fiverr/20 hover:bg-fiverr-dark"
                  : "bg-fiverr text-white shadow-fiverr/20 hover:bg-fiverr-dark disabled:opacity-70"
              }`}
            >
              <RotateCw className={`w-5 h-5 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Vérification..." : (isOnline ? "Recharger la page" : "Réessayer")}
            </button>
            <Link 
              href="/"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-800 bg-gray-900 text-gray-300 font-semibold hover:bg-gray-800 transition"
            >
              <Home className="w-4 h-4" />
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-xs text-gray-600 font-medium">
        Goshen - Vos données pointées hors-ligne sont en sécurité.
      </div>
    </main>
  );
}
