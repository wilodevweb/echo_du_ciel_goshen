import Link from "next/link";
import Image from "next/image";
import { Bell, CalendarCheck, Users, Images } from "lucide-react";
import { SyncPanel } from "@/components/SyncPanel";

export default function Home() {
  return (
    <main className="flex h-[100dvh] flex-col items-center overflow-hidden bg-gray-50 px-5 py-6">
      <div className="flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <Image
            src="/logo eglise.png"
            alt="Logo Eglise"
            width={300}
            height={154}
            priority
            className="mb-8 h-auto w-full max-w-[280px] object-contain"
          />

          <h1 className="text-3xl font-bold text-gray-950">Ecole du Dimanche</h1>
          <p className="mt-2 text-base text-gray-500">Presence, enfants et suivi hors ligne.</p>

          <div className="mt-8 grid w-full gap-3">
            {/* Bouton Principal: Appel */}
            <Link
              href="/pointage"
              className="flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-[#00b22d] px-5 text-lg font-bold text-white shadow-md transition-all hover:bg-[#008f24] active:scale-[0.98]"
            >
              <CalendarCheck className="h-6 w-6" />
              Faire l&apos;appel
            </Link>

            {/* Grille 2 colonnes pour Annuaire et Ajout */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/enfants"
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
              >
                <Users className="h-5 w-5 text-[#00b22d]" />
                Annuaire
              </Link>

              <Link
                href="/fichiers"
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
              >
                <Images className="h-5 w-5 text-[#00b22d]" />
                Fichiers
              </Link>
            </div>

            {/* Notifications */}
            <Link
              href="/notifications"
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
            >
              <Bell className="h-5 w-5" />
              Notifications
            </Link>
          </div>
        </div>

        <SyncPanel />
      </div>
    </main>
  );
}
