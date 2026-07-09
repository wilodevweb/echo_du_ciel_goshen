import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { getAttendanceStatus, getStatusLabel } from "@/lib/db";
import { Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { getHistoryDotClass } from "./utils";

interface AttendanceHistoryListProps {
  childId: string;
}

export function AttendanceHistoryList({ childId }: AttendanceHistoryListProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const attendances = useLiveQuery(async () => {
    // Fetch attendances for this child, using the compound index [childId+date]
    // The index allows us to get the records sorted by date descending naturally, without in-memory sorting
    const records = await db.attendances
      .where('[childId+date]')
      .between([childId, ''], [childId, '\uffff'])
      .reverse()
      .toArray();
      
    return records;
  }, [childId]);

  const visibleMonth = useMemo(() => {
    const latestAttendanceDate = attendances?.[0]?.date;
    const date = latestAttendanceDate ? new Date(latestAttendanceDate) : new Date();

    date.setDate(1);
    date.setMonth(date.getMonth() + monthOffset);
    return date;
  }, [attendances, monthOffset]);

  const visibleMonthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = visibleMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const visibleAttendances = (attendances ?? [])
    .filter((attendance) => attendance.date.startsWith(visibleMonthKey))
    .slice(0, 4);

  const handleTouchEnd = (endX: number) => {
    if (touchStartX === null) return;

    const delta = endX - touchStartX;
    if (Math.abs(delta) > 45) {
      setMonthOffset((offset) => {
        const nextOffset = offset + (delta > 0 ? -1 : 1);
        return Math.min(nextOffset, 0);
      });
    }
    setTouchStartX(null);
  };

  if (attendances === undefined) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (attendances.length === 0) {
    return (
      <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5 mt-4">
        <p className="text-sm text-white/50 font-medium">
          Aucun historique de pointage pour cet enfant.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-4 touch-pan-y"
      onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMonthOffset((offset) => offset - 1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/75 hover:bg-white/12"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-sm font-black capitalize text-white">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setMonthOffset((offset) => Math.min(offset + 1, 0))}
          disabled={monthOffset === 0}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/75 hover:bg-white/12 disabled:opacity-30"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[3, 2, 1, 0].map((index) => {
          const status = getAttendanceStatus(visibleAttendances[index]) ?? undefined;

          return (
            <span
              key={index}
              className={`h-2.5 rounded-full ${getHistoryDotClass(status)}`}
              aria-label={status ? getStatusLabel(status) : "Aucun appel"}
            />
          );
        })}
      </div>

      {visibleAttendances.length === 0 ? (
        <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5">
          <p className="text-sm text-white/50 font-medium">Aucun appel pour ce mois.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleAttendances.map((record) => {
            const dateObj = new Date(record.date);
            const formattedDate = dateObj.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
            const status = getAttendanceStatus(record) ?? undefined;

            return (
              <div 
                key={record.id} 
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <span className={`h-4 w-4 rounded-full ${getHistoryDotClass(status)}`} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold leading-tight text-white capitalize">
                    {formattedDate}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CalendarIcon className="w-3 h-3 text-white/40" />
                    <p className="text-xs font-medium text-white/55">
                      Statut : <span className="text-white/80">{getStatusLabel(record.status ?? null)}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
