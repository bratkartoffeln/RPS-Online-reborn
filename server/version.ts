import { existsSync, readFileSync } from 'node:fs';

// Source lives in server/; tsc emits dist/server/server/. Both installations
// keep the authoritative package.json at the project root (also in Docker).
const manifest = [
  new URL('../package.json', import.meta.url),
  new URL('../../../package.json', import.meta.url),
].find((candidate) => existsSync(candidate));
if (!manifest) throw new Error('Die package.json mit der Anwendungsversion fehlt.');

const metadata = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown };
if (typeof metadata.version !== 'string' || !metadata.version) throw new Error('Die Anwendungsversion in package.json ist ungültig.');
export const APP_VERSION = metadata.version;
