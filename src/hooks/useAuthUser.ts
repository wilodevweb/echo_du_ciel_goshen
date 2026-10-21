"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

interface CachedUser {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  cachedAt: number;
}

const STORAGE_KEY = "goshen_cached_user";
const CACHE_CLEARED_EVENT = "goshen:auth-cache-cleared";
// Cache valable 30 jours (aligné avec les sessions JWT mobiles)
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function clearCachedUser() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Le changement de session doit continuer même si le stockage est indisponible.
  }
  window.dispatchEvent(new Event(CACHE_CLEARED_EVENT));
}

export function useAuthUser() {
  const { data: session, status } = useSession();
  const cacheFrame = useRef<number | null>(null);
  const [cachedUser, setCachedUser] = useState<CachedUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedUser;
      if (Date.now() - parsed.cachedAt > MAX_CACHE_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session?.user) {
      const user = session.user as { id?: string; name?: string | null; username?: string | null; role?: string | null };
      const newCache: CachedUser = {
        id: user.id || "",
        name: user.name,
        username: user.username,
        role: user.role,
        cachedAt: Date.now(),
      };
      if (cacheFrame.current !== null) window.cancelAnimationFrame(cacheFrame.current);
      cacheFrame.current = window.requestAnimationFrame(() => {
        cacheFrame.current = null;
        setCachedUser(newCache);
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCache));
      } catch (err) {
        console.error("Erreur sauvegarde cached user:", err);
      }
      return () => {
        if (cacheFrame.current !== null) window.cancelAnimationFrame(cacheFrame.current);
        cacheFrame.current = null;
      };
    }
  }, [session]);

  useEffect(() => {
    const handleCacheCleared = () => {
      if (cacheFrame.current !== null) window.cancelAnimationFrame(cacheFrame.current);
      cacheFrame.current = null;
      setCachedUser(null);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue === null) handleCacheCleared();
    };
    window.addEventListener(CACHE_CLEARED_EVENT, handleCacheCleared);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CACHE_CLEARED_EVENT, handleCacheCleared);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const user = session?.user
    ? (session.user as { id?: string; name?: string | null; username?: string | null; role?: string | null })
    : cachedUser;

  const isAdmin = user?.role === "ADMIN";

  return {
    user,
    isAdmin,
    status,
    isAuthenticated: Boolean(user),
  };
}

