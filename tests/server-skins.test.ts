import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startServer } from '../server/app.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lFkAAAAASUVORK5CYII=', 'base64');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M1 1h14v14H1z" fill="#40591c"/></svg>';

async function put(root: string, relative: string, content: string | Buffer): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

function rawGet(port: number, target: string): Promise<{ status: number; body: string; cache: string | undefined }> {
  return new Promise((resolve, reject) => {
    const pending = request({ hostname: '127.0.0.1', port, path: target, method: 'GET' }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode!, body: Buffer.concat(chunks).toString(),
        cache: response.headers['cache-control'],
      }));
      response.on('error', reject);
    });
    pending.on('error', reject);
    pending.end();
  });
}

test('skin files use live NAS overrides and fall back to the bundled files', { timeout: 15000 }, async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'rps-skins-'));
  const client = path.join(root, 'client');
  const external = path.join(root, 'external');
  await put(client, 'index.html', '<!doctype html><title>RPS test client</title>');
  await put(client, 'skins/index.json', '{"source":"bundled catalog"}');
  await put(client, 'skins/classic/skin.json', '{"source":"bundled classic"}');
  await put(client, 'skins/classic/atlas.png', png);
  await put(client, 'skins/classic/atlas.svg', svg);
  await put(external, 'index.json', '{"source":"external catalog"}');
  await put(external, 'classic/skin.json', '{"source":"external classic"}');
  await put(external, 'mein-design/skin.json', '{"source":"custom design"}');
  await put(external, 'mein-design/atlas.png', png);
  await put(external, 'mein-design/atlas.svg', svg);
  const running = await startServer({ port: 0, host: '127.0.0.1', staticDirectory: client, skinsDirectory: external });
  try {
    await context.test('JSON overrides and vector/raster atlas files preserve MIME types and disable caching', async () => {
      for (const [route, source] of [
        ['/skins/index.json', 'external catalog'],
        ['/skins/classic/skin.json', 'external classic'],
        ['/skins/mein-design/skin.json', 'custom design'],
      ]) {
        const response = await fetch(`${running.url}${route}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type')!, /^application\/json\b/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(response.headers.get('etag'), null);
        assert.equal(response.headers.get('last-modified'), null);
        assert.deepEqual(await response.json(), { source });
      }
      for (const route of ['/skins/classic/atlas.png', '/skins/mein-design/atlas.png']) {
        const response = await fetch(`${running.url}${route}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type')!, /^image\/png\b/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      }
      for (const route of ['/skins/classic/atlas.svg', '/skins/mein-design/atlas.svg']) {
        const response = await fetch(`${running.url}${route}?skin=vector-test`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type')!, /^image\/svg\+xml\b/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(await response.text(), svg);
      }
      const home = await fetch(running.url);
      assert.equal(home.status, 200);
      assert.match(await home.text(), /RPS test client/);
    });

    await context.test('an edited file is returned immediately, and deleting it reveals its bundled fallback', async () => {
      await put(external, 'classic/skin.json', '{"source":"updated on NAS"}');
      const changed = await fetch(`${running.url}/skins/classic/skin.json`);
      assert.deepEqual(await changed.json(), { source: 'updated on NAS' });
      await rm(path.join(external, 'classic/skin.json'));
      const fallback = await fetch(`${running.url}/skins/classic/skin.json`);
      assert.equal(fallback.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await fallback.json(), { source: 'bundled classic' });
      await rm(path.join(external, 'index.json'));
      const catalog = await fetch(`${running.url}/skins/index.json`);
      assert.deepEqual(await catalog.json(), { source: 'bundled catalog' });
    });

    await context.test('directory indexes, dotfiles and traversal never expose other files', async () => {
      await put(root, 'leak.txt', 'outside either skin directory');
      await put(client, 'leak.txt', 'outside bundled skin directory');
      await put(external, 'mein-design/index.html', 'directory index must not be served');
      await put(external, '.private', 'dotfile must not be served');
      await put(external, '.hidden/skin.json', 'hidden directory must not be served');
      for (const route of [
        '/skins', '/skins/', '/skins/mein-design', '/skins/mein-design/',
        '/skins/.private', '/skins/.hidden/skin.json', '/skins/missing.json',
        '/skins/%2e%2e/leak.txt', '/skins/..%2fleak.txt', '/skins/%2e%2e%2fleak.txt',
      ]) {
        // Use the raw HTTP path so the client does not normalize traversal first.
        const response = await rawGet(running.port, route);
        assert.equal(response.status, 404, route);
        assert.equal(response.cache, 'no-store', route);
        assert.equal(response.body, 'Grafikdatei nicht gefunden.', route);
      }
    });
  } finally {
    await running.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('an absent optional skin directory does not prevent startup and can be added later', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rps-skins-missing-'));
  const client = path.join(root, 'client');
  const external = path.join(root, 'not-created-yet');
  await put(client, 'index.html', '<!doctype html><title>RPS test client</title>');
  await put(client, 'skins/index.json', '{"source":"bundled catalog"}');
  const running = await startServer({ port: 0, host: '127.0.0.1', staticDirectory: client, skinsDirectory: external });
  try {
    const ready = await fetch(`${running.url}/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await (await fetch(`${running.url}/skins/index.json`)).json(), { source: 'bundled catalog' });
    await put(external, 'index.json', '{"source":"new external catalog"}');
    assert.deepEqual(await (await fetch(`${running.url}/skins/index.json`)).json(), { source: 'new external catalog' });
  } finally {
    await running.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('production online checks validate SVG and configured raster fallback without rejecting NAS overrides', async (context) => {
  const { checkRetroSkin } = await import(new URL('../scripts/check-online.mjs', import.meta.url).href);
  context.mock.method(console, 'log', () => {});
  const base = new URL('https://arena.example/');
  const configPath = '/skins/icq-retro/skin.json';
  type File = { type: string; body: string | Buffer; status?: number };
  const verify = async (atlas: unknown, files: Record<string, File> = {}) => {
    const requested: string[] = [];
    const get = async (resource: string | URL, redirect: string) => {
      assert.equal(redirect, 'error', 'Atlas checks must not follow image redirects.');
      const url = new URL(resource, base);
      assert.equal(url.origin, base.origin);
      requested.push(url.pathname);
      const file: File = url.pathname === configPath
        ? { type: 'application/json', body: JSON.stringify({ version: 1, name: 'NAS-Design', atlas }) }
        : files[url.pathname] ?? { type: 'text/plain', body: 'Missing', status: 404 };
      const response = new Response(typeof file.body === 'string' ? file.body : new Uint8Array(file.body), {
        status: file.status ?? 200, headers: { 'content-type': file.type },
      });
      assert.equal(response.status, 200, `${url.pathname}: HTTP ${response.status}`);
      return response;
    };
    await checkRetroSkin(get, base);
    return requested;
  };
  const vectorFile = { '/skins/icq-retro/atlas.svg': { type: 'image/svg+xml; charset=utf-8', body: `<?xml version="1.0"?>\n<!-- Native SVG -->\n${svg}` } };
  const vectorAtlas = { image: 'atlas.svg', fallbackImage: 'backup/atlas.png' };
  const rasterFile = { '/skins/icq-retro/backup/atlas.png': { type: 'image/png', body: png } };

  await context.test('an atlas-free NAS override stays valid', async () => {
    assert.deepEqual(await verify(undefined), [configPath]);
  });
  await context.test('SVG and its configured PNG replacement are both checked', async () => {
    assert.deepEqual(await verify(vectorAtlas, { ...vectorFile, ...rasterFile }), [configPath, '/skins/icq-retro/atlas.svg', '/skins/icq-retro/backup/atlas.png']);
    assert.deepEqual(await verify({ image: 'atlas.svg' }, vectorFile), [configPath, '/skins/icq-retro/atlas.svg']);
  });
  await context.test('legacy PNG, WebP and JPEG NAS atlases remain supported', async () => {
    for (const [image, type, body] of [
      ['atlas.png', 'image/png', png],
      ['atlas.webp', 'image/webp', Buffer.from('RIFF0000WEBP0')],
      ['atlas.jpg', 'image/jpeg', Buffer.from([255, 216, 255, 0])],
    ] as const) {
      const path = `/skins/icq-retro/${image}`;
      assert.deepEqual(await verify({ image }, { [path]: { type, body } }), [configPath, path]);
    }
  });
  await context.test('a missing or corrupted configured fallback fails deployment verification', async () => {
    await assert.rejects(verify(vectorAtlas, vectorFile), /atlas\.png: HTTP 404/);
    await assert.rejects(verify(vectorAtlas, { ...vectorFile, '/skins/icq-retro/backup/atlas.png': { type: 'image/png', body: 'not a PNG' } }), /Rasterfallback.*keine PNG-Datei/);
  });
  await context.test('SVG responses need the correct MIME type and an actual SVG root', async () => {
    await assert.rejects(verify({ image: 'atlas.svg' }, { '/skins/icq-retro/atlas.svg': { type: 'text/html', body: svg } }), /image/);
    await assert.rejects(verify({ image: 'atlas.svg' }, { '/skins/icq-retro/atlas.svg': { type: 'image/svg+xml', body: '<!doctype html><html><svg></svg></html>' } }), /SVG-Wurzelelement/);
    await assert.rejects(verify({ image: 'atlas.svg' }, { '/skins/icq-retro/atlas.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg">' } }), /vollständige SVG/);
  });
  await context.test('main and fallback paths stay within the selected pack, and the fallback is raster', async () => {
    for (const image of ['../atlas.svg', '/atlas.svg', 'https://host/atlas.svg', 'atlas.svg#frame']) {
      await assert.rejects(verify({ image }), /atlas\.image.*sichere relative/);
    }
    for (const fallbackImage of ['../atlas.png', 'https://host/atlas.png', 'other.svg', 'atlas.png?cache=1']) {
      await assert.rejects(verify({ image: 'atlas.svg', fallbackImage }, vectorFile), /atlas\.fallbackImage.*sichere relative/);
    }
    await assert.rejects(verify({ image: 'atlas.png', fallbackImage: 'atlas.png' }), /andere Datei/);
  });
});
