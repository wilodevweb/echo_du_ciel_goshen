import Link from "next/link";
import Image from "next/image";
import { Bell, CalendarCheck } from "lucide-react";
import { SyncPanel } from "@/components/SyncPanel";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 px-5 py-6">
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
            <button
              type="button"
              disabled
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-400 shadow-sm"
            >
              <Bell className="h-5 w-5" />
              Notifications
            </button>

            <Link
              href="/pointage"
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-[#00b22d] px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#008f24]"
            >
              <CalendarCheck className="h-5 w-5" />
              Proceder a l&apos;appel
            </Link>
          </div>
        </div>

        <SyncPanel />
      </div>
    </main>
  );
}
