import React from "react";

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-[#1b1b1b] p-6 text-white shadow-2xl border border-white/10">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold hover:bg-white/15 transition-all">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-red-500/20 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/30 transition-all">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertDialog({
  isOpen,
  title,
  message,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-[#1b1b1b] p-6 text-white shadow-2xl border border-white/10">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">{message}</p>
        <button type="button" onClick={onClose} className="w-full rounded-xl bg-fiverr py-3 text-sm font-semibold text-white hover:bg-fiverr-dark transition-all">
          Compris
        </button>
      </div>
    </div>
  );
}

