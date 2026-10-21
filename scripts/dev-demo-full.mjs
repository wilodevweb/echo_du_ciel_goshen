import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { isIPv4 } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.join(root, 'android-app');
const lanHost = process.env.GOSHEN_DEMO_HOST?.trim() || findLanIPv4();
if (!isIPv4(lanHost)) {
  throw new Error('GOSHEN_DEMO_HOST doit contenir l’adresse IPv4 LAN du PC, sans protocole.');
}
const mobileApiUrl = `http://${lanHost}:3000`;
const web = spawn(process.execPath, ['scripts/dev-demo.mjs'], {
  cwd: root,
  env: { ...process.env, GOSHEN_HOST: '0.0.0.0' },
  stdio: 'inherit',
});
const webExit = waitForExit(web);
let mobile;
let stopping = false;

function findLanIPv4() {
  const addresses = Object.values(networkInterfaces()).flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal && isIPv4(entry.address))
    .map((entry) => entry.address);
  const preferred = addresses.find((address) => address.startsWith('192.168.'))
    ?? addresses.find((address) => address.startsWith('10.'))
    ?? addresses.find((address) => {
      const secondOctet = Number(address.split('.')[1]);
      return address.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31;
    })
    ?? addresses[0];
  if (!preferred) {
    throw new Error('Aucune adresse IPv4 LAN détectée. Définissez GOSHEN_DEMO_HOST avec l’adresse IP du PC.');
  }
  return preferred;
}

function waitForExit(child) {
  const exitCode = () => child.exitCode ?? (child.signalCode === 'SIGINT' ? 130 : child.signalCode === 'SIGTERM' ? 143 : 1);
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(exitCode());
  return new Promise((resolve) => {
    child.once('error', () => resolve(1));
    child.once('exit', (code, signal) => {
      resolve(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
    });
  });
}

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (mobile && mobile.exitCode === null) mobile.kill(signal);
  if (web.exitCode === null) web.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
web.once('error', (error) => {
  console.error('Impossible de démarrer le serveur démo :', error);
  stop();
});

console.log(`\n📱 API démo pour le téléphone : ${mobileApiUrl}`);
console.log('Le téléphone et le PC doivent être sur le même Wi-Fi.\n');

let ready = false;
for (let attempt = 0; attempt < 90 && !stopping; attempt += 1) {
  if (web.exitCode !== null) break;
  try {
    const response = await fetch('http://127.0.0.1:3000/api/sync', { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // Next.js n'est pas encore prêt.
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

if (!ready || stopping) {
  if (!stopping) console.error('Le serveur démo ne répond pas sur le port 3000.');
  stop();
  process.exitCode = await webExit;
} else {
  mobile = spawn('pnpm', ['exec', 'expo', 'start', '--go', '--lan'], {
    cwd: mobileRoot,
    env: {
      ...process.env,
      EXPO_PUBLIC_SITE_URL: mobileApiUrl,
      EXPO_PUBLIC_ALLOW_INSECURE_HTTP: 'true',
      GOSHEN_DEMO_MODE: '1',
    },
    stdio: 'inherit',
  });
  const mobileExit = waitForExit(mobile);
  mobile.once('error', (error) => {
    console.error('Impossible de démarrer Expo Go :', error);
    stop();
  });
  process.exitCode = await mobileExit;
  stop('SIGINT');
  await webExit;
}
