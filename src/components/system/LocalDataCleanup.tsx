"use client";

import { useEffect } from "react";
import db from "@/lib/db";
import { LOCAL_DATA_CLEANUP_CUTOFF } from "@/lib/constants";

/** Maintient le nettoyage local ponctuel auparavant déclenché par le panneau d’accueil. */
export function LocalDataCleanup() {
  useEffect(() => {
    const runLocalCleanup = async () => {
      const cleanupKey = `local-cleanup-${LOCAL_DATA_CLEANUP_CUTOFF.replaceAll("-", "")}-done`;
      if (localStorage.getItem(cleanupKey)) return;
      try {
        const totalChildren = await db.children.count();
        if (totalChildren === 0) {
          localStorage.setItem(cleanupKey, "true");
          return;
        }
        await db.transaction("rw", db.children, db.attendances, db.pendingSync, async () => {
          const oldChildren = await db.children.filter((child) => !child.createdAt || child.createdAt < LOCAL_DATA_CLEANUP_CUTOFF).toArray();
          const recentAttendanceChildIds = new Set(
            (await db.attendances.where("date").aboveOrEqual(LOCAL_DATA_CLEANUP_CUTOFF).toArray())
              .map((attendance) => attendance.childId),
          );
          const oldChildIds = oldChildren.filter((child) => !recentAttendanceChildIds.has(child.id)).map((child) => child.id);
          if (oldChildIds.length === 0) return;
          const oldChildIdSet = new Set(oldChildIds);
          await db.children.bulkDelete(oldChildIds);
          const [oldDateAttendances, oldChildAttendances] = await Promise.all([
            db.attendances.where("date").below(LOCAL_DATA_CLEANUP_CUTOFF).toArray(),
            db.attendances.where("childId").anyOf(oldChildIds).toArray(),
          ]);
          const oldAttendanceIds = new Set([...oldDateAttendances, ...oldChildAttendances].map((attendance) => attendance.id));
          await db.attendances.bulkDelete(Array.from(oldAttendanceIds));
          const pendingItems = await db.pendingSync.toArray();
          const keysToDelete = pendingItems.filter((item) =>
            (item.entity === "child" && oldChildIdSet.has(item.id)) ||
            (item.entity === "attendance" && oldAttendanceIds.has(item.id))
          ).map((item) => item.key);
          await db.pendingSync.bulkDelete(keysToDelete);
          console.log(`[NETTOYAGE LOCAL] ${oldChildIds.length} enfants et présences correspondants supprimés localement.`);
        });
        localStorage.setItem(cleanupKey, "true");
      } catch (error) {
        console.error("[NETTOYAGE LOCAL] Échec du nettoyage local :", error);
      }
    };
    void runLocalCleanup();
  }, []);
  return null;
}
