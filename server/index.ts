import { networkInterfaces } from 'node:os';
import { startServer } from './app.js';
import { APP_VERSION } from './version.js';

const port = Number(process.env.PORT || 2567);
const reconnectSeconds = Number(process.env.RECONNECT_SECONDS || 120);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT muss zwischen 1 und 65535 liegen.');
if (!Number.isFinite(reconnectSeconds) || reconnectSeconds < 1 || reconnectSeconds > 600) throw new Error('RECONNECT_SECONDS muss zwischen 1 und 600 liegen.');

const running = await startServer({
  port,
  host: process.env.HOST || '0.0.0.0',
  reconnectSeconds,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean),
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await running.close();
  } catch (error) {
    console.error('Der Spielserver konnte nicht vollständig beendet werden.', error);
    process.exitCode = 1;
  }
}
// Install lifecycle hooks before optional status output. An unavailable OS
// network inventory must never break startup or disable orderly shutdown.
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

console.log(`\nRPS Arena v${APP_VERSION}\nLokal: http://localhost:${running.port}`);
if (process.env.NODE_ENV !== 'production') {
  try {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (!address.internal && address.family === 'IPv4') console.log(`LAN:   http://${address.address}:${running.port}`);
      }
    }
  } catch {
    console.warn('LAN-Adressen konnten nicht automatisch ermittelt werden. Der Spielserver läuft trotzdem.');
  }
}
console.log('Beenden mit Strg+C.\n');
