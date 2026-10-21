import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { clearAuthFailures, getAuthRateLimit, recordAuthFailure } from "@/lib/authRateLimit";

interface CustomUser {
  id: string;
  username: string;
  name?: string | null;
  role?: string;
  title?: string | null;
}

function getSortedNormalizedWords(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function isDatabaseConnectivityError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const candidate = current as Error & { code?: string; cause?: unknown };
    if (
      candidate.code?.startsWith("UND_ERR_CONNECT") ||
      candidate.code === "ECONNREFUSED" ||
      candidate.code === "ETIMEDOUT" ||
      candidate.code === "ENOTFOUND" ||
      candidate.message === "fetch failed"
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        username: { label: "Nom d'utilisateur", type: "text", placeholder: "joseph.monga" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials, request) {
        try {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        const login = credentials.username.trim();
        if (!login) return null;

        if (getAuthRateLimit(request.headers, login).limited) return null;
        if ((login.toLowerCase() === "admin" || login.toLowerCase() === "moniteur") && credentials.password === "password123") {
          recordAuthFailure(request.headers, login);
          return null;
        }

        let user = await prisma.user.findUnique({
          where: { username: login }
        });

        if (!user) {
          const candidates = await prisma.user.findMany({ select: { id: true, username: true, name: true } });
          const inputWords = getSortedNormalizedWords(login);
          if (inputWords) {
            const matchedCandidate = candidates.find((u) => {
              const unameWords = getSortedNormalizedWords(u.username);
              const nameWords = getSortedNormalizedWords(u.name || "");
              return unameWords === inputWords || nameWords === inputWords;
            });
            if (matchedCandidate) user = await prisma.user.findUnique({ where: { id: matchedCandidate.id } });
          }
        }

        if (!user) {
          recordAuthFailure(request.headers, login);
          return null;
        }

        if (user.isBlocked) {
          recordAuthFailure(request.headers, login);
          throw new Error("Compte bloqué. Veuillez contacter l'administrateur.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          recordAuthFailure(request.headers, login);
          return null;
        }

        clearAuthFailures(request.headers, login);

        // Le journal d'activité ne doit pas empêcher un utilisateur valide de se connecter.
        try {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              username: user.username,
              userFullName: user.name ?? "",
              action: "CONNEXION",
              details: `Connexion réussie de ${user.name || user.username}`,
            }
          });
        } catch (error) {
          console.error("Échec de l'enregistrement de l'activité de connexion.", error);
        }

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          title: user.title,
        } as CustomUser;
        } catch (error) {
          if (isDatabaseConnectivityError(error)) {
            const cause = error as Error & { code?: string };
            console.error("[auth] Database connectivity failure", {
              name: cause.name,
              code: cause.code,
            });
            throw new Error("DatabaseUnavailable");
          }
          throw error;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as CustomUser).username;
        token.role = (user as CustomUser).role;
        token.title = (user as CustomUser).title;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as CustomUser;
        u.id = token.id as string;
        u.username = token.username as string;
        u.role = token.role as string;
        u.title = token.title as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
};
