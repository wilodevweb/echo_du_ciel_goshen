import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearAuthFailures, getAuthRateLimit, recordAuthFailure } from "@/lib/authRateLimit";

export const runtime = "nodejs";

function normalizeLoginName(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean).sort().join(" ");
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("username" in body) || !("password" in body)
      || typeof body.username !== "string" || typeof body.password !== "string"
      || !body.username.trim() || !body.password) {
      return NextResponse.json({ error: "Nom d’utilisateur et mot de passe requis." }, { status: 400 });
    }

    const loginName = body.username.trim();
    const rateLimit = getAuthRateLimit(request.headers, loginName);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessaie dans quelques minutes." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
    if ((loginName.toLowerCase() === "admin" || loginName.toLowerCase() === "moniteur") && body.password === "password123") {
      recordAuthFailure(request.headers, loginName);
      return NextResponse.json({ error: "Identifiants incorrects ou compte bloqué." }, { status: 401 });
    }

    let user = await prisma.user.findUnique({ where: { username: loginName } });
    if (!user) {
      const normalizedLogin = normalizeLoginName(loginName);
      const candidates = await prisma.user.findMany({ select: { id: true, username: true, name: true } });
      const matchedCandidate = candidates.find(candidate => normalizeLoginName(candidate.username) === normalizedLogin
        || normalizeLoginName(candidate.name ?? '') === normalizedLogin) ?? null;
      if (matchedCandidate) user = await prisma.user.findUnique({ where: { id: matchedCandidate.id } });
    }
    if (!user || user.isBlocked || !(await bcrypt.compare(body.password, user.password))) {
      recordAuthFailure(request.headers, loginName);
      return NextResponse.json({ error: "Identifiants incorrects ou compte bloqué." }, { status: 401 });
    }

    clearAuthFailures(request.headers, loginName);

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: "Service d’authentification indisponible." }, { status: 503 });
    const token = await encode({
      secret,
      maxAge: 60 * 60 * 24 * 30,
      token: {
        sub: user.id,
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        title: user.title,
        mobile: true,
      },
    });
    // Un incident de journalisation ne doit pas invalider des identifiants corrects.
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          username: user.username,
          userFullName: user.name ?? user.username,
          action: "CONNEXION",
          details: `Connexion mobile réussie de ${user.name || user.username}`,
        },
      });
    } catch (error) {
      console.error("Échec de l'enregistrement de l'activité de connexion mobile.", error);
    }

    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erreur d’authentification mobile :", error);
    return NextResponse.json({ error: "Connexion impossible pour le moment." }, { status: 500 });
  }
}
