"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Identifiants incorrects");
      } else {
        router.push("/");
        router.refresh(); // Pour mettre à jour la session dans tout l'app
      }
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-[#00b22d] p-4 rounded-full shadow-lg">
            <Lock className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Connexion
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Espace réservé aux moniteurs
        </p>

        <Card padding="lg" className="shadow-xl">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Adresse Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@echo.com"
              />
              <Input
                label="Mot de passe"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-500 text-sm mb-4 border border-red-100">
                  {error}
                </div>
              )}

              <Button type="submit" fullWidth size="lg" disabled={isLoading} className="mt-6">
                {isLoading ? "Vérification..." : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
