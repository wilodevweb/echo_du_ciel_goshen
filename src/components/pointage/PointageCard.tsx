import React, { FormEvent } from "react";
import Image from "next/image";
import { Calendar, Crown, MapPin, NotebookText, Phone, User } from "lucide-react";
import type { AttendanceStatus, Child } from "@/lib/db";
import db, { CLASS_LEVELS, getClassLabel, getClassNumber } from "@/lib/db";
import { getHistoryDotClass } from "./utils";
import { Card, CardContent } from "@/components/ui/Card";
import type { NewChildForm } from "./types";

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

// Composant de base partagé pour toutes les cartes de pointage
export function BaseCardLayout({
  header,
  avatar,
  nameBox,
  body,
  onSubmit,
}: {
  header: React.ReactNode;
  avatar: React.ReactNode;
  nameBox: React.ReactNode;
  body: React.ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const content = (
    <CardContent className="relative px-5 pb-5 pt-3 text-white">
      <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-white/45" />
      <div className="mb-4">{header}</div>
      <div className="mb-4 flex justify-center">{avatar}</div>
      <div className="mb-5 text-center">{nameBox}</div>
      <div>{body}</div>
    </CardContent>
  );

  return (
    <Card padding="none" className="w-full overflow-hidden rounded-[28px] border-0 bg-[#1b1b1b]">
      {onSubmit ? <form onSubmit={onSubmit} className="flex flex-col">{content}</form> : content}
    </Card>
  );
}

export type PointageCardProps =
  | {
      mode: "attendance";
      child: Child;
      status: AttendanceStatus | null;
      recentStatuses: AttendanceStatus[];
      hasBirthdayThisWeek: boolean;
      onNameClick: () => void;
      onPhotoChange: (file: File) => Promise<void>;
      onSetStatus: (status: AttendanceStatus) => void;
    }
  | {
      mode: "profile";
      child: Child;
      onNameClick: () => void;
      onPhotoChange?: (file: File) => Promise<void>;
    }
  | {
      mode: "add";
      value: NewChildForm;
      isAdding: boolean;
      onChange: (value: NewChildForm) => void;
      onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    };

export function PointageCard(props: PointageCardProps) {
  if (props.mode === "attendance") {
    const { child, status, recentStatuses, hasBirthdayThisWeek, onNameClick, onPhotoChange, onSetStatus } = props;

    return (
      <BaseCardLayout
        header={
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">
              {getClassLabel(child.classLevel)}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
              {[2, 1, 0].map((index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full ${getHistoryDotClass(recentStatuses[index])}`}
                />
              ))}
            </div>
          </div>
        }
        avatar={
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
        }
        nameBox={
          <button
            type="button"
            onClick={onNameClick}
            className="mx-auto w-full rounded-[22px] bg-white px-4 py-3 transition-colors hover:bg-gray-100"
          >
            <h2 className="flex flex-col items-center gap-0.5 text-[1.35rem] leading-[1.02] tracking-tight text-[#111827]">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="font-black uppercase">{child.lastName}</span>
                <span className="font-black uppercase">{child.postName}</span>
              </div>
              <span className="font-normal capitalize">{child.firstName}</span>
            </h2>
          </button>
        }
        body={
          <>
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
          </>
        }
      />
    );
  }

  if (props.mode === "profile") {
    const { child, onNameClick, onPhotoChange } = props;

    return (
      <BaseCardLayout
        header={
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">
              {getClassLabel(child.classLevel)}
            </div>
            <a
              href={`tel:${child.parentPhone}`}
              className="flex items-center gap-1.5 rounded-full bg-[#00b22d]/20 px-3 py-1 text-xs font-bold text-[#00b22d] transition-colors hover:bg-[#00b22d] hover:text-white"
            >
              <Phone className="h-3.5 w-3.5" />
              Appeler
            </a>
          </div>
        }
        avatar={
          <label className={`relative flex h-44 w-44 items-center justify-center rounded-full bg-[#d7efe8]/90 ${onPhotoChange ? "cursor-pointer" : ""}`}>
            {onPhotoChange && (
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
        }
        nameBox={
          <button
            type="button"
            onClick={onNameClick}
            className="mx-auto w-full rounded-[22px] bg-white px-4 py-3 shadow-md transition-colors hover:bg-gray-100"
          >
            <h2 className="flex flex-col items-center gap-0.5 text-[1.35rem] leading-[1.02] tracking-tight text-[#111827]">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="font-black uppercase">{child.lastName}</span>
                <span className="font-black uppercase">{child.postName}</span>
              </div>
              <span className="font-normal capitalize">{child.firstName}</span>
            </h2>
          </button>
        }
        body={
          <div className="space-y-4">
            <div className="space-y-3.5 rounded-[22px] bg-white/5 p-4 text-left">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-[#00b22d]" />
                <a href={`tel:${child.parentPhone}`} className="text-sm font-semibold text-white hover:underline">
                  {child.parentPhone || "Téléphone non renseigné"}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 shrink-0 text-white/60" />
                <span className="text-sm text-white/90">{child.address || "Adresse non renseignée"}</span>
              </div>
              {child.birthDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 shrink-0 text-white/60" />
                  <span className="text-sm text-white/90">{child.birthDate}</span>
                </div>
              )}
              {child.notes && (
                <div className="flex items-start gap-3">
                  <NotebookText className="h-5 w-5 shrink-0 text-white/60 mt-0.5" />
                  <span className="text-sm text-white/80">{child.notes}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onNameClick}
              className="h-12 w-full rounded-[22px] bg-white/10 text-sm font-bold text-white transition-all hover:bg-white/20"
            >
              Voir / Modifier la fiche
            </button>
          </div>
        }
      />
    );
  }

  // mode === "add"
  const { value, isAdding, onChange, onSubmit } = props;
  const update = async (field: keyof NewChildForm, fieldValue: string) => {
    let nextValue = { ...value, [field]: fieldValue };
    
    if (field === 'parentPhone') {
      const phone = fieldValue.trim();
      if (phone.length >= 4) {
        const match = await db.children.where('parentPhone').equals(phone).first();
        if (match) {
          nextValue = {
            ...nextValue,
            parentFirstName: nextValue.parentFirstName || match.parentFirstName || '',
            parentLastName: nextValue.parentLastName || match.parentLastName || '',
            address: nextValue.address || match.address || '',
          };
        }
      }
    }
    onChange(nextValue);
  };

  const canAdd = Boolean(
    value.firstName.trim() &&
      value.lastName.trim()
  );

  return (
    <BaseCardLayout
      onSubmit={onSubmit}
      header={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
            Classe :
          </span>
          <div className="flex gap-1">
            {CLASS_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => update("classLevel", level.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                  value.classLevel === level.value
                    ? "bg-white text-[#1b1b1b]"
                    : "bg-white/8 text-white/60 hover:bg-white/15"
                }`}
              >
                {getClassLabel(level.value)}
              </button>
            ))}
          </div>
        </div>
      }
      avatar={
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-white/8 text-white/55">
          <User className="h-16 w-16 text-white/40" />
          <div className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-[#00b22d] text-xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
            +
          </div>
        </div>
      }
      nameBox={
        <div className="mx-auto w-full rounded-[22px] bg-white px-4 py-3 text-[#111827]">
          <div className="flex flex-col gap-1.5">
            <input
              required
              value={value.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              placeholder="NOM"
              className="w-full border-b border-gray-100 py-1 text-center text-lg font-black uppercase text-[#111827] outline-none placeholder:text-gray-300"
            />
            <input
              value={value.postName}
              onChange={(event) => update("postName", event.target.value)}
              placeholder="POST-NOM (Optionnel)"
              className="w-full border-b border-gray-100 py-1 text-center text-lg font-black uppercase text-[#111827] outline-none placeholder:text-gray-300"
            />
            <input
              required
              value={value.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              placeholder="Prénom"
              className="w-full py-1 text-center text-lg font-bold text-[#111827] outline-none placeholder:text-gray-300"
            />
          </div>
        </div>
      }
      body={
        <button
          type="submit"
          disabled={!canAdd || isAdding}
          className="h-14 w-full rounded-[22px] bg-[#00b22d] text-base font-bold text-white shadow-lg transition-all hover:bg-[#009e27] active:scale-[0.98] disabled:cursor-not-allowed disabled:scale-100 disabled:bg-white/10 disabled:text-white/40"
        >
          {isAdding ? "Ajout en cours..." : "+ Ajouter l'enfant"}
        </button>
      }
    />
  );
}
