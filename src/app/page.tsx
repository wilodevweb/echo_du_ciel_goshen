import Link from "next/link";
import Image from "next/image";
import { Bell, CalendarCheck, Users, Images, ShieldCheck } from "lucide-react";
import { SyncPanel } from "@/components/SyncPanel";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { LinkButton } from "@/components/ui/LinkButton";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <main className="flex h-[100dvh] flex-col items-center overflow-hidden bg-gray-50 px-5 py-6 relative">
        {/* Boutons flottants Admin et Notifications */}
      <div className="fixed right-4 top-4 z-30 flex items-center gap-2">
        <FloatingButton href="/notifications" icon={Bell} title="Notifications" />
        {isAdmin && (
          <FloatingButton href="/dashboard" icon={ShieldCheck} variant="purple" title="Administration" />
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
          <p className="mt-2 text-base text-gray-500">Echo du ciel goshen</p>

          <div className="mt-8 grid w-full gap-3">
            <LinkButton href="/pointage" icon={CalendarCheck} variant="primary" fullWidth>
              Faire l'appel
            </LinkButton>

            <div className="grid grid-cols-2 gap-3">
              <LinkButton href="/enfants" icon={Users} variant="outline" fullWidth>
                Annuaire
              </LinkButton>

              <LinkButton href="/fichiers" icon={Images} variant="outline" fullWidth>
                Archives
              </LinkButton>
            </div>
          </div>
        </div>

        <SyncPanel />
      </div>
    </main>
  );
}
