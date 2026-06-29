import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
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

    // Simplifier et sécuriser le nom du fichier
    const cleanFileName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    
    // Créer le dossier s'il n'existe pas
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, cleanFileName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${cleanFileName}`;

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
        userId: (session.user as any).id || "",
        username: (session.user as any).username || "",
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
