import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suffix = `${process.pid}-${Date.now()}`;
const image = `rps-arena-check:${suffix}`;
const container = `rps-arena-check-${suffix}`;
let created = false;
let built = false;

function dockerOutput(args) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout: 15000 });
  if (result.error || result.status !== 0) throw new Error(result.stderr?.trim() || result.error?.message || `docker ${args[0]} fehlgeschlagen`);
  return result.stdout.trim();
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} wurde mit ${code ?? signal} beendet.`)));
  });
}

try {
  try { dockerOutput(['info', '--format', '{{.ServerVersion}}']); }
  catch { throw new Error('Docker ist nicht verfügbar. Docker Engine bzw. Docker Desktop starten. Derselbe Test läuft auch im beiliegenden GitHub-Workflow.'); }
  console.log('Baue das Produktionsimage inklusive Tests und TypeScript-Prüfung …');
  await run('docker', ['build', '--pull', '--tag', image, '.']);
  built = true;
  dockerOutput(['run', '--detach', '--name', container, '--publish', '127.0.0.1::2567', '--env', 'PORT=2567', image]);
  created = true;
  assert.equal(dockerOutput(['inspect', '--format', '{{.Config.User}}', container]), 'node', 'Container läuft nicht als vorgesehener Benutzer node');
  const binding = dockerOutput(['port', container, '2567/tcp']).split('\n')[0];
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const origin = `http://${binding}`;
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    try { ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Container wurde nicht bereit');
  await run(process.execPath, ['scripts/check-online.mjs', origin]);
  dockerOutput(['stop', '--time', '10', container]);
  assert.equal(dockerOutput(['inspect', '--format', '{{.State.ExitCode}}', container]), '0', 'Server wurde nicht sauber beendet');
  console.log('Dockerprüfung bestanden: Image, Laufzeit, Spielverbindungen und geordnetes Beenden.');
} catch (error) {
  console.error(error.message);
  if (created) {
    try { console.error(dockerOutput(['logs', '--tail', '60', container])); } catch {}
  }
  process.exitCode = 1;
} finally {
  if (created) { try { dockerOutput(['rm', '--force', container]); } catch {} }
  if (built) { try { dockerOutput(['image', 'rm', image]); } catch {} }
}
