import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RpsRoom } from './RpsRoom.js';
import { APP_VERSION } from './version.js';

export interface ServerConfig {
  port?: number;
  host?: string;
  reconnectSeconds?: number;
  allowedOrigins?: string[];
  staticDirectory?: string;
}

export async function startServer(config: ServerConfig = {}) {
  let ready = false;
  const staticDirectory = config.staticDirectory ?? path.resolve('dist/client');
  const hasStaticClient = existsSync(path.join(staticDirectory, 'index.html'));
  if (process.env.NODE_ENV === 'production' && !hasStaticClient) {
    throw new Error('Der Produktionsbuild fehlt. Vor dem Serverstart npm run build ausführen.');
  }
  const allowed = new Set(config.allowedOrigins ?? []);
  const transport = new WebSocketTransport({
    maxPayload: 16 * 1024,
    pingInterval: 5000,
    pingMaxRetries: 2,
    beforeUpgrade: (request) => {
      if (!ready) return new Response('Der Spielserver ist noch nicht bereit oder wird beendet.', { status: 503 });
      const origin = request.headers.get('origin');
      if (allowed.size && origin && !allowed.has(origin)) return new Response('Origin not allowed', { status: 403 });
    },
  });
  const gameServer = new Server({
    transport,
    greet: false,
    gracefullyShutdown: false,
    express: (app) => {
      app.disable('x-powered-by');
      app.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
      app.get('/health', (_request, response) => response.set('Cache-Control', 'no-store').json({ ok: true, version: APP_VERSION }));
      app.get('/ready', (_request, response) => response.status(ready ? 200 : 503)
        .set('Cache-Control', 'no-store').json({ ok: ready, version: APP_VERSION }));
      if (hasStaticClient) {
        app.use(express.static(staticDirectory, { index: false }));
        app.get('/', (_request, response) => response.sendFile(path.join(staticDirectory, 'index.html')));
      } else {
        app.get('/', (_request, response) => response.type('text').send('RPS-Spielserver läuft. Im Entwicklungsmodus öffne http://localhost:5173. Für den kompletten Server zuerst npm run build ausführen.'));
      }
    },
  });
  gameServer.onBeforeShutdown(() => { ready = false; });
  gameServer.define('rps', RpsRoom, { reconnectSeconds: config.reconnectSeconds ?? 120 });
  await gameServer.listen(config.port ?? 2567, config.host ?? '0.0.0.0');
  ready = true;
  const address = transport.server!.address() as AddressInfo;
  let closePromise: Promise<void> | undefined;
  const close = () => {
    // Synchronous readiness change also covers repeated or concurrent SIGTERM
    // handling while Colyseus asynchronously closes rooms and the transport.
    ready = false;
    closePromise ??= gameServer.gracefullyShutdown(false);
    return closePromise;
  };
  return {
    gameServer,
    httpServer: transport.server!,
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    close,
  };
}
