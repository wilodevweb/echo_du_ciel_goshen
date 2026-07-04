"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import {
  CLASS_LEVELS,
  type Child,
  type ClassLevel,
  getClassLabel,
} from "@/lib/db";
import { AttendanceDateSelector, getMostRecentSundayDateString } from "@/components/attendance/AttendanceDateSelector";

export function ClassSelectionScreen({
  selectedDate,
  childList,
  selectedClasses,
  onDateChange,
  onToggleClass,
  onStart,
}: {
  selectedDate: string;
  childList?: Child[];
  selectedClasses: ClassLevel[];
  onDateChange: (value: string) => void;
  onToggleClass: (value: ClassLevel) => void;
  onStart: () => void;
}) {
  const countByClass = CLASS_LEVELS.reduce<Record<ClassLevel, number>>(
    (counts, level) => {
      counts[level.value] = childList?.filter((child) => child.classLevel === level.value).length ?? 0;
      return counts;
    },
    { FIRST: 0, SECOND: 0, THIRD: 0 },
  );
  const maxSunday = getMostRecentSundayDateString(new Date());
  const isFutureDate = selectedDate > maxSunday;

  return (
    <main className="flex min-h-screen flex-col bg-white px-5 py-5">
      <header className="mx-auto grid w-full max-w-md grid-cols-[44px_1fr_44px] items-center">
        <Link href="/" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <AttendanceDateSelector value={selectedDate} onChange={onDateChange} />
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-bold text-gray-950">Choisir la classe</h1>
          <p className="mt-2 text-base text-gray-500">Selectionne une ou plusieurs classes.</p>
        </div>

        <div className="grid gap-3">
          {CLASS_LEVELS.map((level) => {
            const isSelected = selectedClasses.includes(level.value);

            return (
              <button
                key={level.value}
                type="button"
                onClick={() => onToggleClass(level.value)}
                className={`flex h-16 items-center justify-between rounded-lg border px-5 text-left text-lg font-bold shadow-sm transition-colors ${
                  isSelected
                    ? "border-fiverr bg-fiverr/10 text-gray-950"
                    : "border-gray-200 bg-gray-50 text-gray-950 hover:border-fiverr hover:bg-fiverr/5"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                    isSelected ? "border-fiverr bg-fiverr text-white" : "border-gray-300"
                  }`}>
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                  {getClassLabel(level.value)}
                </span>
                <span className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-fiverr">
                  {countByClass[level.value]}
                </span>
              </button>
            );
          })}
        </div>

        {isFutureDate && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-center text-sm font-semibold text-red-600">
            Le pointage pour le dimanche prochain ({selectedDate}) ou une date future est refusé car il n&apos;est pas encore ouvert.
          </div>
        )}

        <button
          type="button"
          disabled={selectedClasses.length === 0 || isFutureDate}
          onClick={onStart}
          className="mt-5 h-14 rounded-lg bg-fiverr text-base font-bold text-white shadow-sm disabled:bg-gray-200 disabled:text-gray-400"
        >
          Commencer l&apos;appel
        </button>
      </section>
    </main>
  );
}
