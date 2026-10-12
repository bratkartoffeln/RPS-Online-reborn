import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { request, type IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync, gunzipSync } from 'node:zlib';
import { startServer } from '../server/app.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">' +
  '<path d="M1 1h14v14H1z" fill="#40591c"/>'.repeat(40) + '</svg>';

async function put(root: string, relative: string, content: string | Buffer): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

function rawRequest(port: number, target: string, encoding?: string, method = 'GET'):
  Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const pending = request({ hostname: '127.0.0.1', port, path: target, method,
      headers: encoding === undefined ? {} : { 'Accept-Encoding': encoding },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    pending.on('error', reject);
    pending.end();
  });
}

test('bundled SVG gzip is negotiated without affecting live skin overrides', { timeout: 15000 }, async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'rps-svg-gzip-'));
  const client = path.join(root, 'client');
  const external = path.join(root, 'external');
  const compressed = gzipSync(svg, { level: 9 });
  const route = '/skins/icq-retro/atlas.svg';
  await put(client, 'index.html', '<!doctype html><title>RPS test client</title>');
  await put(client, 'skins/icq-retro/atlas.svg', svg);
  await put(client, 'skins/icq-retro/atlas.svg.gz', compressed);
  await put(client, 'skins/icq-retro/no-sidecar.svg', svg);
  await put(client, 'outside.svg', '<svg>outside skins</svg>');
  await put(client, 'outside.svg.gz', gzipSync('<svg>outside skins</svg>'));
  await put(client, 'skins/.private.svg.gz', gzipSync('private file'));
  const running = await startServer({ port: 0, host: '127.0.0.1', staticDirectory: client, skinsDirectory: external });
  try {
    await context.test('GET keeps the SVG URL and sends actual gzip with SVG MIME, Vary and no-store', async () => {
      const response = await rawRequest(running.port, route + '?skin=retro&image=atlas.svg', 'gzip, deflate, br');
      assert.equal(response.status, 200);
      assert.equal(response.headers['content-encoding'], 'gzip');
      assert.match(response.headers['content-type']!, /^image\/svg\+xml\b/);
      assert.equal(response.headers['content-length'], String(compressed.length));
      assert.match(response.headers.vary!, /\bAccept-Encoding\b/i);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers.etag, undefined);
      assert.equal(response.headers['last-modified'], undefined);
      assert.deepEqual(response.body, compressed);
      assert.equal(gunzipSync(response.body).toString(), svg);
    });

    await context.test('missing support, q=0 and an explicit identity preference use the original SVG', async () => {
      for (const encoding of [undefined, 'identity', 'br', 'gzip;q=0, identity;q=1', 'gzip;q=0.5, identity;q=1']) {
        const response = await rawRequest(running.port, route, encoding);
        assert.equal(response.status, 200, encoding);
        assert.equal(response.headers['content-encoding'], undefined, encoding);
        assert.match(response.headers['content-type']!, /^image\/svg\+xml\b/);
        assert.match(response.headers.vary!, /\bAccept-Encoding\b/i);
        assert.equal(response.body.toString(), svg);
      }
    });

    await context.test('HEAD returns the selected representation headers without a body', async () => {
      for (const encoding of ['gzip', 'identity']) {
        const response = await rawRequest(running.port, route + '?head=1', encoding, 'HEAD');
        assert.equal(response.status, 200);
        assert.equal(response.headers['content-encoding'], encoding === 'gzip' ? 'gzip' : undefined);
        assert.equal(response.headers['content-length'], String(encoding === 'gzip' ? compressed.length : Buffer.byteLength(svg)));
        assert.match(response.headers['content-type']!, /^image\/svg\+xml\b/);
        assert.match(response.headers.vary!, /\bAccept-Encoding\b/i);
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.body.length, 0);
      }
    });

    await context.test('a missing sidecar falls through to SVG and missing files remain ordinary 404s', async () => {
      for (const method of ['GET', 'HEAD']) {
        const response = await rawRequest(running.port, '/skins/icq-retro/no-sidecar.svg?version=1', 'gzip', method);
        assert.equal(response.status, 200);
        assert.equal(response.headers['content-encoding'], undefined);
        assert.match(response.headers['content-type']!, /^image\/svg\+xml\b/);
        assert.equal(response.body.toString(), method === 'GET' ? svg : '');
      }
      const missing = await rawRequest(running.port, '/skins/missing.svg', 'gzip');
      assert.equal(missing.status, 404);
      assert.equal(missing.headers['content-encoding'], undefined);
      assert.equal(missing.headers['cache-control'], 'no-store');
      assert.equal(missing.body.toString(), 'Grafikdatei nicht gefunden.');
    });

    await context.test('live external SVG always wins, including after edits and with stale external sidecars', async () => {
      await put(external, 'icq-retro/atlas.svg.gz', gzipSync('<svg>stale external</svg>'));
      for (const content of ['<svg>external artwork</svg>', '<svg>edited external artwork</svg>']) {
        await put(external, 'icq-retro/atlas.svg', content);
        const response = await rawRequest(running.port, route, 'gzip');
        assert.equal(response.status, 200);
        assert.equal(response.headers['content-encoding'], undefined);
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.body.toString(), content);
        const head = await rawRequest(running.port, route, 'gzip', 'HEAD');
        assert.equal(head.headers['content-encoding'], undefined);
        assert.equal(head.headers['content-length'], String(Buffer.byteLength(content)));
        assert.equal(head.body.length, 0);
      }
      await rm(path.join(external, 'icq-retro/atlas.svg'));
      const fallback = await rawRequest(running.port, route, 'gzip');
      assert.equal(fallback.headers['content-encoding'], 'gzip');
      assert.equal(gunzipSync(fallback.body).toString(), svg);
    });

    await context.test('compression stays within the built-in skin route and retains static path protection', async () => {
      const outside = await rawRequest(running.port, '/outside.svg', 'gzip');
      assert.equal(outside.status, 200);
      assert.equal(outside.headers['content-encoding'], undefined);
      assert.equal(outside.body.toString(), '<svg>outside skins</svg>');
      for (const target of ['/skins/..%2foutside.svg', '/skins/%2e%2e%2foutside.svg', '/skins/.private.svg']) {
        const response = await rawRequest(running.port, target, 'gzip');
        assert.equal(response.status, 404, target);
        assert.equal(response.headers['content-encoding'], undefined, target);
        assert.equal(response.headers['cache-control'], 'no-store', target);
        assert.equal(response.body.toString(), 'Grafikdatei nicht gefunden.', target);
      }
      const post = await rawRequest(running.port, route, 'gzip', 'POST');
      assert.equal(post.status, 404);
      assert.equal(post.headers['content-encoding'], undefined);
    });
  } finally {
    await running.close();
    await rm(root, { recursive: true, force: true });
  }
});
