"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

export function StoragePersister() {
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);

  useEffect(() => {
    async function initStorage() {
      if (typeof window === "undefined" || !("storage" in navigator)) return;

      try {
        // 1. Demander la persistance du stockage pour empêcher l'éviction par le navigateur
        if (navigator.storage.persist) {
          await navigator.storage.persist();
        }

        // 2. Estimer l'espace disque disponible
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage !== undefined && estimate.quota !== undefined && estimate.quota > 0) {
            const usagePercent = (estimate.usage / estimate.quota) * 100;
            if (usagePercent > 85) {
              const usedMB = Math.round(estimate.usage / (1024 * 1024));
              const quotaMB = Math.round(estimate.quota / (1024 * 1024));
              setQuotaWarning(`Espace local presque saturé (${usedMB} Mo / ${quotaMB} Mo). Nettoyez l'appareil.`);
            }
          }
        }
      } catch (err) {
        console.warn("Erreur lors de la configuration du stockage persistant:", err);
      }
    }

    void initStorage();
  }, []);

  if (!quotaWarning) return null;

  return (
    <div
      role="alert"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-lg border border-amber-600 max-w-[90vw]"
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-white" />
      <span className="truncate">{quotaWarning}</span>
    </div>
  );
}

