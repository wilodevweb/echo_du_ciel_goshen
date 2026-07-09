import React, { type FormEvent } from "react";
import Image from "next/image";
import { Crown, Phone, Smile } from "lucide-react";
import type { AttendanceStatus, Child } from "@/lib/db";
import db, { CLASS_LEVELS, getClassLabel, getClassNumber } from "@/lib/db";
import { formatDisplayName, getHistoryDotClass, uploadChildPhoto } from "./utils";
import { Card, CardContent } from "@/components/ui/Card";
import type { NewChildForm } from "./types";
import { SelectionButtonGroup } from "./SelectionButtonGroup";

function StatusButton({
  label,
  colorClass,
  active,
  onClick,
  disabled = false,
}: {
  label: string;
  colorClass: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`h-12 rounded-2xl px-3 text-sm font-black shadow-sm transition-all ${colorClass} ${
        active ? "scale-[1.02] opacity-100 ring-2 ring-white/80" : "opacity-55"
      } ${
        disabled ? "opacity-20 cursor-not-allowed scale-100 pointer-events-none" : ""
      }`}
    >
      {label}
    </button>
  );
}

function CardActionButton({
  label,
  onClick,
  disabled,
  href,
  isSubmitting,
}: {
  label: React.ReactNode;
  onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  href?: string;
  isSubmitting?: boolean;
}) {
  const className = `flex h-12 w-full items-center justify-center rounded-2xl px-3 text-sm font-black shadow-sm transition-all ${
    !disabled
      ? "bg-fiverr text-white hover:bg-fiverr-dark active:scale-[0.98]"
      : "bg-gray-500 text-white opacity-40 cursor-not-allowed"
  }`;

  if (href) {
    return (
      <a
        href={href}
        onClick={(e) => {
          if (disabled) e.preventDefault();
          else if (onClick) onClick(e);
        }}
        className={className}
      >
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isSubmitting}
      onClick={onClick}
      className={className}
    >
      {isSubmitting ? "Enregistrement..." : label}
    </button>
  );
}

export function ChildNameDisplay({
  firstName,
  lastName,
  postName,
  onClick,
}: {
  firstName: string;
  lastName: string;
  postName: string;
  onClick?: () => void;
}) {
  const displayLastName = formatDisplayName(lastName, "upper");
  const displayPostName = formatDisplayName(postName, "upper");
  const displayFirstName = formatDisplayName(firstName, "first");

  const inner = (
    <h2 className="flex flex-col items-center gap-0.5 text-[1.35rem] leading-[1.02] tracking-tight text-[#111827]">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="font-black uppercase">{displayLastName || "NOM"}</span>
        {displayPostName && <span className="font-black uppercase">{displayPostName}</span>}
      </div>
      <span className="font-light capitalize">{displayFirstName || "Prénom"}</span>
    </h2>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mx-auto w-full rounded-[22px] bg-white px-4 py-3 shadow-md transition-colors hover:bg-gray-100"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="mx-auto w-full rounded-[22px] bg-white px-4 py-3 shadow-md text-[#111827]">
      {inner}
    </div>
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
      onSubmit: () => void;
    };

export const PointageCard = React.memo(function PointageCard(props: PointageCardProps) {
  if (props.mode === "attendance") {
    const { child, status, recentStatuses, hasBirthdayThisWeek, onNameClick, onSetStatus } = props;

    return (
      <BaseCardLayout
        header={
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">
              {getClassLabel(child.classLevel)}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
              {[3, 2, 1, 0].map((index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full ${getHistoryDotClass(recentStatuses[index])}`}
                />
              ))}
            </div>
          </div>
        }
        avatar={
          <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[#d7efe8]/90">
            {hasBirthdayThisWeek && (
              <div className="absolute -top-7 left-1/2 z-10 flex -translate-x-1/2 rotate-[-8deg] items-center justify-center rounded-full bg-yellow-300 p-2 text-[#1b1b1b] shadow-lg ring-4 ring-[#1b1b1b]">
                <Crown className="h-8 w-8 fill-yellow-300" />
              </div>
            )}
            <div className="h-36 w-36 overflow-hidden rounded-full bg-gradient-to-tr from-[#342ee8]/20 to-fiverr/30 border-[6px] border-white/10 shadow-inner flex items-center justify-center">
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
                <Smile className="h-16 w-16 text-[#342ee8]/40" strokeWidth={1.5} />
              )}
            </div>
            <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#342ee8] text-2xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
              {getClassNumber(child.classLevel)}
            </div>
          </div>
        }
        nameBox={
          <ChildNameDisplay 
            firstName={child.firstName} 
            lastName={child.lastName} 
            postName={child.postName} 
            onClick={onNameClick} 
          />
        }
        body={
          <>
            <div className="sr-only">
              <a href={`tel:${child.parentPhone}`} className="flex items-center gap-2 font-semibold">
                <Phone className="h-4 w-4 text-fiverr" />
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
  }  if (props.mode === "profile") {
    const { child, onNameClick, onPhotoChange } = props;
    const parentName = (child.parentFirstName || child.parentLastName)
      ? `${child.parentFirstName} ${child.parentLastName}`.trim()
      : "le parent";

    return (
      <BaseCardLayout
        header={
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">
              {getClassLabel(child.classLevel)}
            </div>
            <div className="text-[10px] uppercase font-black text-white/45 tracking-widest">
              Profil de l&apos;enfant
            </div>
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
            <div className="h-36 w-36 overflow-hidden rounded-full bg-gradient-to-tr from-[#342ee8]/20 to-fiverr/30 border-[6px] border-white/10 shadow-inner flex items-center justify-center">
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
                <Smile className="h-16 w-16 text-[#342ee8]/40" strokeWidth={1.5} />
              )}
            </div>
            <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#342ee8] text-2xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
              {getClassNumber(child.classLevel)}
            </div>
          </label>
        }
        nameBox={
          <ChildNameDisplay 
            firstName={child.firstName} 
            lastName={child.lastName} 
            postName={child.postName} 
            onClick={onNameClick} 
          />
        }
        body={
          <>
            {(child.parentPhone || child.address || child.notes) && (
              <div className="mb-4 space-y-1.5 rounded-[22px] bg-white/5 p-4 text-left text-xs text-white/80">
                {child.parentPhone && <p className="truncate">📞 {child.parentPhone}</p>}
                {child.address && <p className="truncate">📍 {child.address}</p>}
                {child.notes && <p className="line-clamp-2">📝 {child.notes}</p>}
              </div>
            )}

            <CardActionButton
              href={`tel:${child.parentPhone}`}
              disabled={!child.parentPhone}
              label={`Appeler ${parentName}`}
            />
          </>
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
      header={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
            Classe :
          </span>
          <div className="min-w-0 flex-1">
            <SelectionButtonGroup
              options={CLASS_LEVELS.map((level) => ({
                value: level.value,
                label: getClassLabel(level.value),
              }))}
              value={value.classLevel}
              onChange={(nextClassLevel) => update("classLevel", nextClassLevel)}
              columns={3}
              compact
            />
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
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                try {
                  const photoUrl = await uploadChildPhoto(file);
                  onChange({ ...value, photoUrl });
                } catch (error) {
                  console.error("Erreur lors du téléversement de la photo", error);
                  alert(error instanceof Error ? error.message : "Le téléversement de la photo a échoué.");
                }
              }
              event.currentTarget.value = "";
            }}
          />
          <div className="h-36 w-36 overflow-hidden rounded-full bg-gradient-to-tr from-fiverr/20 to-purple-500/20 border-4 border-[#1b1b1b]/10 flex items-center justify-center">
            {value.photoUrl ? (
              <Image
                src={value.photoUrl}
                alt="Photo du nouvel enfant"
                width={144}
                height={144}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <Smile className="h-16 w-16 text-fiverr/60" strokeWidth={1.5} />
            )}
          </div>
          <div className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#342ee8] text-2xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
            {getClassNumber(value.classLevel)}
          </div>
        </label>
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
              placeholder="POST-NOM"
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
        <CardActionButton
          onClick={onSubmit}
          disabled={!canAdd}
          isSubmitting={isAdding}
          label="Enregistrer"
        />
      }
    />
  );
});
