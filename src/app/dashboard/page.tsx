"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, History, Upload, ArrowLeft, Loader2, LogOut } from "lucide-react";
import dynamic from "next/dynamic";

const UploadTab = dynamic(() => import("@/components/admin/UploadTab"), {
  loading: () => (
    <div className="flex justify-center p-10">
      <Loader2 className="h-8 w-8 animate-spin text-fiverr" />
    </div>
  ),
});

const MoniteursTab = dynamic(() => import("@/components/admin/MoniteursTab"), {
  loading: () => (
    <div className="flex justify-center p-10">
      <Loader2 className="h-8 w-8 animate-spin text-fiverr" />
    </div>
  ),
});

const ActivitesTab = dynamic(() => import("@/components/admin/ActivitesTab"), {
  loading: () => (
    <div className="flex justify-center p-10">
      <Loader2 className="h-8 w-8 animate-spin text-fiverr" />
    </div>
  ),
});

type TabType = "moniteurs" | "activites" | "upload";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("moniteurs");

  // Restriction d'accès
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
      router.push("/");
    }
  }, [status, session, router]);



  if (status === "loading" || (status === "authenticated" && (session?.user as { role?: string } | undefined)?.role !== "ADMIN")) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-fiverr" />
          <p className="text-gray-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
      {/* Header Premium */}
      <header className="border-b border-gray-800 bg-gray-950 p-4 sticky top-0 z-20 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="bg-gray-800 hover:bg-gray-700 p-2.5 rounded-xl transition text-gray-300 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="truncate">Administration</span>
                <span className="hidden sm:inline-flex text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-fiverr/20 text-fiverr font-bold border border-fiverr/30 flex-shrink-0">
                  {(session?.user as { title?: string } | undefined)?.title || "Moniteur-Admin"}
                </span>
              </h1>
              <p className="text-xs text-gray-400 font-medium truncate">
                Connecté en tant que <span className="text-gray-200">{session?.user?.name}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })} 
            className="flex items-center gap-2 text-sm font-semibold bg-red-950/40 border border-red-900/30 hover:bg-red-900/30 text-red-400 px-4 py-2 rounded-xl transition flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Barre de navigation des tabs */}
      <nav className="border-b border-gray-800 bg-gray-950/50 py-2">
        <div className="max-w-6xl mx-auto px-4 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab("moniteurs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap ${
              activeTab === "moniteurs"
                ? "bg-fiverr text-white shadow-md shadow-fiverr/10"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Moniteurs
          </button>
          <button
            onClick={() => setActiveTab("activites")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap ${
              activeTab === "activites"
                ? "bg-fiverr text-white shadow-md shadow-fiverr/10"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            Suivi d&apos;Activités
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap ${
              activeTab === "upload"
                ? "bg-fiverr text-white shadow-md shadow-fiverr/10"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            Uploader des Fichiers
          </button>
        </div>
      </nav>

      {/* Contenu principal */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 pb-20">
        
        {/* --- TAB MONITEURS --- */}
        {activeTab === "moniteurs" && <MoniteursTab />}

        {/* --- TAB SUIVI D'ACTIVITES --- */}
        {activeTab === "activites" && <ActivitesTab />}

        {/* --- TAB UPLOAD --- */}
        {activeTab === "upload" && <UploadTab />}

      </div>
    </main>
  );
}
