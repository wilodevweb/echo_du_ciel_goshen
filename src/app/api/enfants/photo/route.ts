import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "enfants");
const PUBLIC_UPLOAD_PATH = "/uploads/enfants";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }

    const extension = EXTENSION_BY_TYPE[file.type];

    if (!extension) {
      return NextResponse.json({ error: "Format image non supporté" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image trop volumineuse" }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(filePath, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      url: `${PUBLIC_UPLOAD_PATH}/${filename}`,
    });
  } catch (error) {
    console.error("Erreur POST /api/enfants/photo:", error);
    return NextResponse.json({ error: "Erreur serveur lors du téléversement" }, { status: 500 });
  }
}
