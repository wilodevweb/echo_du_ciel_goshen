import { getActiveAdminSessionUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getActiveAdminSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  if (admin.id === id) {
    return NextResponse.json({ error: "Vous ne pouvez pas bloquer votre propre compte" }, { status: 400 });
  }

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("isBlocked" in body) || typeof body.isBlocked !== "boolean") {
      return NextResponse.json({ error: "Statut de blocage invalide." }, { status: 400 });
    }
    const { isBlocked } = body;

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    if (targetUser.role === "ADMIN") {
      return NextResponse.json({ error: "Les comptes administrateurs sont protégés." }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isBlocked },
    });

    // Enregistrer le log
    const action = isBlocked ? "BLOCK_USER" : "UNBLOCK_USER";
    const details = isBlocked
      ? `Blocage du compte de ${targetUser.name} (${targetUser.username})`
      : `Déblocage du compte de ${targetUser.name} (${targetUser.username})`;

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        username: admin.username,
        userFullName: admin.name || admin.username,
        action,
        details,
      },
    });

    return NextResponse.json({ success: true, user: { id: updatedUser.id, username: updatedUser.username, isBlocked: updatedUser.isBlocked } });
  } catch (error) {
    console.error("Erreur PATCH /api/admin/users/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getActiveAdminSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  if (admin.id === id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    if (targetUser.role === "ADMIN") {
      return NextResponse.json({ error: "Les comptes administrateurs sont protégés." }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    // Enregistrer le log
    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        username: admin.username,
        userFullName: admin.name || admin.username,
        action: "DELETE_USER",
        details: `Suppression définitive du compte de ${targetUser.name} (${targetUser.username})`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur DELETE /api/admin/users/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
