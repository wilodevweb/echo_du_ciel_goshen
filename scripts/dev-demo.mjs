import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(root, '.goshen-demo');
const demoDatabase = path.join(demoDir, 'goshen.db');

await mkdir(demoDir, { recursive: true });
await writeFile(demoDatabase, '', { flag: 'a' });

// Explicitly override the project's .env so local API routes cannot reach Turso.
process.env.GOSHEN_DEMO_MODE = '1';
process.env.DATABASE_URL = `file:${demoDatabase}`;
// An empty value also prevents dotenv/Next from reloading the real Turso token.
process.env.DATABASE_AUTH_TOKEN = '';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'goshen-local-demo-secret-only';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
    const forwardInterrupt = () => child.kill('SIGINT');
    const forwardTermination = () => child.kill('SIGTERM');
    process.on('SIGINT', forwardInterrupt);
    process.on('SIGTERM', forwardTermination);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      process.off('SIGINT', forwardInterrupt);
      process.off('SIGTERM', forwardTermination);
      resolve(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
    });
  });
}

console.log('\n🧪 Goshen en mode démo : API locale + SQLite fictive isolée.');
console.log(`Base démo : ${path.relative(root, demoDatabase)}`);
console.log('Comptes : demo.admin / demo.monitor — mot de passe : demo1234\n');

const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const migrateCode = await run(process.execPath, [prismaCli, 'db', 'push']);
if (migrateCode !== 0) process.exit(migrateCode);

const seedCode = await run(process.execPath, ['scripts/seed-demo.mjs']);
if (seedCode !== 0) process.exit(seedCode);

const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const host = process.env.GOSHEN_HOST || 'localhost';
process.exitCode = await run(process.execPath, [nextCli, 'dev', '--hostname', host, '--port', '3000']);
