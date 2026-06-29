"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import db, { getSyncStatus, syncWithServer } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

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
  const lastSyncLabel = syncStatus?.lastSyncAt
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(syncStatus.lastSyncAt))
    : null;

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
      const result = await syncWithServer();

      if (result.success) {
        setMessage(
          `${result.pulledChildrenCount} enfants / ${result.pulledAttendancesCount} pointages récupérés, ${result.childrenCount} enfants / ${result.attendancesCount} pointages envoyés.`,
        );
      } else {
        setMessage(result.error ?? "Impossible d'envoyer les données.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00b22d]/10 text-[#00b22d]">
            {pendingChanges > 0 ? (
              <UploadCloud className="h-5 w-5" />
            ) : (
              <CloudOff className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Synchronisation manuelle</h2>
            {isLoading ? (
              <Skeleton className="mt-1 h-3 w-48" />
            ) : (
              <p className="text-xs text-gray-500">
                {!isOnline
                  ? "Mode hors ligne: les données restent sur cet appareil."
                  : pendingChanges > 0
                  ? `${pendingChanges} modification${pendingChanges > 1 ? "s" : ""} en attente`
                  : lastSyncLabel
                  ? `Dernier envoi: ${lastSyncLabel}`
                  : "Les modifications restent hors ligne jusqu'à l'envoi."}
              </p>
            )}
          </div>
        </div>
      </div>

      <Button
        type="button"
        fullWidth
        disabled={isLoading || isSyncing || !isOnline}
        onClick={handleSync}
      >
        <RefreshCw className={`mr-2 h-5 w-5 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Synchronisation..." : isOnline ? "Synchroniser les données" : "Hors ligne"}
      </Button>

      {message && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {message}
        </p>
      )}
    </section>
  );
}
