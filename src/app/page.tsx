import Link from "next/link";
import Image from "next/image";
import { Bell, CalendarCheck, Users, Images, ShieldCheck } from "lucide-react";
import { SyncPanel } from "@/components/SyncPanel";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = (session.user as any)?.role === "ADMIN";

  return (
    <main className="flex h-[100dvh] flex-col items-center overflow-hidden bg-gray-50 px-5 py-6 relative">
      {/* Boutons flottants Admin et Notifications */}
      <div className="fixed right-4 top-4 z-30 flex items-center gap-2">
        <Link
          href="/notifications"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition-all hover:bg-gray-50 active:scale-90"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Link>
        {isAdmin && (
          <Link
            href="/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-md transition-all hover:bg-purple-700 active:scale-90"
            title="Administration"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        )}
      </div>

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
          <p className="mt-2 text-base text-gray-500">Présence, enfants et suivi hors ligne.</p>

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
          </div>
        </div>

        <SyncPanel />
      </div>
    </main>
  );
}
