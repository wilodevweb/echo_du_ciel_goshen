import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDatabase = path.join(projectRoot, '.goshen-demo', 'goshen.db');
let configuredDatabase = '';

try {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.protocol === 'file:') configuredDatabase = path.resolve(decodeURIComponent(url.pathname));
} catch {
  // The database must pass the explicit local-demo guard below.
}

if (process.env.GOSHEN_DEMO_MODE !== '1' || configuredDatabase !== demoDatabase) {
  throw new Error('Le seed Prisma est limité à .goshen-demo/goshen.db. Aucune base réelle ne sera modifiée.');
}

await import('./seed-demo.mjs');
