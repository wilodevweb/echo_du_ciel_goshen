"use client";

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '@/lib/db';
import { buildAttendanceHistoryMapAsync } from '@/components/pointage/utils';

function sendLocalPush(title: string, body: string) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(registration => {
    registration.showNotification(title, {
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data: { url: "/notifications" }
    });
  });
}

export function PushNotifier() {
  const historyMap = useLiveQuery(() => buildAttendanceHistoryMapAsync());

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!historyMap) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const checkNotifications = async () => {
      
      const todayStr = new Date().toISOString().split("T")[0];
      const sickKey = `notified_sick_${todayStr}`;
      const absKey = `notified_abs_${todayStr}`;

      const notifiedSickKeys: string[] = JSON.parse(localStorage.getItem(sickKey) || '[]');
      const notifiedAbsKeys: string[] = JSON.parse(localStorage.getItem(absKey) || '[]');
      
      let hasNewSick = false;
      let hasNewAbs = false;

      const sickChildIds: string[] = [];
      const absChildIds: string[] = [];

      // Parcourir l'historique pour trouver les IDs d'enfants concernés par une notification
      for (const [childId, history] of historyMap.entries()) {
        // Alerte maladie
        if (history.length > 0 && history[0] === "SICK") {
          if (!notifiedSickKeys.includes(childId)) {
            sickChildIds.push(childId);
          }
        }

        // Alerte absence prolongée (3 semaines consécutives)
        if (history.length >= 3 && history.slice(0, 3).every(s => s === "ABSENT")) {
          if (!notifiedAbsKeys.includes(childId)) {
            absChildIds.push(childId);
          }
        }
      }

      // Récupérer en bloc (bulkGet) les détails des enfants pour les maladies
      if (sickChildIds.length > 0) {
        const children = await db.children.bulkGet(sickChildIds);
        for (const child of children) {
          if (child) {
            hasNewSick = true;
            notifiedSickKeys.push(child.id);
            sendLocalPush("Enfant malade", `${child.firstName} ${child.lastName} a été signalé(e) malade récemment.`);
          }
        }
      }

      // Récupérer en bloc (bulkGet) les détails des enfants pour les absences prolongées
      if (absChildIds.length > 0) {
        const children = await db.children.bulkGet(absChildIds);
        for (const child of children) {
          if (child) {
            hasNewAbs = true;
            notifiedAbsKeys.push(child.id);
            sendLocalPush("Absence prolongée", `${child.firstName} ${child.lastName} est absent(e) depuis 3 semaines. Pensez à appeler.`);
          }
        }
      }

      if (hasNewSick) localStorage.setItem(sickKey, JSON.stringify(notifiedSickKeys));
      if (hasNewAbs) localStorage.setItem(absKey, JSON.stringify(notifiedAbsKeys));
    };

    void checkNotifications();
  }, [historyMap]);

  return null;
}
