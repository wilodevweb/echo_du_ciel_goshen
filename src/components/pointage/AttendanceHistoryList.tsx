import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { getStatusLabel } from "@/lib/db";
import { Loader2, Calendar as CalendarIcon, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface AttendanceHistoryListProps {
  childId: string;
}

export function AttendanceHistoryList({ childId }: AttendanceHistoryListProps) {
  const attendances = useLiveQuery(async () => {
    // Fetch all attendances for this child, sorted by date descending
    const records = await db.attendances
      .where('childId')
      .equals(childId)
      .toArray();
      
    return records.sort((a, b) => b.date.localeCompare(a.date));
  }, [childId]);

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

  const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
  const absentCount = attendances.filter(a => a.status === 'ABSENT').length;
  const sickCount = attendances.filter(a => a.status === 'SICK').length;

  return (
    <div className="mt-4">
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{presentCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-green-400/70 font-semibold">Présences</p>
        </div>
        <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{absentCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-red-400/70 font-semibold">Absences</p>
        </div>
        <div className="flex-1 bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{sickCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-yellow-400/70 font-semibold">Maladies</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
        {attendances.map((record) => {
          const dateObj = new Date(record.date);
          const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });

          let Icon = XCircle;
          let colorClass = "text-red-400 bg-red-500/10 border-red-500/20";
          
          if (record.status === 'PRESENT') {
            Icon = CheckCircle2;
            colorClass = "text-green-400 bg-green-500/10 border-green-500/20";
          } else if (record.status === 'SICK') {
            Icon = AlertCircle;
            colorClass = "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
          }

          return (
            <div 
              key={record.id} 
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${colorClass}`}>
                <Icon className="h-5 w-5" />
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
    </div>
  );
}
