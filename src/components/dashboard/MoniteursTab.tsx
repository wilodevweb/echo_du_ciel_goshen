import React, { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Unlock, Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface User {
  id: string;
  username: string;
  name: string | null;
  role: string;
  title: string | null;
  isBlocked: boolean;
  createdAt: string;
}

export default function MoniteursTab() {
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

  useEffect(() => {
    fetchUsers();
  }, []);

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

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Formulaire d'ajout */}
      <div className="md:col-span-1">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-fiverr" />
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
                className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-fiverr"
              />
              <Input
                label="Nom d'utilisateur / Login (Optionnel)"
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="Généré auto si vide (ex: joseph.monga)"
                className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-fiverr"
              />
              <Input
                label="Titre / Statut"
                required
                value={newUser.title}
                onChange={(e) => setNewUser({ ...newUser, title: e.target.value })}
                placeholder="Moniteur, Adjoint, etc."
                className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-fiverr"
              />
              <Input
                label="Mot de passe initial"
                type="password"
                required
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Min. 6 caractères"
                className="bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-fiverr"
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

              <Button type="submit" fullWidth disabled={creatingUser} className="bg-fiverr hover:bg-fiverr-dark text-white">
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
            <Users className="w-5 h-5 text-fiverr" />
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
  );
}
