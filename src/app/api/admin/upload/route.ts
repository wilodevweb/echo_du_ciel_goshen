import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const type = formData.get("type") as string | null; // "image" | "video" | "pdf"
    const aspectRatio = (formData.get("aspectRatio") as string | null) || "square"; // "tall" | "wide" | "square"

    if (!file || !title || !type) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Convertir en Base64 Data URL pour stockage en BDD (évite d'écrire sur le disque en prod/serverless)
    const mimeType = file.type || "application/octet-stream";
    const fileUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

    // Thumbnail par défaut en fonction du type
    let thumbnail = "bg-gray-100";
    if (type === "image") {
      thumbnail = fileUrl;
    } else if (type === "video") {
      thumbnail = "bg-indigo-400";
    } else if (type === "pdf") {
      thumbnail = "bg-rose-100";
    }

    const media = await prisma.mediaResource.create({
      data: {
        title,
        type,
        url: fileUrl,
        thumbnail,
        aspectRatio,
      },
    });

    // Enregistrer le log d'activité
    await prisma.activityLog.create({
      data: {
        userId: (session.user as { id?: string }).id || "",
        username: (session.user as { username?: string }).username || "",
        userFullName: session.user?.name || "",
        action: "UPLOAD_FILE",
        details: `Téléchargement du fichier : "${title}" (${type})`,
      },
    });

    return NextResponse.json({ success: true, media });
  } catch (error) {
    console.error("Erreur POST /api/admin/upload:", error);
    return NextResponse.json({ error: "Erreur serveur lors du téléversement" }, { status: 500 });
  }
}
