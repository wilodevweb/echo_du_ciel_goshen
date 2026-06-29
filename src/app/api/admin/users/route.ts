import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Ne pas renvoyer les mots de passe
    const sanitizedUsers = users.map(({ password, ...user }) => user);
    return NextResponse.json({ users: sanitizedUsers });
  } catch (error) {
    console.error("Erreur GET /api/admin/users:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { username: reqUsername, password, name, role, title } = await req.json();

    if (!password || !name) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const username = (reqUsername && reqUsername.trim())
      ? reqUsername.trim()
      : name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, ".").replace(/\.\.+/g, ".").replace(/^\.|\.$/g, "");

    if (!username) {
      return NextResponse.json({ error: "Nom d'utilisateur invalide" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Ce nom d'utilisateur est déjà utilisé" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: role || "MONITOR",
        title: title || "Moniteur",
        isBlocked: false,
      },
    });

    // Enregistrer le log d'activité
    await prisma.activityLog.create({
      data: {
        userId: (session.user as any).id || "",
        username: (session.user as any).username || "",
        userFullName: session.user?.name || "",
        action: "CREATE_USER",
        details: `Création du compte moniteur ${user.name} (${user.username}) avec le titre/statut "${user.title}"`,
      },
    });

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, title: user.title } });
  } catch (error) {
    console.error("Erreur POST /api/admin/users:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
