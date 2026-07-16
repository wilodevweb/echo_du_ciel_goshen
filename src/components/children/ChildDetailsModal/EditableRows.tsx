import React from "react";
import type { ClassLevel } from "@/lib/db";
import { CLASS_LEVELS, getClassLabel } from "@/lib/db";
import { SelectionButtonGroup } from "@/components/pointage/SelectionButtonGroup";

export function DetailPill({
  label,
  colorClass,
  active,
}: {
  label: string;
  colorClass: string;
  active: boolean;
}) {
  return (
    <div className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
      active ? "bg-white text-[#1b1b1b]" : "bg-white/8 text-white/65"
    }`}>
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      {label}
    </div>
  );
}

export function EditableDetailRow({
  icon,
  title,
  value,
  placeholder,
  isEditing,
  onEdit,
  onChange,
  inputType = "text",
  multiline = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  placeholder: string;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: string) => void;
  inputType?: "text" | "tel" | "date";
  multiline?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
      className="flex w-full gap-4 text-left"
    >
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-white">{title}</p>
        {isEditing ? (
          multiline ? (
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              autoFocus
              rows={2}
              className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-base leading-snug text-white placeholder:text-white/30 outline-none"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <input
              type={inputType}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              autoFocus
              className="mt-1 w-full border-0 bg-transparent p-0 text-base leading-snug text-white placeholder:text-white/30 outline-none"
              onClick={(event) => event.stopPropagation()}
            />
          )
        ) : (
          <p className="mt-1 line-clamp-2 text-base leading-snug text-white/55">
            {value || placeholder}
          </p>
        )}
      </div>
    </div>
  );
}

export function EditableClassRow({
  icon,
  title,
  value,
  isEditing,
  onEdit,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: ClassLevel;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: ClassLevel) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
      className="flex w-full gap-4 text-left"
    >
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight text-white">{title}</p>
        {isEditing ? (
          <div className="mt-2">
            <SelectionButtonGroup
              options={CLASS_LEVELS.map((level) => ({
                value: level.value,
                label: getClassLabel(level.value),
              }))}
              value={value}
              onChange={onChange}
              columns={3}
              compact
            />
          </div>
        ) : (
          <p className="mt-1 text-base leading-snug text-white/55">{getClassLabel(value)}</p>
        )}
      </div>
    </div>
  );
}

export function EditableGenderRow({
  icon,
  title,
  value,
  isEditing,
  onEdit,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: 'M' | 'F';
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: 'M' | 'F') => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
      className="flex items-start gap-4 text-left"
    >
      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/85">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight text-white">{title}</p>
        {isEditing ? (
          <div className="mt-2">
            <SelectionButtonGroup
              options={[
                { value: "M", label: "Garçon" },
                { value: "F", label: "Fille" },
              ]}
              value={value}
              onChange={onChange}
              columns={2}
              compact
            />
          </div>
        ) : (
          <p className="mt-1 text-base leading-snug text-white/55">
            {value === 'M' ? 'Garçon (M)' : 'Fille (F)'}
          </p>
        )}
      </div>
    </div>
  );
}
