import { getActiveAdminSessionUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const admin = await getActiveAdminSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        title: true,
        isBlocked: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Erreur GET /api/admin/users:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getActiveAdminSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const { username: reqUsername, password, name, title } = input;
    if (typeof name !== "string" || !name.trim() || typeof password !== "string") {
      return NextResponse.json({ error: "Nom et mot de passe requis." }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 12 caractères." }, { status: 400 });
    }
    if (reqUsername !== undefined && typeof reqUsername !== "string") {
      return NextResponse.json({ error: "Nom d’utilisateur invalide." }, { status: 400 });
    }
    if (title !== undefined && typeof title !== "string") {
      return NextResponse.json({ error: "Titre invalide." }, { status: 400 });
    }

    const trimmedName = name.trim();

    const username = (typeof reqUsername === "string" && reqUsername.trim())
      ? reqUsername.trim()
      : trimmedName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, ".").replace(/\.\.+/g, ".").replace(/^\.|\.$/g, "");

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
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username,
          password: hashedPassword,
          name: trimmedName,
          role: "MONITOR",
          title: typeof title === "string" && title.trim() ? title.trim() : "Moniteur",
          isBlocked: false,
        },
      });
      await tx.activityLog.create({
        data: {
          userId: admin.id,
          username: admin.username,
          userFullName: admin.name || admin.username,
          action: "CREATE_USER",
          details: `Création du compte moniteur ${createdUser.name} (${createdUser.username}) avec le titre/statut "${createdUser.title}"`,
        },
      });
      return createdUser;
    });

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, title: user.title } });
  } catch (error) {
    console.error("Erreur POST /api/admin/users:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
