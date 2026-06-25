import Link from "next/link";
import { Users, CalendarCheck, UserPlus } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-gray-50">
      <div className="w-full max-w-md mt-10">
        <h1 className="text-3xl font-bold text-center text-[#00b22d] mb-2">
          École du Dimanche
        </h1>
        <p className="text-center text-gray-500 mb-10">Gestion des présences</p>

        <div className="grid gap-4">
          <Link href="/pointage" className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#00b22d] transition-colors">
            <div className="bg-[#00b22d]/10 p-3 rounded-lg mr-4">
              <CalendarCheck className="w-6 h-6 text-[#00b22d]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Pointage du Dimanche</h2>
              <p className="text-sm text-gray-500">Faire l&apos;appel d&apos;aujourd&apos;hui</p>
            </div>
          </Link>

          <Link href="/enfants" className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#00b22d] transition-colors">
            <div className="bg-[#00b22d]/10 p-3 rounded-lg mr-4">
              <Users className="w-6 h-6 text-[#00b22d]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Liste des Enfants</h2>
              <p className="text-sm text-gray-500">Gérer l&apos;annuaire et contacts</p>
            </div>
          </Link>

          <Link href="/enfants/nouveau" className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#00b22d] transition-colors">
            <div className="bg-[#00b22d]/10 p-3 rounded-lg mr-4">
              <UserPlus className="w-6 h-6 text-[#00b22d]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Ajouter un Enfant</h2>
              <p className="text-sm text-gray-500">Inscrire un nouveau profil</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
