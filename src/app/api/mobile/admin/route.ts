import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getActiveAdminTokenUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await getActiveAdminTokenUser(request);
  if (!admin) return NextResponse.json({ error: 'Session invalide ou accès administrateur requis.' }, { status: 401 });
  try {
    const [users, logs] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, username: true, name: true, role: true, title: true, isBlocked: true, createdAt: true } }),
      prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 150 }),
    ]);
    return NextResponse.json({ users, logs, currentUserId: admin.id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erreur de chargement de l’administration mobile :', error);
    return NextResponse.json({ error: 'Données administratives indisponibles.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await getActiveAdminTokenUser(request);
  if (!admin) return NextResponse.json({ error: 'Session invalide ou accès administrateur requis.' }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('action' in body) || typeof body.action !== 'string') return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
    const actor = { userId: admin.id, username: admin.username, userFullName: admin.name ?? admin.username };
    if (body.action === 'create-user') {
      if (!('name' in body) || typeof body.name !== 'string' || !body.name.trim() || !('password' in body) || typeof body.password !== 'string' || body.password.length < 12) {
        return NextResponse.json({ error: 'Nom et mot de passe de 12 caractères minimum requis.' }, { status: 400 });
      }
      const name = body.name.trim();
      const title = 'title' in body && typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Moniteur';
      const username = 'username' in body && typeof body.username === 'string' && body.username.trim()
        ? body.username.trim()
        : name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]/g, '.').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
      if (!username) return NextResponse.json({ error: 'Nom d’utilisateur invalide.' }, { status: 400 });
      if (await prisma.user.findUnique({ where: { username } })) return NextResponse.json({ error: 'Ce nom d’utilisateur est déjà utilisé.' }, { status: 409 });
      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({ data: { username, name, password: passwordHash, role: 'MONITOR', title, isBlocked: false } });
        await tx.activityLog.create({ data: { ...actor, action: 'CREATE_USER', details: `Création du compte moniteur ${name} (${username})` } });
        return createdUser;
      });
      return NextResponse.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, title: user.title, isBlocked: user.isBlocked, createdAt: user.createdAt } }, { status: 201 });
    }
    if (body.action === 'toggle-block' && 'userId' in body && typeof body.userId === 'string' && 'isBlocked' in body && typeof body.isBlocked === 'boolean') {
      if (body.userId === admin.id) return NextResponse.json({ error: 'Vous ne pouvez pas bloquer votre propre compte.' }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
      if (user.role === 'ADMIN') return NextResponse.json({ error: 'Les comptes administrateurs sont protégés.' }, { status: 403 });
      const updated = await prisma.user.update({ where: { id: user.id }, data: { isBlocked: body.isBlocked } });
      await prisma.activityLog.create({ data: { ...actor, action: body.isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER', details: `${body.isBlocked ? 'Blocage' : 'Déblocage'} du compte ${user.username}` } });
      return NextResponse.json({ success: true, user: { id: updated.id, isBlocked: updated.isBlocked } });
    }
    return NextResponse.json({ error: 'Action non prise en charge.' }, { status: 400 });
  } catch (error) {
    console.error('Erreur d’action administrative mobile :', error);
    return NextResponse.json({ error: 'Action impossible pour le moment.' }, { status: 500 });
  }
}
