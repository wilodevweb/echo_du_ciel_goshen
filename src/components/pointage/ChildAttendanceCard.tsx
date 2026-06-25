import React from "react";
import Image from "next/image";
import { Crown, Phone, User } from "lucide-react";
import type { AttendanceStatus, Child } from "@/lib/db";
import { getClassLabel, getClassNumber } from "@/lib/db";
import { getHistoryDotClass } from "./utils";
import { Card, CardContent } from "@/components/ui/Card";

function StatusButton({
  label,
  colorClass,
  active,
  onClick,
}: {
  label: string;
  colorClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`h-12 rounded-2xl px-3 text-sm font-black shadow-sm transition-all ${colorClass} ${
        active ? "scale-[1.02] opacity-100 ring-2 ring-white/80" : "opacity-55"
      }`}
    >
      {label}
    </button>
  );
}

export function ChildAttendanceCard({
  child,
  status,
  recentStatuses,
  hasBirthdayThisWeek,
  onNameClick,
  onPhotoChange,
  onSetStatus,
}: {
  child: Child;
  status: AttendanceStatus | null;
  recentStatuses: AttendanceStatus[];
  hasBirthdayThisWeek: boolean;
  onNameClick: () => void;
  onPhotoChange: (file: File) => Promise<void>;
  onSetStatus: (status: AttendanceStatus) => void;
}) {
  return (
    <Card padding="none" className="w-full overflow-hidden rounded-[28px] border-0 bg-[#1b1b1b] shadow-2xl">
      <CardContent className="relative px-5 pb-5 pt-3 text-white">
        <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-white/45" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">
            {getClassLabel(child.classLevel)}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full ${getHistoryDotClass(recentStatuses[index])}`}
              />
            ))}
          </div>
        </div>

        <div className="mb-4 flex justify-center">
          <label className="relative flex h-44 w-44 cursor-pointer items-center justify-center rounded-full bg-[#d7efe8]/90">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onPhotoChange(file);
                event.currentTarget.value = "";
              }}
            />
            {hasBirthdayThisWeek && (
              <div className="absolute -top-7 left-1/2 z-10 flex -translate-x-1/2 rotate-[-8deg] items-center justify-center rounded-full bg-yellow-300 p-2 text-[#1b1b1b] shadow-lg ring-4 ring-[#1b1b1b]">
                <Crown className="h-8 w-8 fill-yellow-300" />
              </div>
            )}
            <div className="h-36 w-36 overflow-hidden rounded-full bg-white/35">
              {child.photoUrl ? (
                <Image
                  src={child.photoUrl}
                  alt={`${child.lastName} ${child.postName} ${child.firstName}`}
                  width={144}
                  height={144}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-14 w-14 text-[#1b1b1b]/45" />
                </div>
              )}
            </div>
            <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#342ee8] text-2xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
              {getClassNumber(child.classLevel)}
            </div>
          </label>
        </div>

        <div className="mb-5 text-center">
          <button
            type="button"
            onClick={onNameClick}
            className="mx-auto w-full rounded-[22px] bg-white px-4 py-3"
          >
            <h2 className="flex flex-col items-center gap-0.5 text-[1.35rem] leading-[1.02] tracking-tight text-[#111827]">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="font-black uppercase">{child.lastName}</span>
                <span className="font-black uppercase">{child.postName}</span>
              </div>
              <span className="font-normal capitalize">{child.firstName}</span>
            </h2>
          </button>
        </div>

        <div className="sr-only">
          <a href={`tel:${child.parentPhone}`} className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4 text-[#00b22d]" />
            {child.parentPhone || "Telephone parent"}
          </a>
          {child.notes && <p className="line-clamp-2">{child.notes}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-white/7 p-2">
          <StatusButton
            label="Malade"
            colorClass="bg-yellow-400 text-[#1b1b1b]"
            active={status === "SICK"}
            onClick={() => onSetStatus("SICK")}
          />
          <StatusButton
            label="Absent"
            colorClass="bg-red-500 text-white"
            active={status === "ABSENT"}
            onClick={() => onSetStatus("ABSENT")}
          />
          <StatusButton
            label="Présent"
            colorClass="bg-green-500 text-white col-span-2"
            active={status === "PRESENT"}
            onClick={() => onSetStatus("PRESENT")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
