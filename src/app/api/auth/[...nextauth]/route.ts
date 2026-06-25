import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@echo.com" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Pour le développement, on crée un admin s'il n'y en a pas du tout dans la BDD
        const userCount = await prisma.user.count();
        if (userCount === 0 && credentials.email === "admin@echo.com" && credentials.password === "password123") {
           const hashedPassword = await bcrypt.hash("password123", 10);
           const admin = await prisma.user.create({
             data: {
               email: "admin@echo.com",
               password: hashedPassword,
               name: "Admin",
               role: "ADMIN"
             }
           });
           return { id: admin.id, email: admin.email, name: admin.name };
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
});

export { handler as GET, handler as POST };
