import 'server-only';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

const activeUserSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  title: true,
  isBlocked: true,
} as const;

export async function getActiveUserById(id: unknown) {
  if (typeof id !== 'string' || !id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: activeUserSelect,
  });

  return user && !user.isBlocked ? user : null;
}

export async function getActiveSessionUser() {
  const session = await getServerSession(authOptions);
  return getActiveUserById((session?.user as { id?: unknown } | undefined)?.id);
}

export async function getActiveTokenUser(request: Request) {
  const token = await getToken({
    req: new NextRequest(request.url, { headers: request.headers }),
    secret: authOptions.secret ?? process.env.NEXTAUTH_SECRET,
  });
  return getActiveUserById(token?.id);
}

export async function getActiveRequestUser(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof sessionUserId === 'string' && sessionUserId) {
    return getActiveUserById(sessionUserId);
  }
  return getActiveTokenUser(request);
}

export async function getActiveAdminSessionUser() {
  const user = await getActiveSessionUser();
  return user?.role === 'ADMIN' ? user : null;
}

export async function getActiveAdminTokenUser(request: Request) {
  const user = await getActiveTokenUser(request);
  return user?.role === 'ADMIN' ? user : null;
}
