const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;
type AttemptBucket = { failures: number; expiresAt: number };

const failedAttempts = new Map<string, AttemptBucket>();

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  const value = key ? headers[key] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeLogin(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function bucketKey(headers: HeaderSource, login: string): string {
  const realIp = readHeader(headers, "x-real-ip")?.trim();
  const forwardedIp = readHeader(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp || forwardedIp || "unknown";
  return `${ip}:${normalizeLogin(login)}`;
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of failedAttempts) {
    if (bucket.expiresAt <= now) failedAttempts.delete(key);
  }
}

export function getAuthRateLimit(headers: HeaderSource, login: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = bucketKey(headers, login);
  const bucket = failedAttempts.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (failedAttempts.size > 10_000) pruneExpired(now);
    return { limited: false, retryAfterSeconds: 0 };
  }

  return {
    limited: bucket.failures >= MAX_FAILURES,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
  };
}

export function recordAuthFailure(headers: HeaderSource, login: string): void {
  const now = Date.now();
  const key = bucketKey(headers, login);
  const current = failedAttempts.get(key);
  if (!current || current.expiresAt <= now) {
    if (failedAttempts.size > 10_000) pruneExpired(now);
    failedAttempts.set(key, { failures: 1, expiresAt: now + WINDOW_MS });
    return;
  }
  current.failures += 1;
}

export function clearAuthFailures(headers: HeaderSource, login: string): void {
  failedAttempts.delete(bucketKey(headers, login));
}
