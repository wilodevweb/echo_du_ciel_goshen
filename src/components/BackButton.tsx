"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-800 bg-gray-900 text-gray-300 font-semibold hover:bg-gray-800 transition"
    >
      <ArrowLeft className="w-4 h-4" />
      Retour
    </button>
  );
}
