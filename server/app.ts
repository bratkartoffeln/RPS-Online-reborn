import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RpsRoom } from './RpsRoom.js';
import { APP_VERSION } from './version.js';

export interface ServerConfig {
  port?: number;
  host?: string;
  reconnectSeconds?: number;
  allowedOrigins?: string[];
  staticDirectory?: string;
  /** Optional runtime overrides for the bundled /skins files, e.g. a NAS mount. */
  skinsDirectory?: string;
}

export async function startServer(config: ServerConfig = {}) {
  let ready = false;
  const staticDirectory = config.staticDirectory ?? path.resolve('dist/client');
  const skinsDirectory = config.skinsDirectory ? path.resolve(config.skinsDirectory) : undefined;
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
      app.get('/internal/deploy-status', (request, response) => {
        const address = request.socket.remoteAddress;
      
        if (
          address !== '127.0.0.1' &&
          address !== '::1' &&
          address !== '::ffff:127.0.0.1'
        ) {
          response.sendStatus(404);
          return;
        }
      
        response.set('Cache-Control', 'no-store').json({
          roomCount: matchMaker.stats.local.roomCount,
          connectedPlayers: matchMaker.stats.local.ccu,
        });
      });      
      app.get('/ready', (_request, response) => response.status(ready ? 200 : 503)
        .set('Cache-Control', 'no-store').json({ ok: ready, version: APP_VERSION }));
      // Skin files may be replaced on the NAS while this process is running.
      // Missing external files fall through individually to the bundled pack.
      // Keep this route before the ordinary static files so skin responses,
      // including missing files, never inherit their default browser caching.
      app.use('/skins', (_request, response, next) => {
        response.set('Cache-Control', 'no-store');
        next();
      });
      const skinFileOptions = {
        index: false as const,
        redirect: false,
        dotfiles: 'ignore' as const,
        etag: false,
        lastModified: false,
        setHeaders: (response: import('node:http').ServerResponse) => {
          response.setHeader('Cache-Control', 'no-store');
        },
      };
      if (skinsDirectory) app.use('/skins', express.static(skinsDirectory, skinFileOptions));
      const bundledSkins = path.join(staticDirectory, 'skins');
      const compressedSkins = express.static(bundledSkins, {
        ...skinFileOptions,
        setHeaders: (response) => {
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'image/svg+xml');
          response.setHeader('Content-Encoding', 'gzip');
        },
      });
      // Only built-in SVG files have build-time gzip sidecars. Live NAS files
      // have already had first refusal, so their edits never use a stale gzip.
      app.use('/skins', (request, response, next) => {
        if ((request.method !== 'GET' && request.method !== 'HEAD') || !/\.svg$/i.test(request.path)) return next();
        response.vary('Accept-Encoding');
        if (request.acceptsEncodings('gzip', 'identity') !== 'gzip') return next();
        const originalUrl = request.url;
        request.url = originalUrl.replace(/\.svg(?=\?|$)/i, '$&.gz');
        // express.static retains responsibility for paths, HEAD and streaming.
        compressedSkins(request, response, (error) => {
          request.url = originalUrl;
          if (!response.headersSent) {
            response.removeHeader('Content-Encoding');
            response.removeHeader('Content-Type');
          }
          next(error);
        });
      });
      app.use('/skins', express.static(bundledSkins, skinFileOptions));
      app.use('/skins', (_request, response) => response.status(404).type('text').send('Grafikdatei nicht gefunden.'));
      if (hasStaticClient) {
        app.use(express.static(staticDirectory, { index: false }));
        app.get('/', (_request, response) => response.set('Cache-Control', 'no-store').sendFile(path.join(staticDirectory, 'index.html')));
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
