import { Directory, File, Paths } from 'expo-file-system';
import type { Child } from '../types';

const PHOTO_DIRECTORY = new Directory(Paths.document, 'child-photos');
let directoryReady: Promise<void> | null = null;

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function ensureDirectory(): Promise<void> {
  if (!directoryReady) directoryReady = Promise.resolve().then(() => PHOTO_DIRECTORY.create({ idempotent: true, intermediates: true }));
  return directoryReady;
}

export async function persistPhotoUri(uri: string, childId: string): Promise<string> {
  await ensureDirectory();
  const destination = new File(PHOTO_DIRECTORY, `${safeId(childId)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  if (uri.startsWith('data:')) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Impossible de lire la photo sélectionnée.');
    destination.create({ overwrite: true, intermediates: true });
    destination.write(new Uint8Array(await response.arrayBuffer()));
  } else {
    const source = new File(uri);
    if (source.uri !== destination.uri) await source.copy(destination, { overwrite: true });
  }
  return destination.uri;
}

export async function childPhotoToDataUrl(uri: string | null | undefined): Promise<string> {
  if (!uri) return '';
  if (uri.startsWith('data:')) return uri;
  if (!uri.startsWith('file://')) return uri;
  const file = new File(uri);
  return `data:image/jpeg;base64,${await file.base64()}`;
}

export async function normalizeChildPhotos(children: Child[]): Promise<{ children: Child[]; changed: boolean }> {
  let changed = false;
  const normalized = await Promise.all(children.map(async child => {
    if (!child.photoUrl?.startsWith('data:')) return child;
    try {
      const photoUrl = await persistPhotoUri(child.photoUrl, child.id);
      changed = true;
      return { ...child, photoUrl };
    } catch {
      return child;
    }
  }));
  return { children: normalized, changed };
}
