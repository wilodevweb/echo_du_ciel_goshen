"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RefreshCw } from "lucide-react";
import db, { getSyncStatus, syncWithServer } from "@/lib/db";

export function SyncPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");

  // Nettoyage local de la base IndexedDB pour les données antérieures au samedi 27 juin 2026
  useEffect(() => {
    const runLocalCleanup = async () => {
      const isCleaned = localStorage.getItem("local-cleanup-20260627-done");
      if (isCleaned) return;

      try {
        await db.transaction("rw", db.children, db.attendances, db.pendingSync, async () => {
          // 1. Trouver les profils d'enfants créés avant le samedi 27 juin 2026
          const oldChildren = await db.children
            .filter((c) => !c.createdAt || c.createdAt < "2026-06-27")
            .toArray();
          const oldChildIds = oldChildren.map((c) => c.id);

          if (oldChildIds.length > 0) {
            // Supprimer les profils locaux
            await db.children.bulkDelete(oldChildIds);

            // 2. Trouver et supprimer les présences associées ou datant d'avant le 27 juin
            const oldAttendances = await db.attendances
              .filter((a) => oldChildIds.includes(a.childId) || a.date < "2026-06-27")
              .toArray();
            await db.attendances.bulkDelete(oldAttendances.map((a) => a.id));

            // 3. Nettoyer la file d'attente de synchronisation locale (pendingSync)
            const pendingItems = await db.pendingSync.toArray();
            const keysToDelete = pendingItems
              .filter(
                (item) =>
                  (item.entity === "child" && oldChildIds.includes(item.id)) ||
                  (item.entity === "attendance" && oldAttendances.some((a) => a.id === item.id))
              )
              .map((item) => item.key);
            await db.pendingSync.bulkDelete(keysToDelete);

            console.log(`[NETTOYAGE LOCAL] ${oldChildIds.length} enfants et présences correspondants supprimés localement.`);
          }
        });
        localStorage.setItem("local-cleanup-20260627-done", "true");
      } catch (error) {
        console.error("[NETTOYAGE LOCAL] Échec du nettoyage local :", error);
      }
    };

    runLocalCleanup();
  }, []);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const syncStatus = useLiveQuery(() => getSyncStatus(), []);
  const childrenCount = useLiveQuery(() => db.children.count(), []);
  const attendancesCount = useLiveQuery(() => db.attendances.count(), []);

  const pendingChanges = syncStatus?.pendingChanges ?? 0;
  const isLoading = syncStatus === undefined || childrenCount === undefined || attendancesCount === undefined;


  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage("");

    try {
      let currentPending = await db.pendingSync.count();
      let totalPulledChildren = 0;
      let totalPulledAttendances = 0;
      let totalChildrenCount = 0;
      let totalAttendancesCount = 0;
      let success = true;
      let errorMsg = "";

      do {
        const result = await syncWithServer();

        if (result.success) {
          totalPulledChildren += result.pulledChildrenCount ?? 0;
          totalPulledAttendances += result.pulledAttendancesCount ?? 0;
          totalChildrenCount += result.childrenCount ?? 0;
          totalAttendancesCount += result.attendancesCount ?? 0;
          currentPending = await db.pendingSync.count();
        } else {
          success = false;
          errorMsg = result.error ?? "Impossible d'envoyer les données.";
          break;
        }
      } while (currentPending > 0);

      if (success) {
        setMessage(
          `${totalPulledChildren} enfants / ${totalPulledAttendances} pointages récupérés, ${totalChildrenCount} enfants / ${totalAttendancesCount} pointages envoyés.`,
        );
      } else {
        setMessage(errorMsg);
      }
      setTimeout(() => setMessage(""), 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2 animate-bounce-in">
      {message && (
        <div className="max-w-xs rounded-xl bg-gray-900/95 text-white p-3 text-xs shadow-xl border border-gray-800 backdrop-blur-sm">
          {message}
        </div>
      )}
      <button
        type="button"
        disabled={isSyncing || !isOnline}
        onClick={handleSync}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-fiverr text-white shadow-xl hover:bg-fiverr-dark active:scale-95 transition-all relative border border-fiverr/20 ${
          isSyncing ? "opacity-90" : ""
        } ${!isOnline ? "bg-gray-500 cursor-not-allowed" : ""}`}
        title={pendingChanges > 0 ? `${pendingChanges} modification(s) en attente d'envoi` : "Rafraîchir les données"}
      >
        <RefreshCw className={`h-6 w-6 ${isSyncing ? "animate-spin" : ""}`} />
        
        {/* Badge pour le nombre de modifications */}
        {pendingChanges > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border-2 border-white shadow-sm">
            {pendingChanges}
          </span>
        )}
      </button>
    </div>
  );
}
