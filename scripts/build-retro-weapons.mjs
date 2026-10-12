#!/usr/bin/env node
/**
 * Compatibility entry point for the v0.4.3 weapon artwork command.
 * Weapons now belong to the complete SVG; rebuild SVG, PNG and coordinates
 * together so the fallback can never retain an outdated weapon or pose.
 * Optional artwork tools: Python 3, Pillow, libpotrace and Inkscape.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./build-retro-atlas.py', import.meta.url));
const result = spawnSync('python3', [script, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`Grafikwerkzeug konnte nicht starten: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
