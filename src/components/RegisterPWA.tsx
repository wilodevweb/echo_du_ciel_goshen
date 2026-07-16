"use client";

import { useEffect, useState } from "react";
import { RotateCw, X } from "lucide-react";

export function RegisterPWA() {
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((registration) => {
          // 1. Vérifier si un SW en attente d'activation est déjà présent au chargement
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdateToast(true);
          }

          // 2. Écouter les changements pour détecter quand un nouveau SW arrive dans l'état "waiting"
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // Un nouveau Service Worker a été installé avec succès et est prêt à remplacer le précédent
                  setWaitingWorker(newWorker);
                  setShowUpdateToast(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("Erreur d'enregistrement du Service Worker:", error);
        });

      // 3. Forcer la recherche de mises à jour régulièrement à chaque changement de focus
      const checkForUpdates = () => {
        navigator.serviceWorker.ready.then((registration) => {
          if (navigator.onLine) {
            registration.update().catch((e) => console.warn("Échec de la recherche de mise à jour du SW", e));
          }
        });
      };

      window.addEventListener("focus", checkForUpdates);
      return () => window.removeEventListener("focus", checkForUpdates);
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  // Écouter le message skipWaiting pour recharger l'application automatiquement
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Envoyer l'ordre au Service Worker en attente de s'activer
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdateToast(false);
  };

  if (!showUpdateToast) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="bg-gray-900 border border-gray-800 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-fiverr uppercase tracking-wider">Mise à jour disponible</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Une nouvelle version de Goshen est disponible. Mettre à jour maintenant ?
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-fiverr hover:bg-fiverr-dark text-white text-xs font-bold shadow-lg transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Mettre à jour
          </button>
          <button
            onClick={() => setShowUpdateToast(false)}
            className="p-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

