import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Client } from '@colyseus/sdk';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function until(predicate, description, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Zeitüberschreitung: ${description}`);
    await wait(25);
  }
}

function observe(room) {
  room.reconnection.enabled = false;
  const observer = { room, snapshot: null };
  room.onMessage('snapshot', (snapshot) => { observer.snapshot = snapshot; });
  room.onMessage('server_shutdown', () => {});
  room.onMessage('problem', (problem) => { console.error(`Spielserver: ${problem.message}`); });
  room.onError(() => {});
  room.send('sync');
  observer.wait = async (predicate, description) => {
    await until(() => observer.snapshot && predicate(observer.snapshot), description);
    return observer.snapshot;
  };
  return observer;
}

export async function checkOnline(address) {
  if (!address) throw new Error('Aufruf: npm run check:online -- https://DEIN-DIENST.onrender.com');
  const base = new URL(address);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Bitte nur die HTTP-/HTTPS-Basisadresse ohne Pfad, Passwort oder Parameter angeben.');
  }
  console.log(`Prüfe ${base.origin} (erwartete Version ${version})`);
  const get = async (resource) => {
    const response = await fetch(new URL(resource, base), { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, `${resource}: HTTP ${response.status}`);
    return response;
  };
  for (const endpoint of ['/health', '/ready']) {
    const status = await (await get(endpoint)).json();
    assert.equal(status.ok, true, `${endpoint}: Dienst ist nicht bereit`);
    assert.equal(status.version, version, `${endpoint}: andere Version bereitgestellt`);
  }
  const page = await get('/');
  assert.match(page.headers.get('content-type') ?? '', /text\/html/);
  const html = await page.text();
  assert.match(html, /RPS Arena/);
  const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 2, 'Gebautes JavaScript und CSS fehlen');
  for (const asset of assets) {
    assert.equal(new URL(asset, base).origin, base.origin, 'Unerwartetes externes Browser-Asset');
    const response = await get(asset);
    assert.match(response.headers.get('content-type') ?? '', asset.endsWith('.css') ? /text\/css/ : /javascript/);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `Leeres Asset: ${asset}`);
  }
  console.log('OK: Version, Bereitschaft, Startseite und Browserdateien.');

  const client = new Client(base.origin);
  const rooms = [];
  try {
    let a = observe(await client.create('rps', { name: 'Online-Prüfung A' }));
    rooms.push(a.room);
    await a.wait((view) => view.phase === 'waiting', 'erster Spieler');
    const b = observe(await client.joinById(a.room.roomId, { name: 'Online-Prüfung B' }));
    rooms.push(b.room);
    await Promise.all([a, b].map((player) => player.wait((view) => view.players.length === 2, 'zweiter Spieler')));
    for (const player of [a, b]) {
      const view = player.snapshot;
      const own = view.board.filter((piece) => piece?.owner === view.you);
      const enemy = view.board.filter((piece) => piece && piece.owner !== view.you);
      assert.equal(own.length, 14);
      assert.equal(enemy.length, 14);
      assert.ok(own.every((piece) => piece.kind !== null));
      assert.ok(enemy.every((piece) => piece.kind === null), 'Gegnerische Figuren sind nicht verborgen');
    }
    a.room.send('ready');
    b.room.send('ready');
    await Promise.all([a, b].map((player) => player.wait((view) => view.phase === 'playing', 'Partiestart')));
    const [from, targets] = Object.entries(a.snapshot.legalMoves).find(([, moves]) => moves.length) ?? [];
    assert.ok(from !== undefined, 'Kein erster Zug verfügbar');
    a.room.send('move', { from: Number(from), to: targets[0], revision: a.snapshot.revision });
    await Promise.all([a, b].map((player) => player.wait((view) => view.turnNumber === 1, 'erster Zug')));
    console.log('OK: Zwei echte Spielverbindungen, verdeckte Figuren und bestätigter Zug.');

    const identity = a.room.sessionId;
    const token = a.room.reconnectionToken;
    a.room.connection.close(4010, 'online verification');
    await b.wait((view) => view.paused, 'Pause nach Verbindungsabbruch');
    a = observe(await client.reconnect(token));
    rooms.push(a.room);
    await Promise.all([a, b].map((player) => player.wait((view) => !view.paused, 'Wiederbeitritt')));
    assert.equal(a.room.sessionId, identity);
    assert.equal(a.snapshot.turnNumber, 1);
    console.log('OK: Wiederbeitritt erhält Spieleridentität und Spielstand.');
  } finally {
    for (const room of rooms) {
      room.reconnection.enabled = false;
      if (room.connection.isOpen) await Promise.race([room.leave(true).catch(() => {}), wait(1500)]);
      if (room.connection.isOpen) room.connection.close(1000, 'verification ended');
    }
  }
  console.log('Onlineprüfung bestanden. Die erzeugte Testpartie wurde geschlossen.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const deadline = setTimeout(() => { console.error('Onlineprüfung nach 60 Sekunden abgebrochen.'); process.exit(1); }, 60000);
  deadline.unref();
  try { await checkOnline(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  // An unreferenced deadline never keeps a successful process alive, but still
  // terminates an unresponsive socket if its close handshake cannot complete.
}
