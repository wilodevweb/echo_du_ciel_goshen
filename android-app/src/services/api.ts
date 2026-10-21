import Constants from 'expo-constants';
import { File as ExpoFile } from 'expo-file-system';
import type { ActivityLog, AdminUser, MediaResource, Session, SyncPayload, SyncResponse } from '../types';

const configuredSiteUrl = Constants.expoConfig?.extra?.siteUrl;
const allowInsecureHttp = Constants.expoConfig?.extra?.allowInsecureHttp === true;
const SITE_URL = normalizeSiteUrl(configuredSiteUrl, allowInsecureHttp);

function normalizeSiteUrl(value: unknown, allowLocalHttp: boolean): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(value);
    const localHttp = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '10.0.2.2' || allowLocalHttp);
    if (parsed.protocol !== 'https:' && !localHttp) return '';
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}

export function getSiteUrl(): string { return SITE_URL; }

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('Le serveur ne répond pas. Vérifiez la connexion et réessayez.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs = 20_000): Promise<{ response: Response; body: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(error => {
      if (controller.signal.aborted) throw error;
      return null;
    }) as T | null;
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('Le serveur ne répond pas. Vérifiez la connexion et réessayez.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function request<T>(path: string, init?: RequestInit, token?: string, timeoutMs = 20_000): Promise<T> {
  if (!SITE_URL || SITE_URL.includes('${')) throw new ApiError('Configurez EXPO_PUBLIC_SITE_URL avant de démarrer l’application.');
  const { response, body } = await fetchJsonWithTimeout<T>(`${SITE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  }, timeoutMs);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error : response.status === 401 ? 'Session expirée, reconnectez-vous.' : `Erreur du serveur (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  if (!body) throw new ApiError('Réponse vide du serveur.');
  return body;
}

export async function signIn(username: string, password: string): Promise<Session> {
  const result = await request<{ token: string; user: { name?: string | null; username: string; role: string } }>('/api/mobile/session', {
    method: 'POST', body: JSON.stringify({ username, password }),
  });
  const session: Session = {
    token: result.token,
    username: result.user.username,
    name: result.user.name ?? result.user.username,
    role: result.user.role,
  };
  return session;
}

export function postSync(payload: SyncPayload, token: string): Promise<SyncResponse> {
  return request<SyncResponse>('/api/sync', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export async function uploadMobileChildPhoto(session: Session, childId: string, photoDataUrl: string): Promise<void> {
  if (!SITE_URL) throw new ApiError('Configurez EXPO_PUBLIC_SITE_URL avant de démarrer l’application.');
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(photoDataUrl);
  if (!match) throw new ApiError('Le format de la photo de l’enfant est invalide.');

  const binary = globalThis.atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const form = new FormData();
  form.append('childId', childId);
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'child-photo.jpg');

  const response = await fetchWithTimeout(`${SITE_URL}/api/mobile/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
    body: form,
  }, 30_000);
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new ApiError(body?.error ?? `Erreur du serveur (${response.status}).`, response.status);
}

export async function getMobileResourceContent(session: Session, id: string): Promise<string> {
  const result = await request<{ url: string }>(`/api/mobile/resources?id=${encodeURIComponent(id)}`, undefined, session.token, 120_000);
  return result.url;
}

export async function getMobileResources(session: Session): Promise<MediaResource[]> {
  const result = await request<{ resources: MediaResource[] }>('/api/mobile/resources', undefined, session.token);
  return result.resources;
}

export function getMobileAdmin(session: Session): Promise<{ users: AdminUser[]; logs: ActivityLog[]; currentUserId: string }> {
  return request('/api/mobile/admin', undefined, session.token);
}

export function postMobileAdmin<T>(session: Session, payload: Record<string, string | boolean>): Promise<T> {
  return request<T>('/api/mobile/admin', { method: 'POST', body: JSON.stringify(payload) }, session.token);
}

export async function uploadMobileResource(session: Session, input: { uri: string; fileName: string; mimeType: string; title: string; type: MediaResource['type']; aspectRatio: 'square' | 'wide' | 'tall' }): Promise<void> {
  if (!SITE_URL) throw new ApiError('Configurez EXPO_PUBLIC_SITE_URL avant de démarrer l’application.');
  const form = new FormData();
  form.append('file', new ExpoFile(input.uri), input.fileName);
  form.append('title', input.title);
  form.append('type', input.type);
  form.append('aspectRatio', input.aspectRatio);
  const response = await fetchWithTimeout(`${SITE_URL}/api/mobile/upload`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body: form }, 120_000);
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new ApiError(body?.error ?? `Erreur du serveur (${response.status}).`, response.status);
}

export function resolveResourceUrl(value: string): string {
  if (/^(https?:\/\/|data:|file:|content:)/i.test(value)) return value;
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}
