/**
 * Local integration check for the bundled Android web client.
 * Prerequisites: npm run build && npm run build:android;
 *                npx playwright install chromium; OpenSSL on PATH.
 * Optional: RPS_CHROMIUM_EXECUTABLE=/path/to/chrome.
 *
 * Uses the real built clients and Colyseus server. Only the Android plugin
 * boundary is simulated; this is not an Android-device or gesture-system test.
 * All web requests and WebSockets are restricted to our local test origins.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, access, mkdtemp, writeFile, rm } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, 'dist/android');
const assetOrigin = 'https://localhost';
const skinIds = ['classic', 'arcade', 'icq-retro', 'icq-retro-dark'];
const requests = [];
const sockets = [];
const pageErrors = [];
const unexpected = [];
const connections = new Set();
const relays = new Set();
let stage = 'Start';
let scratch;
let proxy;
let server;
let browser;
let apiOrigin;
let otherOrigin;
let upstream;
let deadline;
let loopbackAgent;

function recordedUrl(raw) {
  const url = new URL(raw);
  for (const key of ['reconnectionToken', 'sessionId']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, '[local-test]');
  }
  return url.href;
}

function log(message) {
  stage = message;
  console.log(`Android: ${message}`);
}

function mime(filename) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' })[
      path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

async function startLocalProxy() {
  const keyPath = path.join(scratch, 'test.key');
  const certPath = path.join(scratch, 'test.crt');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=game.test',
    '-addext', 'subjectAltName=DNS:game.test,DNS:other.test,DNS:localhost'],
  { stdio: 'ignore', timeout: 15000 });

  const certificate = await readFile(certPath);
  loopbackAgent = new https.Agent({ ca: certificate, servername: 'game.test', proxyEnv: {} });

  proxy = https.createServer({ key: await readFile(keyPath), cert: certificate }, (request, response) => {
    const destination = http.request({ hostname: '127.0.0.1', port: upstream,
      method: request.method, path: request.url, headers: request.headers,
      agent: new http.Agent({ proxyEnv: {} }) }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    });
    destination.on('error', error => {
      if (!response.headersSent) response.writeHead(502);
      response.end(error.message);
    });
    request.on('aborted', () => destination.destroy());
    request.pipe(destination);
  });
  proxy.on('connection', socket => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
  });
  proxy.on('upgrade', (request, socket, head) => {
    const target = net.connect(upstream, '127.0.0.1');
    connections.add(target);
    target.on('close', () => connections.delete(target));
    target.on('error', () => socket.destroy());
    socket.on('error', () => target.destroy());
    socket.on('close', () => target.destroy());
    target.on('connect', () => {
      const headers = request.rawHeaders.reduce((lines, value, index, list) =>
        index % 2 === 0 ? `${lines}${value}: ${list[index + 1]}\r\n` : lines, '');
      target.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headers}\r\n`);
      if (head.length) target.write(head);
      target.pipe(socket);
      socket.pipe(target);
    });
  });
  await new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', resolve);
  });
  const { port } = proxy.address();
  apiOrigin = `https://game.test:${port}`;
  otherOrigin = `https://other.test:${port}`;
}

function initializeBrowser({ native, endpoint, allowedSockets }) {
  // A fail-closed socket boundary also covers protocols which page.route does
  // not intercept. No default production endpoint can leave this test browser.
  const guardSocket = OriginalWebSocket => class extends OriginalWebSocket {
    constructor(url, protocols) {
      const destination = new URL(url, location.href);
      if (!allowedSockets.includes(destination.origin)) {
        throw new Error(`Test blocked nonlocal WebSocket: ${destination.origin}`);
      }
      // Preserve the browser's synchronous constructor rejection. Colyseus
      // probes Node-style options before falling back to the browser signature;
      // Playwright's socket mock otherwise reports this mismatch asynchronously.
      if (protocols !== undefined && typeof protocols !== 'string' && !Array.isArray(protocols)) {
        throw new SyntaxError('WebSocket protocols must be a string or an array');
      }
      super(destination.href, protocols);
    }
  };
  // Playwright installs its routing shim through a separate initialization
  // script. Preserve the guard whichever initialization script runs first.
  let guardedSocket = guardSocket(window.WebSocket);
  Object.defineProperty(window, 'WebSocket', {
    configurable: true,
    get: () => guardedSocket,
    set: socketClass => { guardedSocket = guardSocket(socketClass); },
  });
  localStorage.setItem('rps-arena:animations', 'off');
  localStorage.setItem('rps-arena:sounds', 'on');
  if (!native) return;
  if (!localStorage.getItem('rps-arena:android:server')) {
    localStorage.setItem('rps-arena:android:server', endpoint);
  }
  const listeners = new Map();
  const qa = window.__androidQA = {
    clipboard: [], shares: [], calls: [], minimized: 0, active: true,
    emit(eventName, value = {}) {
      if (eventName === 'appStateChange') qa.active = value.isActive;
      for (const listener of listeners.values()) {
        if (listener.eventName === eventName) listener.callback(value);
      }
    },
  };
  window.androidBridge = { postMessage() {} };
  const methods = names => names.map(name => ({ name, rtype: name === 'addListener' ? 'callback' : 'promise' }));
  window.Capacitor = {
    PluginHeaders: [
      { name: 'App', methods: methods(['addListener', 'removeListener', 'getState', 'minimizeApp']) },
      { name: 'Clipboard', methods: methods(['write']) },
      { name: 'Share', methods: methods(['canShare', 'share']) },
    ],
    async nativePromise(plugin, method, options = {}) {
      qa.calls.push(`${plugin}.${method}`);
      if (plugin === 'App' && method === 'getState') return { isActive: qa.active };
      if (plugin === 'App' && method === 'minimizeApp') { qa.minimized++; return {}; }
      if (plugin === 'App' && method === 'removeListener') { listeners.delete(options.callbackId); return {}; }
      if (plugin === 'Clipboard' && method === 'write') { qa.clipboard.push(options.string); return {}; }
      if (plugin === 'Share' && method === 'canShare') return { value: true };
      if (plugin === 'Share' && method === 'share') { qa.shares.push(options.url); return {}; }
      throw new Error(`Unimplemented test bridge call: ${plugin}.${method}`);
    },
    nativeCallback(plugin, method, options, callback) {
      assertBridge(plugin === 'App' && method === 'addListener');
      const id = String(listeners.size + 1);
      listeners.set(id, { eventName: options.eventName, callback });
      return id;
    },
  };
  function assertBridge(valid) { if (!valid) throw new Error('Unexpected native callback'); }
}

async function createPage(native) {
  const state = { offline: false };
  const context = await browser.newContext({
    viewport: native ? { width: 412, height: 915 } : { width: 1280, height: 960 },
    isMobile: native, hasTouch: native, reducedMotion: 'reduce',
    // Only this local harness accepts its disposable self-signed certificate.
    ignoreHTTPSErrors: true, serviceWorkers: 'block',
  });
  await context.addInitScript(initializeBrowser, { native, endpoint: apiOrigin,
    allowedSockets: [apiOrigin, otherOrigin].map(value => value.replace('https:', 'wss:')) });
  const pending = new WeakMap();
  context.on('request', request => {
    const entry = { client: native ? 'android' : 'browser', stage, method: request.method(),
      url: recordedUrl(request.url()), type: request.resourceType() };
    pending.set(request, entry);
    requests.push(entry);
  });
  context.on('response', response => {
    const entry = pending.get(response.request());
    if (entry) entry.status = response.status();
  });
  context.on('requestfailed', request => {
    const entry = pending.get(request);
    if (entry) entry.failure = request.failure()?.errorText ?? 'failed';
  });
  // The test keeps public-style origins in the actual clients while forwarding
  // unchanged protocol bytes to loopback. This works even on CI machines whose
  // system proxy ignores Chromium host-resolver rules for synthetic domains.
  await context.routeWebSocket('**/*', route => {
    const url = new URL(route.url());
    if (![apiOrigin, otherOrigin].map(value => value.replace('https:', 'wss:')).includes(url.origin)) {
      unexpected.push(url.href);
      void route.close({ code: 1008, reason: 'Nonlocal test destination blocked' });
      return;
    }
    if (state.offline) {
      void route.close({ code: 1013, reason: 'Local test is offline' });
      return;
    }
    const entry = { client: native ? 'android' : 'browser', url: recordedUrl(url.href), sent: 0, received: 0 };
    sockets.push(entry);
    const remote = new WebSocket(`wss://127.0.0.1:${proxy.address().port}${url.pathname}${url.search}`, route.protocols(), {
      agent: loopbackAgent, servername: 'game.test', origin: native ? assetOrigin : apiOrigin,
      headers: { host: url.host }, handshakeTimeout: 10000,
    });
    relays.add(remote);
    const queued = [];
    let pageClosed = false;
    remote.on('open', () => { for (const message of queued.splice(0)) remote.send(message); });
    remote.on('message', (message, binary) => {
      entry.received++;
      if (!pageClosed) route.send(binary ? message : message.toString());
    });
    remote.on('close', (code, reason) => {
      relays.delete(remote);
      if (!pageClosed) void route.close({ code: [1005, 1006, 1015].includes(code) ? 1011 : code, reason: reason.toString() }).catch(() => {});
    });
    remote.on('error', error => { entry.error = error.message; });
    route.onMessage(message => {
      entry.sent++;
      if (remote.readyState === WebSocket.OPEN) remote.send(message);
      else if (remote.readyState === WebSocket.CONNECTING) queued.push(message);
    });
    route.onClose((code, reason) => {
      pageClosed = true;
      if (remote.readyState === WebSocket.OPEN) remote.close(code && ![1005, 1006, 1015].includes(code) ? code : 1000, reason);
      else remote.terminate();
    });
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (native && url.origin === assetOrigin) {
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const filename = path.resolve(bundle, '.' + relative);
      if (!filename.startsWith(bundle + path.sep)) {
        unexpected.push(url.href);
        await route.abort('blockedbyclient');
        return;
      }
      try {
        await route.fulfill({ status: 200, body: await readFile(filename), contentType: mime(filename),
          headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
        await route.fulfill({ status: 404, body: 'Bundled file missing' });
      }
      return;
    }
    if ([apiOrigin, otherOrigin].includes(url.origin)) {
      if (state.offline) {
        const entry = pending.get(request);
        if (entry) entry.expectedOffline = true;
        await route.abort('internetdisconnected');
      } else {
        const headers = Object.fromEntries(Object.entries(await request.allHeaders()).filter(([key]) => !key.startsWith(':')));
        headers.host = url.host;
        const result = await new Promise((resolve, reject) => {
          const forwarded = https.request({ hostname: '127.0.0.1', port: proxy.address().port,
            method: request.method(), path: url.pathname + url.search, headers, agent: loopbackAgent }, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('error', reject);
            response.on('end', () => resolve({ status: response.statusCode ?? 502,
              headers: Object.fromEntries(Object.entries(response.headers).filter(([, value]) => value !== undefined).map(([key, value]) =>
                [key, Array.isArray(value) ? value.join(', ') : String(value)])), body: Buffer.concat(chunks) }));
          });
          forwarded.setTimeout(12000, () => forwarded.destroy(new Error('Local HTTPS relay timed out')));
          forwarded.on('error', reject);
          forwarded.end(request.postDataBuffer());
        });
        await route.fulfill(result);
      }
      return;
    }
    unexpected.push(url.href);
    await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push({ client: native ? 'android' : 'browser', stage, message: error.message }));
  return { page, context, state };
}

async function readyLobby(page) {
  await page.locator('#player-name').waitFor();
  await page.waitForFunction(() => !document.querySelector('#app')?.inert);
  await page.waitForFunction(() => document.querySelectorAll('.design-choice').length === 4 &&
    [...document.querySelectorAll('.design-choice')].every(button => !button.disabled));
}

async function changeSkins(page) {
  for (const id of skinIds) {
    await page.locator('#design-' + id).click();
    await page.waitForFunction(skin => document.documentElement.dataset.skin === skin, id);
    assert.equal(await page.locator('#design-' + id).getAttribute('aria-pressed'), 'true');
    assert.doesNotMatch(await page.locator('#skin-status').textContent(), /Unbekannt|Fehler|aktiv: Grafikset/);
  }
}

async function waitTurn(page, number) {
  await page.waitForFunction(turn => document.querySelector('#board-phase')?.textContent === `ZUG ${turn}`, number);
}

async function sendChat(from, to, text) {
  await from.waitForTimeout(550); // Exercise normal UI input within the server's chat rate limit.
  await from.locator('#chat-input').fill(text);
  await from.locator('#chat-send').click();
  for (const page of [from, to]) {
    await page.waitForFunction(message => [...document.querySelectorAll('.chat-text')].some(row => row.textContent === message), text);
  }
}

async function makeFirstMove(page) {
  // Drive the accessible board with real keyboard events. The front row always
  // contains mobile fighters; use its spoken label to skip the flag and trap.
  await page.locator('#board').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#board')?.getAttribute('aria-busy') === 'false');
  await page.locator('#board').focus();
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  let found = false;
  for (let column = 0; column < 7; column++) {
    if (/Deine Figur: (Stein|Papier|Schere)/.test(await page.locator('#board-focus').textContent())) {
      found = true;
      break;
    }
    await page.keyboard.press('ArrowRight');
  }
  assert.ok(found, 'No movable fighter was reachable in the front row');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  assert.match(await page.locator('#board-focus').textContent(), /Zug möglich/);
  await page.keyboard.press('Enter');
}

async function run() {
  await Promise.all(['dist/android/index.html', 'dist/client/index.html', 'dist/server/server/app.js'].map(file =>
    access(path.join(root, file)).catch(() => { throw new Error(`${file} fehlt. Zuerst npm run build && npm run build:android ausführen.`); })));
  scratch = await mkdtemp(path.join(tmpdir(), 'rps-android-qa-'));
  await startLocalProxy();
  const { startServer } = await import('../dist/server/server/app.js');
  server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 60,
    staticDirectory: path.join(root, 'dist/client'), allowedOrigins: [assetOrigin, apiOrigin, otherOrigin] });
  upstream = server.port;
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.RPS_CHROMIUM_EXECUTABLE || undefined,
    args: ['--disable-dev-shm-usage'] });
  const native = await createPage(true);
  const web = await createPage(false);
  const app = native.page;
  const opponent = web.page;

  log('Lokales APK-Bundle, getrennte HTTPS-Serveradresse und vier Grafiksets');
  await Promise.all([app.goto(assetOrigin), opponent.goto(apiOrigin)]);
  await Promise.all([readyLobby(app), readyLobby(opponent)]);
  assert.equal(await app.locator('html').getAttribute('data-native'), 'true');
  assert.equal(await opponent.locator('html').getAttribute('data-native'), null);
  assert.equal(await app.locator('.native-server small').textContent(), apiOrigin);
  await app.locator('#player-name').fill('Android Test');
  await changeSkins(app);
  assert.equal(await app.locator('#player-name').inputValue(), 'Android Test');
  assert.ok(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Android lobby overflows horizontally');
  await app.screenshot({ path: path.join(scratch, 'android-lobby.png'), fullPage: true });

  log('Zwei echte Spielclients, öffentliche Einladung und Chat');
  await app.locator('#create-button').click();
  await app.locator('#room-chat').waitFor({ state: 'visible' });
  const code = (await app.locator('.room-code').textContent()).trim();
  await app.locator('#copy-button').click();
  await app.waitForFunction(() => window.__androidQA.clipboard.length === 1);
  const invitation = await app.evaluate(() => window.__androidQA.clipboard[0]);
  assert.equal(new URL(invitation).origin, apiOrigin);
  assert.equal(new URL(invitation).searchParams.get('room'), code);
  assert.ok(!invitation.includes('localhost'), 'Native invitation exposes the asset origin');
  await app.locator('[data-action="share"]').click();
  await app.waitForFunction(() => window.__androidQA.shares.length === 1);
  assert.equal(await app.evaluate(() => window.__androidQA.shares[0]), invitation);
  await opponent.locator('#player-name').fill('Browser Test');
  await opponent.locator('#room-input').fill(invitation);
  await opponent.locator('#join-button').click();
  await opponent.locator('#room-chat').waitFor({ state: 'visible' });
  await app.waitForFunction(() => document.querySelector('.player-row.enemy .player-name')?.textContent === 'Browser Test');
  await sendChat(app, opponent, 'Hallo vom installierten Client.');
  await sendChat(opponent, app, 'Antwort aus dem Browser.');

  log('Aufstellung, bestätigter Spielzug und Wiederaufnahme nach App-Wechsel');
  await app.locator('#ready-button').click();
  await opponent.locator('#ready-button').click();
  await Promise.all([waitTurn(app, 1), waitTurn(opponent, 1)]);
  await makeFirstMove(app);
  await Promise.all([waitTurn(app, 2), waitTurn(opponent, 2)]);
  assert.match(await opponent.locator('.phase-card h2').evaluate(heading => heading.getAttribute('aria-label') || heading.textContent), /Du bist am Zug/);
  assert.deepEqual(await app.locator('.move-log').first().locator('li').allTextContents(),
    await opponent.locator('.move-log').first().locator('li').allTextContents());
  await app.evaluate(() => window.__androidQA.emit('appStateChange', { isActive: false }));
  await app.waitForFunction(() => document.documentElement.dataset.appActive === 'false');
  const sleepingChat = await app.locator('#chat-messages').textContent();
  await opponent.waitForTimeout(550);
  await opponent.locator('#chat-input').fill('Nachricht während der App-Pause.');
  await opponent.locator('#chat-send').click();
  await opponent.waitForFunction(() => [...document.querySelectorAll('.chat-text')].some(row => row.textContent === 'Nachricht während der App-Pause.'));
  await app.waitForTimeout(150); // Let the real WebSocket delivery reach the suspended client.
  assert.equal(await app.locator('#chat-messages').textContent(), sleepingChat, 'Background chat still writes into the DOM');
  await app.evaluate(() => window.__androidQA.emit('appStateChange', { isActive: true }));
  await app.waitForFunction(() => document.documentElement.dataset.appActive === 'true');
  await waitTurn(app, 2);
  await app.waitForFunction(() => [...document.querySelectorAll('.chat-text')].some(row => row.textContent === 'Nachricht während der App-Pause.'));
  assert.equal(await app.locator('.board-chat-bubble').count(), 0, 'Resuming replays an old background chat bubble');
  await sendChat(opponent, app, 'Nach dem App-Wechsel wieder da.');
  await app.reload();
  await app.locator('#room-chat').waitFor({ state: 'visible' });
  await waitTurn(app, 2);
  assert.equal((await app.locator('.room-code').textContent()).trim(), code);
  await app.waitForFunction(() => [...document.querySelectorAll('.chat-text')].some(row => row.textContent === 'Hallo vom installierten Client.'));
  await app.locator('#board').scrollIntoViewIfNeeded();
  await app.screenshot({ path: path.join(scratch, 'android-match.png'), fullPage: true });

  log('Serverwechsel hält gespeicherte Sitzungen und Einladungen getrennt');
  const tokenKey = `rps-arena:android:${encodeURIComponent(apiOrigin)}:reconnect:${code}`;
  assert.ok(await app.evaluate(key => localStorage.getItem(key), tokenKey));
  await app.evaluate(endpoint => localStorage.setItem('rps-arena:android:server', endpoint), otherOrigin);
  const isolationStart = requests.length;
  await app.reload();
  await readyLobby(app);
  assert.equal(await app.locator('#room-input').inputValue(), '');
  assert.equal(await app.locator('.native-server small').textContent(), otherOrigin);
  await app.locator('#room-input').fill(invitation);
  await app.locator('#join-button').click();
  await app.waitForFunction(() => document.body.textContent.includes('Diese Einladung gehört zu'));
  assert.equal(requests.slice(isolationStart).filter(entry => entry.client === 'android' &&
    [apiOrigin, otherOrigin].includes(new URL(entry.url).origin)).length, 0, 'A saved token or mismatched invitation contacted another server');
  assert.ok(await app.evaluate(key => localStorage.getItem(key), tokenKey), 'Changing servers deleted the previous saved seat');
  await app.locator('[data-action="server-settings"]').click();
  await app.locator('#server-url').fill(apiOrigin);
  await app.locator('#server-form button[type="submit"]').click();
  await app.locator('#join-button').click();
  await app.locator('#room-chat').waitFor({ state: 'visible' });
  await waitTurn(app, 2);
  assert.equal((await app.locator('.room-code').textContent()).trim(), code);

  log('Zurück-Ereignis schützt die Partie; Lobby und Grafiksets ohne Spielserver');
  await app.evaluate(() => window.__androidQA.emit('backButton'));
  await app.locator('#modal-title').waitFor();
  assert.match(await app.locator('#modal-title').textContent(), /Zur Lobby zurück/);
  await app.evaluate(() => window.__androidQA.emit('backButton'));
  await app.locator('#modal-title').waitFor({ state: 'detached' });
  await waitTurn(app, 2);
  await app.evaluate(() => window.__androidQA.emit('backButton'));
  await app.locator('[data-action="confirm-modal"]').click();
  await readyLobby(app);
  assert.equal(await app.evaluate(key => localStorage.getItem(key), tokenKey), null, 'Leaving the room left a reusable token');
  native.state.offline = true;
  await app.reload();
  await readyLobby(app);
  await changeSkins(app);
  await app.locator('#create-button').click();
  await app.waitForFunction(() => document.querySelector('.lobby-notice')?.textContent.includes('nicht erreichbar'));
  await app.locator('[data-action="server-settings"]').click();
  await app.evaluate(() => window.__androidQA.emit('backButton'));
  await app.locator('#server-form').waitFor({ state: 'detached' });
  await app.evaluate(() => window.__androidQA.emit('backButton'));
  await app.waitForFunction(() => window.__androidQA.minimized === 1);
  await app.screenshot({ path: path.join(scratch, 'android-offline.png'), fullPage: true });

  const androidRequests = requests.filter(entry => entry.client === 'android');
  const assets = androidRequests.filter(entry => /\.(?:svg|png|webp|jpg|jpeg|wav|mp3|ogg)(?:\?|$)/i.test(entry.url));
  assert.ok(assets.length > 10, 'No meaningful set of bundled media was loaded');
  assert.ok(assets.every(entry => new URL(entry.url).origin === assetOrigin), 'Android graphics or sound came from a game server');
  assert.ok(assets.some(entry => /\.(?:wav|mp3|ogg)(?:\?|$)/i.test(entry.url)), 'No bundled sound was exercised');
  for (const id of skinIds.filter(id => id !== 'classic')) {
    assert.ok(androidRequests.some(entry => new URL(entry.url).pathname === `/skins/${id}/skin.json`), `Missing local ${id} configuration`);
  }
  assert.equal(androidRequests.filter(entry => entry.method === 'POST' && new URL(entry.url).pathname.includes('/matchmake/create/') && !entry.expectedOffline).length, 1,
    'Resume or lifecycle created an additional room');
  assert.ok(androidRequests.some(entry => entry.expectedOffline), 'Offline API failure was not exercised');
  assert.deepEqual(unexpected, [], 'A request escaped the local origins');
  assert.deepEqual(pageErrors, [], 'Uncaught browser exceptions');
  assert.deepEqual(requests.filter(entry => entry.status >= 400 || (entry.failure && !entry.expectedOffline && !entry.failure.includes('ERR_ABORTED'))), [],
    'A bundled resource or real local server request failed');
  assert.ok(sockets.some(entry => entry.client === 'android' && entry.sent >= 5 && entry.received >= 5));
  assert.ok(sockets.some(entry => entry.client === 'browser' && entry.sent >= 3 && entry.received >= 3));
  assert.deepEqual(sockets.filter(entry => entry.error), [], 'A local WebSocket relay failed');
  console.log(`Android-Integration bestanden: ${requests.length} Requests, ${assets.length} lokale Medien, ${sockets.length} echte WebSocket-Verbindungen.`);
  console.log('Geprüft: vier Designs, Browser-Gegner, Zug, Chat, öffentliche Einladungen, gespeicherte Sitzung, Servertrennung, App-Ereignisse und Offline-Lobby.');
  console.log('Die Android-Plugin-Grenze wurde simuliert; native Gerätegesten sind damit nicht verifiziert.');
}

try {
  await Promise.race([run(), new Promise((_, reject) => {
    deadline = setTimeout(() => reject(new Error(`Android-Integration nach 180 Sekunden abgebrochen (${stage}).`)), 180000);
    deadline.unref();
  })]);
} catch (error) {
  console.error(`Android-Integration fehlgeschlagen (${stage}): ${error.stack ?? error.message}`);
  if (scratch && browser) {
    for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
      await page.screenshot({ path: path.join(scratch, `failure-${index}.png`), fullPage: true, timeout: 5000 }).catch(() => {});
    }
  }
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  const cleanupDeadline = setTimeout(() => process.exit(1), 10000);
  cleanupDeadline.unref();
  await browser?.close().catch(() => {});
  for (const relay of relays) relay.terminate();
  loopbackAgent?.destroy();
  for (const connection of connections) connection.destroy();
  if (proxy?.listening) await new Promise(resolve => proxy.close(resolve));
  await server?.close().catch(() => {});
  if (scratch) {
    await writeFile(path.join(scratch, 'requests.json'), JSON.stringify({ requests, sockets, pageErrors, unexpected }, null, 2));
    await Promise.all(['test.key', 'test.crt'].map(filename => rm(path.join(scratch, filename), { force: true })));
    console.log(`Lokales QA-Protokoll und Screenshots: ${scratch}`);
  }
  clearTimeout(cleanupDeadline);
}
