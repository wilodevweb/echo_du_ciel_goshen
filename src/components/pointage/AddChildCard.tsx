import React, { FormEvent } from "react";
import { Calendar, MapPin, NotebookText, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CLASS_LEVELS, getClassLabel } from "@/lib/db";
import type { NewChildForm } from "./types";

export function AddChildCard({
  value,
  isAdding,
  onChange,
  onSubmit,
}: {
  value: NewChildForm;
  isAdding: boolean;
  onChange: (value: NewChildForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (field: keyof NewChildForm, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const canAdd = Boolean(
    value.firstName.trim() &&
    value.lastName.trim() &&
    value.postName.trim() &&
    value.parentPhone.trim() &&
    value.address.trim()
  );

  return (
    <Card padding="none" className="w-full overflow-hidden rounded-[28px] border-0 bg-[#1b1b1b]">
      <CardContent className="relative px-5 pb-5 pt-3 text-white">
        <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-white/45" />

        <form onSubmit={onSubmit} className="flex flex-col">
          {/* Header avec sélection de classe */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-[0.1em]">
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

          {/* Slot Photo / Avatar par défaut */}
          <div className="mb-4 flex justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-white/8 text-white/55">
              <User className="h-16 w-16 text-white/40" />
              <div className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-[#00b22d] text-xl font-black text-white shadow-lg ring-4 ring-[#1b1b1b]">
                +
              </div>
            </div>
          </div>

          {/* Saisie Nom, Post-nom, Prénom style Modale */}
          <div className="mb-5 text-center">
            <div className="mx-auto w-full rounded-[22px] bg-white px-4 py-3 text-[#111827]">
              <div className="flex flex-col gap-1.5">
                <input
                  required
                  value={value.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                  placeholder="NOM"
                  className="w-full border-b border-gray-100 py-1 text-center text-lg font-black uppercase text-[#111827] placeholder:text-gray-300 outline-none"
                />
                <input
                  required
                  value={value.postName}
                  onChange={(event) => update("postName", event.target.value)}
                  placeholder="POST-NOM"
                  className="w-full border-b border-gray-100 py-1 text-center text-lg font-black uppercase text-[#111827] placeholder:text-gray-300 outline-none"
                />
                <input
                  required
                  value={value.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                  placeholder="Prénom"
                  className="w-full py-1 text-center text-lg font-bold text-[#111827] placeholder:text-gray-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Lignes de saisie des détails style Modale */}
          <div className="mb-5 space-y-3.5 rounded-[22px] bg-white/5 p-4 text-left">
            {/* Téléphone parent */}
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-white/60 shrink-0" />
              <input
                required
                value={value.parentPhone}
                onChange={(event) => update("parentPhone", event.target.value)}
                placeholder="Téléphone parent"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>

            {/* Adresse */}
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-white/60 shrink-0" />
              <input
                required
                value={value.address}
                onChange={(event) => update("address", event.target.value)}
                placeholder="Adresse"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>

            {/* Date de naissance */}
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-white/60 shrink-0" />
              <input
                type="date"
                value={value.birthDate}
                onChange={(event) => update("birthDate", event.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none color-scheme-dark"
                style={{ colorScheme: "dark" }}
              />
            </div>

            {/* Notes */}
            <div className="flex items-center gap-3">
              <NotebookText className="h-5 w-5 text-white/60 shrink-0" />
              <input
                value={value.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Notes, allergies, détails..."
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>
          </div>

          {/* Bouton d'ajout */}
          <button
            type="submit"
            disabled={!canAdd || isAdding}
            className="h-14 w-full rounded-[22px] bg-[#00b22d] text-base font-bold text-white shadow-lg transition-all hover:bg-[#009e27] active:scale-[0.98] disabled:bg-white/10 disabled:text-white/40 disabled:scale-100 disabled:cursor-not-allowed"
          >
            {isAdding ? "Ajout en cours..." : "+ Ajouter l'enfant"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
