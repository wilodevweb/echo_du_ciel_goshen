import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveRequestUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getActiveRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Session invalide ou compte bloqué. Reconnectez-vous.' }, { status: 401 });
  }

  try {
    const resourceId = new URL(request.url).searchParams.get('id');
    if (resourceId) {
      const resource = await prisma.mediaResource.findUnique({ where: { id: resourceId }, select: { url: true } });
      if (!resource) return NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 });
      if (new URL(request.url).searchParams.get('raw') !== '1') {
        return NextResponse.json({ url: resource.url }, { headers: { 'Cache-Control': 'private, no-store' } });
      }
      const dataUrlMatch = /^data:([^;,]+)?;base64,([\s\S]*)$/.exec(resource.url);
      if (!dataUrlMatch) return NextResponse.json({ error: 'Format de ressource non pris en charge.' }, { status: 415 });
      const mimeType = dataUrlMatch[1] || 'application/octet-stream';
      const bytes = Buffer.from(dataUrlMatch[2], 'base64');
      const headers = new Headers({
        'Content-Type': mimeType,
        'Content-Length': String(bytes.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      const range = request.headers.get('range');
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
        }
        const suffixLength = match[1] ? null : Number(match[2]);
        const start = match[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - (suffixLength ?? 0));
        const end = match[2] && match[1] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
        if (start >= bytes.byteLength || end < start) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
        }
        const chunk = bytes.subarray(start, end + 1);
        headers.set('Content-Length', String(chunk.byteLength));
        headers.set('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`);
        return new Response(new Uint8Array(chunk), { status: 206, headers });
      }
      return new Response(new Uint8Array(bytes), { headers });
    }

    // Ne rapatrier aucun Base64 depuis la base pour afficher la liste de ressources.
    const resources = await prisma.$queryRaw<Array<{
      id: string;
      type: string;
      title: string;
      url: string | null;
      thumbnail: string | null;
      aspectRatio: string;
      createdAt: string | Date;
    }>>`
      SELECT id, type, title,
        CASE WHEN substr(url, 1, 5) = 'data:' THEN NULL ELSE url END AS url,
        CASE WHEN substr(COALESCE(thumbnail, ''), 1, 5) = 'data:' THEN NULL ELSE thumbnail END AS thumbnail,
        aspectRatio, createdAt
      FROM MediaResource
      ORDER BY createdAt DESC
    `;
    return NextResponse.json({ resources: resources.map(resource => ({
      ...resource,
      url: resource.url ?? `/api/mobile/resources?id=${encodeURIComponent(resource.id)}&raw=1`,
      type: resource.type === 'video' || resource.type === 'pdf' ? resource.type : 'image',
      thumbnail: resource.thumbnail?.startsWith('http') || resource.thumbnail?.startsWith('/') ? resource.thumbnail : null,
      createdAt: new Date(resource.createdAt).toISOString(),
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erreur de chargement des ressources mobiles :', error);
    return NextResponse.json({ error: 'Ressources indisponibles pour le moment.' }, { status: 503 });
  }
}
