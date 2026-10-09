"use client";

import { Check, CloudUpload, RefreshCw, WifiOff } from "lucide-react";
import { useAutoSync } from "@/hooks/useAutoSync";

export function GlobalSyncBar() {
  const { state, pendingChanges } = useAutoSync();
  if (state === "idle") return null;

  const content = state === "offline"
    ? { Icon: WifiOff, label: pendingChanges ? `Hors ligne · ${pendingChanges} modification(s) gardée(s) ici` : "Hors ligne · données locales disponibles" }
    : state === "syncing"
      ? { Icon: RefreshCw, label: "Synchronisation en cours…" }
      : state === "error"
        ? { Icon: CloudUpload, label: pendingChanges > 0 ? `${pendingChanges} modification(s) conservée(s) · nouvelle tentative automatique` : "Serveur indisponible · nouvelle tentative automatique" }
        : state === "synced"
          ? { Icon: Check, label: "Tout est à jour" }
          : { Icon: CloudUpload, label: `${pendingChanges} modification(s) à synchroniser` };
  const Icon = content.Icon;

  return (
    <div role="status" aria-live="polite" className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg backdrop-blur">
      <Icon className={`h-4 w-4 shrink-0 ${state === "syncing" ? "animate-spin" : state === "offline" ? "text-amber-600" : "text-emerald-600"}`} />
      <span className="truncate">{content.label}</span>
    </div>
  );
}
