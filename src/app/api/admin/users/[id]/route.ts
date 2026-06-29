import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  if ((session.user as { id?: string }).id === id) {
    return NextResponse.json({ error: "Vous ne pouvez pas bloquer votre propre compte" }, { status: 400 });
  }

  try {
    const { isBlocked } = await req.json();

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
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
        userId: (session.user as { id?: string }).id || "",
        username: (session.user as { username?: string }).username || "",
        userFullName: session.user?.name || "",
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
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  if ((session.user as { id?: string }).id === id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id },
    });

    // Enregistrer le log
    await prisma.activityLog.create({
      data: {
        userId: (session.user as { id?: string }).id || "",
        username: (session.user as { username?: string }).username || "",
        userFullName: session.user?.name || "",
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
