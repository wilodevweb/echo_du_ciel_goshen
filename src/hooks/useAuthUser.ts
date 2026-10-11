"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface CachedUser {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  cachedAt: number;
}

const STORAGE_KEY = "goshen_cached_user";
// Cache valable 30 jours (aligné avec les sessions JWT mobiles)
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function useAuthUser() {
  const { data: session, status } = useSession();
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
      setCachedUser(newCache);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCache));
      } catch (err) {
        console.error("Erreur sauvegarde cached user:", err);
      }
    }
  }, [session]);

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

