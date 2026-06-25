import React, { FormEvent } from "react";
import { CirclePlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CLASS_LEVELS } from "@/lib/db";
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

  return (
    <Card padding="none" className="w-full rounded-lg border-dashed border-gray-300 shadow-md">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#00b22d]/10 text-[#00b22d]">
            <CirclePlus className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-950">Ajouter un enfant</h2>
            <p className="text-sm text-gray-500">Carte rapide hors ligne</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={value.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              placeholder="Ajouter un nom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
            <input
              required
              value={value.postName}
              onChange={(event) => update("postName", event.target.value)}
              placeholder="Ajouter un post-nom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
            <input
              required
              value={value.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              placeholder="Ajouter un prenom"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
            />
          </div>

          <select
            required
            value={value.classLevel}
            onChange={(event) => update("classLevel", event.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          >
            {CLASS_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>

          <input
            required
            value={value.parentPhone}
            onChange={(event) => update("parentPhone", event.target.value)}
            placeholder="Telephone parent"
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <input
            required
            value={value.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="Adresse"
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <input
            type="date"
            value={value.birthDate}
            onChange={(event) => update("birthDate", event.target.value)}
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />
          <textarea
            value={value.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Details, allergies, notes"
            rows={3}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d]"
          />

          <button
            type="submit"
            disabled={isAdding}
            className="h-12 rounded-lg bg-[#00b22d] text-sm font-bold text-white disabled:opacity-60"
          >
            {isAdding ? "Ajout..." : "+ Ajouter"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
