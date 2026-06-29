"use client";

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, 
  History, 
  Upload, 
  UserPlus, 
  Trash2, 
  Unlock, 
  Lock, 
  ArrowLeft,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type TabType = "moniteurs" | "activites" | "upload";

interface User {
  id: string;
  username: string;
  name: string | null;
  role: string;
  title: string | null;
  isBlocked: boolean;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  userFullName: string | null;
  action: string;
  details: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("moniteurs");

  // State pour la gestion des moniteurs
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    title: "Moniteur",
    password: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");

  // State pour le suivi des activités
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // State pour l'upload de fichiers
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState<"image" | "video" | "pdf">("pdf");
  const [aspectRatio, setAspectRatio] = useState<"square" | "wide" | "tall">("square");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Restriction d'accès
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
      router.push("/");
    }
  }, [status, session, router]);

  // Charger les moniteurs et logs au chargement ou changement de tab
  useEffect(() => {
    if (status === "authenticated" && (session?.user as { role?: string } | undefined)?.role === "ADMIN") {
      if (activeTab === "moniteurs") {
        fetchUsers();
      } else if (activeTab === "activites") {
        fetchLogs();
      }
    }
  }, [activeTab, status, session]);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Erreur de chargement des utilisateurs", err);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/admin/logs");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Erreur de chargement des logs d'activité", err);
    } finally {
      setLoadingLogs(false);
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserError("");
    setUserSuccess("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newUser, role: "MONITOR" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUserError(data.error || "Une erreur est survenue lors de la création.");
      } else {
        setUserSuccess(`Compte créé avec succès pour ${newUser.name} !`);
        setNewUser({ name: "", username: "", title: "Moniteur", password: "" });
        fetchUsers();
      }
    } catch {
      setUserError("Erreur réseau");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleBlock = async (id: string, currentBlocked: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !currentBlocked }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur de blocage.");
      }
    } catch (err) {
      console.error("Erreur de modification du statut utilisateur", err);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le compte de ${name} ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur de suppression.");
      }
    } catch (err) {
      console.error("Erreur de suppression de l'utilisateur", err);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Veuillez sélectionner un fichier.");
      return;
    }
    if (!uploadTitle) {
      setUploadError("Veuillez donner un titre à la ressource.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    formData.append("type", uploadType);
    formData.append("aspectRatio", aspectRatio);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Erreur lors du téléversement.");
      } else {
        setUploadSuccess(`Fichier "${uploadTitle}" téléversé avec succès !`);
        setUploadFile(null);
        setUploadTitle("");
        // Reset file input value
        const fileInput = document.getElementById("file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch {
      setUploadError("Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && (session?.user as { role?: string } | undefined)?.role !== "ADMIN")) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#00b22d]" />
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
                <span className="hidden sm:inline-flex text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-[#00b22d]/20 text-[#00b22d] font-bold border border-[#00b22d]/30 flex-shrink-0">
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
                ? "bg-[#00b22d] text-white shadow-md shadow-[#00b22d]/10"
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
                ? "bg-[#00b22d] text-white shadow-md shadow-[#00b22d]/10"
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
                ? "bg-[#00b22d] text-white shadow-md shadow-[#00b22d]/10"
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
        {activeTab === "moniteurs" && (
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Formulaire d'ajout */}
            <div className="md:col-span-1">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#00b22d]" />
                Ajouter un moniteur
              </h2>
              <Card className="bg-gray-950 border-gray-800 shadow-xl">
                <CardContent className="pt-6 space-y-4">
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input
                      label="Nom Complet"
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="Nom de l'enseignant (ex: Joseph Monga)"
                      className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#00b22d]"
                    />
                    <Input
                      label="Nom d'utilisateur / Login (Optionnel)"
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="Généré auto si vide (ex: joseph.monga)"
                      className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#00b22d]"
                    />
                    <Input
                      label="Titre / Statut"
                      required
                      value={newUser.title}
                      onChange={(e) => setNewUser({ ...newUser, title: e.target.value })}
                      placeholder="Moniteur, Adjoint, etc."
                      className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#00b22d]"
                    />
                    <Input
                      label="Mot de passe initial"
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Min. 6 caractères"
                      className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#00b22d]"
                    />

                    {userError && (
                      <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-900/30 text-red-400 rounded-lg text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{userError}</span>
                      </div>
                    )}

                    {userSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-900/30 text-emerald-400 rounded-lg text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{userSuccess}</span>
                      </div>
                    )}

                    <Button type="submit" fullWidth disabled={creatingUser} className="bg-[#00b22d] hover:bg-[#009e28] text-white">
                      {creatingUser ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Création...
                        </>
                      ) : (
                        "Créer le compte"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Liste des moniteurs */}
            <div className="md:col-span-2">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#00b22d]" />
                  Liste des comptes
                </span>
                <span className="text-xs bg-gray-800 text-gray-400 font-semibold px-2.5 py-1 rounded-md">
                  {users.length} compte(s)
                </span>
              </h2>

              {loadingUsers ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-950 border border-gray-800 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-10 bg-gray-950 border border-gray-800 rounded-2xl text-gray-500">
                  Aucun moniteur trouvé.
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <Card key={user.id} className={`bg-gray-950 border-gray-800 transition shadow-md hover:border-gray-700 ${user.isBlocked ? "opacity-60 border-red-950 bg-red-950/5" : ""}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white text-base leading-tight truncate">{user.name || "Enseignant"}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              user.role === "ADMIN" 
                                ? "bg-purple-950/40 text-purple-400 border-purple-900/30" 
                                : "bg-blue-950/40 text-blue-400 border-blue-900/30"
                            }`}>
                              {user.role === "ADMIN" ? "Admin" : "Moniteur"}
                            </span>
                            {user.isBlocked && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 font-bold border border-red-900/30">
                                Bloqué
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-gray-400 mt-1">{user.title || "Moniteur"}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">@{user.username}</p>
                        </div>

                        {/* Actions de blocage et suppression */}
                        <div className="flex gap-2">
                          {user.role !== "ADMIN" && (
                            <>
                              <button
                                onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                                className={`p-2 rounded-xl border transition ${
                                  user.isBlocked
                                    ? "bg-emerald-950/40 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/25"
                                    : "bg-amber-950/40 border-amber-900/30 text-amber-400 hover:bg-amber-900/25"
                                }`}
                                title={user.isBlocked ? "Débloquer le compte" : "Bloquer le compte"}
                              >
                                {user.isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.name || user.username)}
                                className="p-2 rounded-xl bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-900/25 transition"
                                title="Supprimer le compte"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {user.role === "ADMIN" && (
                            <span className="text-gray-600 text-xs italic">Protégé</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB SUIVI D'ACTIVITES --- */}
        {activeTab === "activites" && (
          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#00b22d]" />
                Historique des actions
              </span>
              <button 
                onClick={fetchLogs} 
                className="text-xs text-[#00b22d] hover:underline font-semibold"
              >
                Rafraîchir
              </button>
            </h2>

            {loadingLogs ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-gray-950 border border-gray-800 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 bg-gray-950 border border-gray-800 rounded-2xl text-gray-500">
                Aucun log d&apos;activité trouvé dans la base de données.
              </div>
            ) : (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900 text-gray-400 font-semibold">
                        <th className="p-3 md:p-4">Date/Heure</th>
                        <th className="p-3 md:p-4">Moniteur</th>
                        <th className="p-3 md:p-4">Action</th>
                        <th className="p-3 md:p-4">Détails</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-850">
                      {logs.map((log) => {
                        let actionColor = "text-gray-300 bg-gray-800";
                        if (log.action === "CONNEXION") actionColor = "text-emerald-400 bg-emerald-950/40 border border-emerald-900/30";
                        if (log.action === "CREATE_USER") actionColor = "text-blue-400 bg-blue-950/40 border border-blue-900/30";
                        if (log.action === "BLOCK_USER") actionColor = "text-amber-400 bg-amber-950/40 border border-amber-900/30";
                        if (log.action === "DELETE_USER") actionColor = "text-red-400 bg-red-950/40 border border-red-900/30";
                        if (log.action === "UPLOAD_FILE") actionColor = "text-purple-400 bg-purple-950/40 border border-purple-900/30";
                        if (log.action === "SYNC_DATA") actionColor = "text-cyan-400 bg-cyan-950/40 border border-cyan-900/30";

                        return (
                          <tr key={log.id} className="hover:bg-gray-900/40 transition">
                            <td className="p-3 md:p-4 text-gray-500 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("fr-FR")}
                            </td>
                            <td className="p-3 md:p-4 whitespace-nowrap">
                              <div className="font-bold text-gray-200">{log.userFullName || log.username || "Inconnu"}</div>
                              <div className="text-[10px] text-gray-500">@{log.username}</div>
                            </td>
                            <td className="p-3 md:p-4 whitespace-nowrap">
                              <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full ${actionColor}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3 md:p-4 text-gray-400 min-w-[200px]">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB UPLOAD --- */}
        {activeTab === "upload" && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#00b22d]" />
              Téléverser une ressource
            </h2>
            <Card className="bg-gray-950 border-gray-800 shadow-xl">
              <CardContent className="pt-6 space-y-5">
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-1.5">Sélectionner un fichier</label>
                    <input
                      id="file-input"
                      type="file"
                      required
                      accept=".jpg,.jpeg,.png,.mp4,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const file = e.target.files[0];
                          setUploadFile(file);
                          // Auto-detect type
                          if (file.type.startsWith("image/")) {
                            setUploadType("image");
                          } else if (file.type.startsWith("video/")) {
                            setUploadType("video");
                          } else if (file.type === "application/pdf") {
                            setUploadType("pdf");
                          }
                          // Auto-fill title if empty
                          if (!uploadTitle) {
                            const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                            setUploadTitle(nameWithoutExt);
                          }
                        }
                      }}
                      className="block w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700 cursor-pointer border border-gray-800 rounded-xl bg-gray-900 p-1 focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Formats acceptés : PDF, MP4 (vidéos), PNG/JPG (images).</p>
                  </div>

                  <Input
                    label="Titre de la ressource"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Ex: Leçon 5 - L'Arche de Noé"
                    className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#00b22d]"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Type de média</label>
                      <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value as "image" | "video" | "pdf")}
                        className="block w-full py-2.5 px-3 border border-gray-800 rounded-xl bg-gray-900 text-white text-sm focus:border-[#00b22d] focus:outline-none"
                      >
                        <option value="pdf">Document (PDF)</option>
                        <option value="image">Image (JPG/PNG)</option>
                        <option value="video">Vidéo (MP4)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">Format d&apos;affichage (Aspect Ratio)</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as "square" | "wide" | "tall")}
                        className="block w-full py-2.5 px-3 border border-gray-800 rounded-xl bg-gray-900 text-white text-sm focus:border-[#00b22d] focus:outline-none"
                      >
                        <option value="square">Carré (1:1)</option>
                        <option value="wide">Large (4:3)</option>
                        <option value="tall">Hauteur (3:4)</option>
                      </select>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-900/30 text-red-400 rounded-lg text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-900/30 text-emerald-400 rounded-lg text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{uploadSuccess}</span>
                    </div>
                  )}

                  <Button type="submit" fullWidth disabled={uploading} className="bg-[#00b22d] hover:bg-[#009e28] text-white">
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Téléchargement...
                      </>
                    ) : (
                      "Téléverser"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </main>
  );
}
