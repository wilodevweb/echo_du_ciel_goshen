"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getMostRecentSundayDateString(date = new Date()) {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());

  return formatDateInput(sunday);
}

function moveByWeek(value: string, weeks: number) {
  const date = parseDateInput(value);
  date.setDate(date.getDate() + weeks * 7);

  return formatDateInput(date);
}

function formatSundayLabel(value: string) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDateInput(value));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function AttendanceDateSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectDate = (date: string) => {
    onChange(getMostRecentSundayDateString(parseDateInput(date)));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="mx-auto flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-center text-lg font-bold text-gray-950 transition-colors hover:bg-gray-100"
      >
        <CalendarDays className="h-5 w-5 text-[#00b22d]" />
        {formatSundayLabel(value)}
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-14 z-20 w-[min(92vw,360px)] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange(moveByWeek(value, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-center text-sm font-bold text-gray-900">{formatSundayLabel(value)}</p>
            <button
              type="button"
              onClick={() => onChange(moveByWeek(value, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <label className="mb-1 block text-xs font-semibold text-gray-500" htmlFor="attendance-date">
            Choisir une date
          </label>
          <input
            id="attendance-date"
            type="date"
            value={value}
            onChange={(event) => selectDate(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <button
            type="button"
            onClick={() => {
              onChange(getMostRecentSundayDateString());
              setIsOpen(false);
            }}
            className="mt-3 h-10 w-full rounded-lg bg-[#00b22d]/10 text-sm font-bold text-[#00b22d]"
          >
            Revenir au dimanche recent
          </button>
        </div>
      )}
    </div>
  );
}
