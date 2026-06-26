"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, ArrowLeft, Gift, UserX, Phone, AlertCircle, Stethoscope } from 'lucide-react';
import db, { getClassLabel, Child } from '@/lib/db';
import { buildAttendanceHistoryMap } from '@/components/pointage/utils';
import { Card, CardContent } from '@/components/ui/Card';

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
  const allChildren = useLiveQuery(() => db.children.toArray());
  const allAttendances = useLiveQuery(() => db.attendances.toArray());

  const notifications = useMemo(() => {
    if (!allChildren || !allAttendances) return null;

    const historyMap = buildAttendanceHistoryMap(allAttendances);

    const birthdays: Child[] = [];
    const absences: Child[] = [];
    const sick: Child[] = [];
    const incomplete: Child[] = [];

    for (const child of allChildren) {
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
  }, [allChildren, allAttendances]);

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-10 flex items-center shadow-md">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6" />
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
      </header>

      <div className="p-4 flex-1 space-y-6 max-w-md mx-auto w-full">
        {!notifications ? (
          <div className="text-center mt-10 text-gray-500">Chargement...</div>
        ) : (
          <>
            {/* Anniversaires */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-500" />
                Anniversaires (7 jours)
                <span className="bg-purple-100 text-purple-700 text-xs py-0.5 px-2 rounded-full font-semibold">
                  {notifications.birthdays.length}
                </span>
              </h2>
              {notifications.birthdays.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun anniversaire à venir.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.birthdays.map(child => (
                    <Card key={`bday-${child.id}`} padding="sm" className="border-l-4 border-l-purple-500">
                      <CardContent className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{getBirthdayMessage(child.birthDate, child.firstName)}</p>
                          <p className="text-xs text-gray-500">{getClassLabel(child.classLevel)} • {child.lastName} {child.postName}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Absences prolongées */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-500" />
                Absences prolongées (3+ sem.)
                <span className="bg-red-100 text-red-700 text-xs py-0.5 px-2 rounded-full font-semibold">
                  {notifications.absences.length}
                </span>
              </h2>
              {notifications.absences.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucune absence prolongée.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.absences.map(child => (
                    <Card key={`abs-${child.id}`} padding="sm" className="border-l-4 border-l-red-500">
                      <CardContent className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                          <p className="text-xs text-gray-500">{getClassLabel(child.classLevel)}</p>
                        </div>
                        {child.parentPhone && (
                          <a 
                            href={`tel:${child.parentPhone}`}
                            className="bg-red-100 p-2 rounded-full text-red-600 hover:bg-red-200"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Enfants malades */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-500" />
                Enfants malades (Dernier appel)
                <span className="bg-blue-100 text-blue-700 text-xs py-0.5 px-2 rounded-full font-semibold">
                  {notifications.sick.length}
                </span>
              </h2>
              {notifications.sick.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun enfant signalé malade.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.sick.map(child => (
                    <Card key={`sick-${child.id}`} padding="sm" className="border-l-4 border-l-blue-500">
                      <CardContent className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                          <p className="text-xs text-gray-500">{getClassLabel(child.classLevel)}</p>
                        </div>
                        {child.parentPhone && (
                          <a 
                            href={`tel:${child.parentPhone}`}
                            className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Profils incomplets */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Profils sans téléphone
                <span className="bg-orange-100 text-orange-700 text-xs py-0.5 px-2 rounded-full font-semibold">
                  {notifications.incomplete.length}
                </span>
              </h2>
              {notifications.incomplete.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Tous les profils ont un numéro.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.incomplete.map(child => (
                    <Card key={`inc-${child.id}`} padding="sm" className="border-l-4 border-l-orange-500">
                      <CardContent className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{child.firstName} {child.lastName}</p>
                          <p className="text-xs text-gray-500">{getClassLabel(child.classLevel)}</p>
                        </div>
                        <Link 
                          href="/enfants"
                          className="text-xs font-semibold text-orange-600 hover:underline"
                        >
                          Compléter
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
