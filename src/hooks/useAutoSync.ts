"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import db, { syncWithServer } from "@/lib/db";

export type AutoSyncState = "idle" | "offline" | "pending" | "syncing" | "synced" | "error";
export interface AutoSyncSnapshot { state: AutoSyncState; pendingChanges: number }

const RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000] as const;
const SYNC_TIMEOUT_MS = 25_000;
const MAX_BATCHES_PER_RUN = 12;
const SYNC_LOCK_NAME = "goshen-auto-sync";
let activeSync: Promise<void> | null = null;

interface PendingSnapshot { count: number; signature: string }

async function readPendingSnapshot(): Promise<PendingSnapshot> {
  const [updates, deletions, lastChange] = await Promise.all([
    db.pendingSync.count(),
    db.pendingDeletions.count(),
    db.syncState.get("lastLocalChangeAt"),
  ]);
  return { count: updates + deletions, signature: lastChange?.value ?? "" };
}

export function useAutoSync(): AutoSyncSnapshot {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const pendingSnapshot = useLiveQuery(readPendingSnapshot, [], { count: 0, signature: "" });
  const pendingCount = pendingSnapshot.count;
  const [state, setState] = useState<AutoSyncState>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "idle"
  );
  const retryAttempt = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const initialSyncSession = useRef<string | null>(null);
  const runSyncRef = useRef<() => Promise<void>>(async () => undefined);

  const sessionKey = session?.user
    ? (session.user as { id?: string }).id ?? "authenticated"
    : null;

  const runSync = useCallback(async () => {
    if (!mounted.current || sessionStatus !== "authenticated" || pathname === "/login") return;
    if (retryAttempt.current > 0 && retryTimer.current) return;
    if (!navigator.onLine) { setState("offline"); return; }
    if (activeSync) { await activeSync; return; }

    const execute = async () => {
      if (!navigator.onLine) { setState("offline"); return; }
      let previousSnapshot = await readPendingSnapshot();
      const runDeadline = Date.now() + 60_000;
      setState("syncing");

      for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
        const remainingMs = runDeadline - Date.now();
        if (remainingMs <= 0) throw new Error("Délai maximal de synchronisation atteint");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.min(SYNC_TIMEOUT_MS, remainingMs));
        let result: Awaited<ReturnType<typeof syncWithServer>>;
        try { result = await syncWithServer({ signal: controller.signal }); }
        finally { clearTimeout(timeoutId); }
        if (!result.success) throw new Error(result.error ?? "Échec de synchronisation");

        const currentSnapshot = await readPendingSnapshot();
        const currentPending = currentSnapshot.count;
        if (currentPending === 0) {
          retryAttempt.current = 0;
          setState("synced");
          if (successTimer.current) clearTimeout(successTimer.current);
          successTimer.current = setTimeout(() => {
            if (mounted.current) setState("idle");
          }, 3_000);
          return;
        }
        if (currentPending >= previousSnapshot.count && currentSnapshot.signature === previousSnapshot.signature) {
          throw new Error("La file de synchronisation n'a pas avancé");
        }
        previousSnapshot = currentSnapshot;
      }

      setState("pending");
      if (mounted.current) {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => { retryTimer.current = null; void runSyncRef.current(); }, 750);
      }
    };

    const executeWithLock = async () => {
      if (navigator.locks) {
        await navigator.locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
          if (lock) await execute();
          else {
            setState("pending");
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => { retryTimer.current = null; void runSyncRef.current(); }, 2_000);
          }
        });
      } else { await execute(); }
    };

    activeSync = executeWithLock()
      .catch((error: unknown) => {
        if (!mounted.current) return;
        if (!navigator.onLine) { setState("offline"); return; }
        setState("error");
        const delay = RETRY_DELAYS_MS[Math.min(retryAttempt.current, RETRY_DELAYS_MS.length - 1)];
        retryAttempt.current += 1;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => { retryTimer.current = null; void runSyncRef.current(); }, delay);
        console.warn("[AutoSync] Nouvelle tentative différée.", error);
      })
      .finally(() => { activeSync = null; });
    await activeSync;
  }, [pathname, sessionStatus]);

  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (successTimer.current) clearTimeout(successTimer.current);
      if (onlineTimer.current) clearTimeout(onlineTimer.current);
      if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      initialSyncSession.current = null;
      return;
    }
    if (sessionStatus !== "authenticated" || pathname === "/login" || !sessionKey) return;
    if (initialSyncSession.current === sessionKey) return;

    initialSyncSession.current = sessionKey;
    void runSync();
  }, [pathname, runSync, sessionKey, sessionStatus]);

  useEffect(() => {
    if (pendingCount === undefined) return;
    if (pendingCount === 0) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void runSync(), 2_000);
  }, [pendingCount, pendingSnapshot.signature, runSync]);

  useEffect(() => {
    const handleOnline = () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryAttempt.current = 0;
      setState(pendingCount > 0 ? "pending" : "idle");
      if (onlineTimer.current) clearTimeout(onlineTimer.current);
      onlineTimer.current = setTimeout(() => {
        onlineTimer.current = null;
        void runSync();
      }, 1_500);
    };
    const handleOffline = () => setState("offline");
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
      visibilityTimer.current = setTimeout(() => {
        visibilityTimer.current = null;
        void runSync();
      }, 300);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (onlineTimer.current) clearTimeout(onlineTimer.current);
      if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
    };
  }, [pendingCount, runSync]);

  const visibleState = state === "syncing" || state === "error" || state === "synced"
    ? state
    : typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : (pendingCount ?? 0) > 0
        ? "pending"
        : "idle";

  return { state: visibleState, pendingChanges: pendingCount ?? 0 };
}
