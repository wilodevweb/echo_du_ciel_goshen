import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        username: { label: "Nom d'utilisateur", type: "text", placeholder: "joseph.monga" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Pour le développement, on crée un admin s'il n'y en a pas du tout dans la BDD
        const userCount = await prisma.user.count();
        if (userCount === 0 && credentials.username === "admin" && credentials.password === "password123") {
           const hashedPassword = await bcrypt.hash("password123", 10);
           const admin = await prisma.user.create({
             data: {
               username: "admin",
               password: hashedPassword,
               name: "Admin",
               role: "ADMIN"
             }
           });
           return { id: admin.id, username: admin.username, name: admin.name } as CustomUser;
        }

        let user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });

        if (!user) {
          const allUsers = await prisma.user.findMany();
          const inputWords = getSortedNormalizedWords(credentials.username);
          if (inputWords) {
            user = allUsers.find((u) => {
              const unameWords = getSortedNormalizedWords(u.username);
              const nameWords = getSortedNormalizedWords(u.name || "");
              return unameWords === inputWords || nameWords === inputWords;
            }) || null;
          }
        }

        if (!user) {
          return null;
        }

        if (user.isBlocked) {
          throw new Error("Compte bloqué. Veuillez contacter l'administrateur.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        // Enregistrer l'activité de connexion
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            username: user.username,
            userFullName: user.name ?? "",
            action: "CONNEXION",
            details: `Connexion réussie de ${user.name || user.username}`,
          }
        });

        return { 
          id: user.id, 
          username: user.username, 
          name: user.name,
          role: user.role,
          title: user.title,
        } as CustomUser;
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
