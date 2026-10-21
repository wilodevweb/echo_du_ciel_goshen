import { getActiveAdminSessionUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getActiveAdminSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 150, // Limiter aux 150 derniers logs pour de bonnes performances
    });
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Erreur GET /api/admin/logs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
