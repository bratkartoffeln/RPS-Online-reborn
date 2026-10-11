import { networkInterfaces } from 'node:os';
import { startServer } from './app.js';

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
console.log(`\nRPS Arena v0.1\nLokal: http://localhost:${running.port}`);
for (const addresses of Object.values(networkInterfaces())) {
  for (const address of addresses ?? []) {
    if (!address.internal && address.family === 'IPv4') console.log(`LAN:   http://${address.address}:${running.port}`);
  }
}
console.log('Beenden mit Strg+C.\n');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await running.close();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
