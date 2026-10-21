"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthUser } from '@/hooks/useAuthUser';
import { Archive, ArrowLeft, ArrowRightCircle, AlertCircle, CheckCheck, Gift, Phone, Stethoscope, UserX } from 'lucide-react';
import db, { getClassLabel, isDeletedChildRecord, type Child, type ClassLevel, markEntityForSync } from '@/lib/db';
import { buildAttendanceHistoryMapAsync } from '@/components/pointage/utils';
import { LoadingState } from '@/components/ui/LoadingState';

function isBirthdaySoon(birthDate: string | undefined | null) {
  if (!birthDate) return false;
  const parts = birthDate.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [year, month, day] = parts;
  if (!year || !month || !day) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
  const bdayNextYear = new Date(today.getFullYear() + 1, month - 1, day);
  
  const diffThisYear = Math.round((bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const diffNextYear = Math.round((bdayNextYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
  
  return (diffThisYear >= -2 && diffThisYear <= 7) || (diffNextYear >= -2 && diffNextYear <= 7);
}

function getTargetAge(birthDate: string | undefined | null) {
  if (!birthDate) return null;
  const parts = birthDate.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let diffDays = Math.round((bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
  let targetAge = today.getFullYear() - year;
  
  if (diffDays < -2) {
    const bdayNextYear = new Date(today.getFullYear() + 1, month - 1, day);
    diffDays = Math.round((bdayNextYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
    targetAge = today.getFullYear() + 1 - year;
  }
  
  return targetAge;
}

function getExpectedClass(targetAge: number | null): ClassLevel | 'ARCHIVED' | null {
  if (targetAge === null) return null;
  if (targetAge >= 4 && targetAge < 8) return 'FIRST';
  if (targetAge >= 8 && targetAge < 12) return 'SECOND';
  if (targetAge >= 12 && targetAge <= 15) return 'THIRD';
  if (targetAge > 15) return 'ARCHIVED';
  return null;
}

function getBirthdayMessage(birthDate: string | undefined | null, firstName: string) {
  if (!birthDate) return "";
  const parts = birthDate.split("-").map(Number);
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let diffDays = Math.round((bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
  let targetAge = today.getFullYear() - year;
  
  if (diffDays < -2) {
    const bdayNextYear = new Date(today.getFullYear() + 1, month - 1, day);
    diffDays = Math.round((bdayNextYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
    targetAge = today.getFullYear() + 1 - year;
  }

  const ageStr = targetAge > 0 ? ` ${targetAge} ans` : "";

  if (diffDays === 0) return `C'est l'anniversaire de ${firstName} aujourd'hui ! 🎂`;
  if (diffDays === -1) return `${firstName} a eu${ageStr} hier 🎈`;
  if (diffDays === -2) return `${firstName} a eu${ageStr} avant-hier`;
  if (diffDays === 1) return `${firstName} aura${ageStr} demain !`;
  
  if (diffDays > 1 && diffDays <= 7) {
    const bdayDate = new Date(today.getTime() + diffDays * 24 * 3600 * 1000);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayName = days[bdayDate.getDay()];
    return `${firstName} aura${ageStr} ce ${dayName}`;
  }
  
  return `Anniversaire le ${day}/${month}`;
}

export default function NotificationsPage() {
  const { isAdmin } = useAuthUser();

  const [transferRequest, setTransferRequest] = useState<{ childId: string; childName: string; classLevel: ClassLevel } | null>(null);
  const [readAll, setReadAll] = useState(false);
  const allChildren = useLiveQuery(() => db.children.toArray());
  const historyMap = useLiveQuery(() => buildAttendanceHistoryMapAsync());

  const handleTransfer = async (childId: string, newClass: ClassLevel) => {
    if (!isAdmin) return;
    await db.children.update(childId, { classLevel: newClass });
    await markEntityForSync('child', childId, ['classLevel']);
  };

  const handleArchive = async (child: Child) => {
    if (!isAdmin) return;
    const newNotes = (child.notes || "") + "\n[ARCHIVE]";
    await db.children.update(child.id, { notes: newNotes.trim() });
    await markEntityForSync('child', child.id, ['notes']);
  };

  const notifications = useMemo(() => {
    if (!allChildren || !historyMap) return null;

    const birthdays: Child[] = [];
    const absences: Child[] = [];
    const sick: Child[] = [];
    const incomplete: Child[] = [];

    for (const child of allChildren) {
      if (isDeletedChildRecord(child)) continue;

      // 1. Anniversaires (dans les 7 prochains jours)
      if (isBirthdaySoon(child.birthDate)) {
        birthdays.push(child);
      }

      const history = historyMap.get(child.id) || [];
      
      // 2. Absences prolongées (3 derniers dimanches = ABSENT)
      if (history.length >= 3 && history.slice(0, 3).every(status => status === "ABSENT")) {
        absences.push(child);
      }

      // 3. Malades (Dernier statut = SICK)
      if (history.length > 0 && history[0] === "SICK") {
        sick.push(child);
      }

      // 4. Profils incomplets (pas de téléphone parent)
      if (!child.parentPhone || child.parentPhone.trim() === "") {
        incomplete.push(child);
      }
    }

    return { birthdays, absences, sick, incomplete };
  }, [allChildren, historyMap]);

  const groups = notifications ? [
    { id: 'birthdays', title: 'Anniversaires (7 jours)', icon: Gift, tone: 'gold', items: notifications.birthdays },
    { id: 'absences', title: 'Absences prolongées', icon: UserX, tone: 'blue', items: notifications.absences },
    { id: 'sick', title: 'Enfants malades', icon: Stethoscope, tone: 'green', items: notifications.sick },
    { id: 'incomplete', title: 'Profils sans téléphone', icon: AlertCircle, tone: 'muted', items: notifications.incomplete },
  ] as const : [];
  const unreadCount = readAll ? 0 : new Set(groups.flatMap(group => group.items.map(child => child.id))).size;

  return (
    <main className="min-h-dvh bg-[#0d1410] px-5 pb-10 text-[#e7ece8]">
      <div className="mx-auto w-full max-w-3xl pt-14">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Retour à l’accueil" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#39463e] bg-[#19231d]"><ArrowLeft className="h-6 w-6" /></Link>
          <button type="button" aria-label="Tout marquer comme lu" onClick={() => setReadAll(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#39463e] bg-[#19231d]"><CheckCheck className="h-6 w-6" /></button>
        </div>
        <header className="mt-2 flex flex-col items-center text-center">
          <p className="text-[11px] font-bold tracking-[0.17em] text-[#8d9f93]">ÉCHO DU CIEL · GOSHEN</p>
          <h1 className="mt-2 text-[40px] font-bold leading-[49px]">Notifications</h1>
          <p className="mt-1 text-sm text-[#a7b2aa]">{unreadCount} {unreadCount === 1 ? "non lue" : "non lues"}</p>
        </header>

        {!notifications ? <LoadingState message="Chargement des notifications..." /> : groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#a7b2aa]">Aucune notification à afficher.</p>
        ) : <div className="mt-6 space-y-5">
          {groups.filter(group => group.items.length > 0).map(group => {
            const Icon = group.icon;
            return <section key={group.id}>
              <h2 className="mb-2.5 mt-5 text-[13px] font-bold tracking-[0.09em] text-[#8d9f93]">{group.title.toLocaleUpperCase("fr-FR")}</h2>
              {group.items.map(child => {
                const targetAge = group.id === "birthdays" ? getTargetAge(child.birthDate) : null;
                const expectedClass = group.id === "birthdays" ? getExpectedClass(targetAge) : null;
                const needsChange = group.id === "birthdays" && expectedClass !== null && expectedClass !== child.classLevel && !child.notes?.includes("[ARCHIVE]");
                const title = group.id === "birthdays" ? getBirthdayMessage(child.birthDate, child.firstName) : `${child.firstName} ${child.lastName}`.trim();
                const detail = group.id === "birthdays"
                  ? `${getClassLabel(child.classLevel)} · ${child.lastName} ${child.postName}`.trim()
                  : group.id === "absences" ? `Absences répétées · ${getClassLabel(child.classLevel)}`
                  : group.id === "sick" ? `Signalé malade récemment · ${getClassLabel(child.classLevel)}`
                  : `Téléphone du responsable manquant · ${getClassLabel(child.classLevel)}`;
                return <article key={`${group.id}-${child.id}`} className="flex min-h-[76px] items-center gap-3 border-b border-[#26332b] py-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${group.tone === "gold" ? "border-[#5b5030] bg-[#332d16] text-[#f2cc65]" : group.tone === "blue" ? "border-[#3b4d66] bg-[#202e43] text-[#94bafa]" : group.tone === "green" ? "border-[#3f5a49] bg-[#1d3829] text-[#9cd9b1]" : "border-[#39463e] bg-[#222d27] text-[#c3ccc6]"}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[#e7ece8]">{title}</p>
                    <p className="text-[13px] leading-[18px] text-[#a7b2aa]">{detail}</p>
                    {needsChange && <div className="mt-2 rounded-xl bg-[#19231d] p-3">
                      <p className="text-xs font-semibold text-[#f2cc65]">{expectedClass === "ARCHIVED" ? `Âge limite atteint (${targetAge} ans). L'enfant doit quitter l'écodim.` : `Doit passer en ${getClassLabel(expectedClass as ClassLevel)} (${targetAge} ans).`}</p>
                      {isAdmin ? expectedClass === "ARCHIVED" ? <button onClick={() => void handleArchive(child)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#2e814b] px-3 py-2 text-xs font-bold text-white"><Archive className="h-3.5 w-3.5" />Archiver</button> : <button onClick={() => setTransferRequest({ childId: child.id, childName: `${child.firstName} ${child.lastName}`, classLevel: expectedClass as ClassLevel })} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#2e814b] px-3 py-2 text-xs font-bold text-white"><ArrowRightCircle className="h-4 w-4" />Transférer en {getClassLabel(expectedClass as ClassLevel)}</button> : <p className="mt-2 text-xs text-[#a7b2aa]">En attente de confirmation par un administrateur.</p>}
                    </div>}
                  </div>
                  <div className="ml-1 flex shrink-0 flex-col items-center gap-2">
                    {child.parentPhone && <a href={`tel:${child.parentPhone}`} aria-label={`Appeler ${child.parentName || "le parent"}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#222d27] text-[#a7b2aa]"><Phone className="h-4 w-4" /></a>}
                    {!readAll && <span aria-label="Non lue" className="h-2.5 w-2.5 rounded-full bg-[#2e814b]" />}
                    {group.id === "incomplete" && <Link href="/enfants" className="text-xs font-semibold text-[#95d2a8]">Compléter</Link>}
                  </div>
                </article>;
              })}
            </section>;
          })}
        </div>}
      </div>
      {transferRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" role="presentation" onClick={() => setTransferRequest(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="transfer-title" className="w-full max-w-sm rounded-3xl border border-[#39463e] bg-[#151e18] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 id="transfer-title" className="mb-2 text-lg font-bold text-[#e7ece8]">Confirmer le transfert</h2>
            <p className="mb-6 text-sm leading-relaxed text-[#a7b2aa]">Transférer {transferRequest.childName} en {getClassLabel(transferRequest.classLevel)} ? Le changement sera enregistré sur cet appareil et synchronisé automatiquement.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setTransferRequest(null)} className="flex-1 rounded-xl border border-[#39463e] py-3 text-sm font-semibold text-[#e7ece8]">Annuler</button>
              <button type="button" onClick={() => { const request = transferRequest; if (request) void handleTransfer(request.childId, request.classLevel).then(() => setTransferRequest(null)); }} className="flex-1 rounded-xl bg-[#2e814b] py-3 text-sm font-bold text-white">Confirmer</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
