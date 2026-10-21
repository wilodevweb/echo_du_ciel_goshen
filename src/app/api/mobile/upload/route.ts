import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveAdminTokenUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MAX_CHILD_PHOTO_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  const admin = await getActiveAdminTokenUser(request);
  if (!admin) return NextResponse.json({ error: 'Session invalide ou accès administrateur requis.' }, { status: 401 });
  try {
    const form = await request.formData() as unknown as { get(name: string): string | File | null };
    const file = form.get('file');
    const childId = form.get('childId');
    if (typeof childId === 'string') {
      if (!(file instanceof File) || file.type !== 'image/jpeg') {
        return NextResponse.json({ error: 'Une photo JPEG est requise.' }, { status: 400 });
      }
      if (file.size > MAX_CHILD_PHOTO_BYTES) {
        return NextResponse.json({ error: 'La photo dépasse la limite de 1 Mo.' }, { status: 413 });
      }
      const child = await prisma.child.findUnique({ where: { id: childId }, select: { id: true } });
      if (!child) return NextResponse.json({ error: 'Enfant introuvable.' }, { status: 404 });
      const bytes = Buffer.from(await file.arrayBuffer());
      await prisma.child.update({ where: { id: childId }, data: { photoUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` } });
      return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const titleValue = form.get('title');
    const typeValue = form.get('type');
    const ratioValue = form.get('aspectRatio');
    if (!(file instanceof File) || typeof titleValue !== 'string' || !titleValue.trim() || !['image', 'video', 'pdf'].includes(String(typeValue))) {
      return NextResponse.json({ error: 'Fichier, titre et type de média requis.' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Le fichier dépasse la limite de 20 Mo.' }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = `data:${file.type || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
    const type = String(typeValue);
    const media = await prisma.mediaResource.create({ data: {
      title: titleValue.trim(), type, url,
      thumbnail: type === 'image' ? url : type === 'video' ? 'bg-indigo-400' : 'bg-rose-100',
      aspectRatio: typeof ratioValue === 'string' && ['square', 'wide', 'tall'].includes(ratioValue) ? ratioValue : 'square',
    } });
    await prisma.activityLog.create({ data: {
      userId: admin.id, username: admin.username, userFullName: admin.name ?? admin.username,
      action: 'UPLOAD_FILE', details: `Téléversement mobile : « ${media.title} » (${type})`,
    } });
    return NextResponse.json({ success: true, resource: { id: media.id, title: media.title, type: media.type } }, { status: 201 });
  } catch (error) {
    console.error('Erreur de téléversement mobile :', error);
    return NextResponse.json({ error: 'Téléversement impossible pour le moment.' }, { status: 500 });
  }
}
