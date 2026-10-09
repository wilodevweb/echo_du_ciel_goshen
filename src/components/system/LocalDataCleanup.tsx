"use client";

import { useEffect } from "react";
import db from "@/lib/db";

/** Maintient le nettoyage local ponctuel auparavant déclenché par le panneau d’accueil. */
export function LocalDataCleanup() {
  useEffect(() => {
    const runLocalCleanup = async () => {
      if (localStorage.getItem("local-cleanup-20260627-done")) return;
      try {
        const totalChildren = await db.children.count();
        if (totalChildren === 0) {
          localStorage.setItem("local-cleanup-20260627-done", "true");
          return;
        }
        await db.transaction("rw", db.children, db.attendances, db.pendingSync, async () => {
          const oldChildren = await db.children.filter((child) => !child.createdAt || child.createdAt < "2026-06-27").toArray();
          const oldChildIds: string[] = [];
          for (const child of oldChildren) {
            const recentAttendance = await db.attendances.where("childId").equals(child.id).filter((attendance) => attendance.date >= "2026-06-27").first();
            if (!recentAttendance) oldChildIds.push(child.id);
          }
          if (oldChildIds.length === 0) return;
          await db.children.bulkDelete(oldChildIds);
          const oldAttendances = await db.attendances.filter((attendance) => oldChildIds.includes(attendance.childId) || attendance.date < "2026-06-27").toArray();
          await db.attendances.bulkDelete(oldAttendances.map((attendance) => attendance.id));
          const oldAttendanceIds = new Set(oldAttendances.map((attendance) => attendance.id));
          const pendingItems = await db.pendingSync.toArray();
          const keysToDelete = pendingItems.filter((item) =>
            (item.entity === "child" && oldChildIds.includes(item.id)) ||
            (item.entity === "attendance" && oldAttendanceIds.has(item.id))
          ).map((item) => item.key);
          await db.pendingSync.bulkDelete(keysToDelete);
          console.log(`[NETTOYAGE LOCAL] ${oldChildIds.length} enfants et présences correspondants supprimés localement.`);
        });
        localStorage.setItem("local-cleanup-20260627-done", "true");
      } catch (error) {
        console.error("[NETTOYAGE LOCAL] Échec du nettoyage local :", error);
      }
    };
    void runLocalCleanup();
  }, []);
  return null;
}
