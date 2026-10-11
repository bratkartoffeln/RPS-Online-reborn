import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RpsRoom } from './RpsRoom.js';

export interface ServerConfig {
  port?: number;
  host?: string;
  reconnectSeconds?: number;
  allowedOrigins?: string[];
  staticDirectory?: string;
}

export async function startServer(config: ServerConfig = {}) {
  const allowed = new Set(config.allowedOrigins ?? []);
  const transport = new WebSocketTransport({
    maxPayload: 16 * 1024,
    pingInterval: 5000,
    pingMaxRetries: 2,
    beforeUpgrade: (request) => {
      const origin = request.headers.get('origin');
      if (allowed.size && origin && !allowed.has(origin)) return new Response('Origin not allowed', { status: 403 });
    },
  });
  const staticDirectory = config.staticDirectory ?? path.resolve('dist/client');
  const gameServer = new Server({
    transport,
    greet: false,
    gracefullyShutdown: false,
    express: (app) => {
      app.disable('x-powered-by');
      app.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
      app.get('/health', (_request, response) => response.json({ ok: true, version: '0.1.0' }));
      if (existsSync(path.join(staticDirectory, 'index.html'))) {
        app.use(express.static(staticDirectory, { index: false }));
        app.get('/', (_request, response) => response.sendFile(path.join(staticDirectory, 'index.html')));
      } else {
        app.get('/', (_request, response) => response.type('text').send('RPS-Spielserver läuft. Im Entwicklungsmodus öffne http://localhost:5173. Für den kompletten Server zuerst npm run build ausführen.'));
      }
    },
  });
  gameServer.define('rps', RpsRoom, { reconnectSeconds: config.reconnectSeconds ?? 120 });
  await gameServer.listen(config.port ?? 2567, config.host ?? '0.0.0.0');
  const address = transport.server!.address() as AddressInfo;
  return {
    gameServer,
    httpServer: transport.server!,
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    close: () => gameServer.gracefullyShutdown(false),
  };
}
