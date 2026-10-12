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
  const observer = { room, snapshot: null, updates: 0, problems: [] };
  room.onMessage('snapshot', (snapshot) => { observer.snapshot = snapshot; observer.updates++; });
  room.onMessage('server_shutdown', () => {});
  room.onMessage('problem', (problem) => { observer.problems.push(problem.message); });
  room.onError(() => {});
  room.send('sync');
  observer.wait = async (predicate, description) => {
    try { await until(() => observer.snapshot && predicate(observer.snapshot), description); }
    catch (error) {
      if (observer.problems.length) error.message += ` (Spielserver: ${observer.problems.at(-1)})`;
      throw error;
    }
    return observer.snapshot;
  };
  return observer;
}

function matchIdentity(player) {
  return { seriesId: player.snapshot.series.id, matchId: player.snapshot.series.matchId };
}

function checkHiddenArmies(players) {
  for (const player of players) {
    const view = player.snapshot;
    const own = view.board.filter((piece) => piece?.owner === view.you);
    const enemy = view.board.filter((piece) => piece && piece.owner !== view.you);
    assert.equal(own.length, 14);
    assert.equal(enemy.length, 14);
    assert.ok(own.every((piece) => piece.kind !== null));
    assert.ok(enemy.every((piece) => piece.kind === null), 'Gegnerische Figuren sind nicht verborgen');
  }
}

async function rejected(player, message, payload) {
  const problems = player.problems.length;
  const updates = player.updates;
  const before = player.snapshot;
  player.room.send(message, payload);
  await until(() => player.problems.length > problems && player.updates > updates, `${message} wird abgelehnt`);
  assert.deepEqual(player.snapshot, before, `${message}: abgelehnte Aktion verändert den Spielstand`);
}

async function firstMove(player, players) {
  const [from, targets] = Object.entries(player.snapshot.legalMoves).find(([, moves]) => moves.length) ?? [];
  assert.ok(from !== undefined, 'Kein erster Zug verfügbar');
  player.room.send('move', { from: Number(from), to: targets[0], revision: player.snapshot.revision });
  await Promise.all(players.map((entry) => entry.wait((view) => view.turnNumber === 1, 'erster Zug')));
}

export async function checkRetroSkin(get, base) {
  const configPath = '/skins/icq-retro/skin.json';
  const response = await get(configPath, 'error');
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  const skin = await response.json();
  assert.equal(skin.version, 1, 'Retro-Grafikset: unbekannte Konfigurationsversion');
  assert.ok(typeof skin.name === 'string' && skin.name.trim(), 'Retro-Grafikset: Name fehlt');
  // An external NAS config is the active pack, including a valid vector-only
  // replacement. Do not bypass it or assume the bundled atlas filename/layout.
  if (skin.atlas === undefined) {
    console.log('OK: Retro-Grafikset wird als Vektorkonfiguration ohne Atlas ausgeliefert.');
    return;
  }
  const images = [{ image: skin.atlas?.image, label: 'atlas.image', vectorAllowed: true }];
  if (skin.atlas?.fallbackImage !== undefined) {
    assert.notEqual(skin.atlas.fallbackImage, skin.atlas.image, 'Retro-Grafikset: fallbackImage muss eine andere Datei verwenden');
    images.push({ image: skin.atlas.fallbackImage, label: 'atlas.fallbackImage', vectorAllowed: false });
  }
  for (const { image, label, vectorAllowed } of images) {
    const formats = vectorAllowed ? /\.(svg|png|webp|jpe?g)$/i : /\.(png|webp|jpe?g)$/i;
    assert.ok(typeof image === 'string' && image.length <= 200 && formats.test(image) &&
      image.split('/').every((segment) => /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(segment)) && !/[\\:%?#]/.test(image),
    `Retro-Grafikset: ${label} muss eine sichere relative ${vectorAllowed ? 'SVG-/PNG-/WebP-/JPEG-' : 'PNG-/WebP-/JPEG-'}Datei innerhalb des Grafiksets sein`);
    const imageUrl = new URL(image, new URL(configPath, base));
    assert.equal(imageUrl.origin, base.origin, 'Retro-Atlas muss von derselben Origin kommen');
    assert.ok(imageUrl.pathname.startsWith('/skins/icq-retro/'), 'Retro-Atlas verlässt das Grafikset');
    const atlas = await get(imageUrl, 'error');
    const bytes = Buffer.from(await atlas.arrayBuffer());
    const description = label === 'atlas.image' ? 'Retro-Atlas' : 'Retro-Rasterfallback';
    if (/\.svg$/i.test(image)) {
      assert.match(atlas.headers.get('content-type') ?? '', /^image\/svg\+xml\b/);
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
      // A file signature check, not an XML renderer: permit normal XML headers,
      // comments and a simple SVG doctype, but reject HTML/error pages as SVG.
      const document = xml.replace(/^(?:(?:<\?xml\b[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE\s+svg\b[^>]*>)\s*)*/i, '');
      const root = document.match(/^<svg\b[^>]*>/i)?.[0];
      assert.ok(root && /\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(root), `${description} enthält kein SVG-Wurzelelement`);
      assert.ok(/\/\s*>$/.test(root) || /<\/svg\s*>/i.test(document), `${description} ist keine vollständige SVG-Datei`);
    } else if (/\.png$/i.test(image)) {
      assert.match(atlas.headers.get('content-type') ?? '', /^image\/png\b/);
      assert.ok(bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${description} ist keine PNG-Datei`);
    } else if (/\.webp$/i.test(image)) {
      assert.match(atlas.headers.get('content-type') ?? '', /^image\/webp\b/);
      assert.ok(bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', `${description} ist keine WebP-Datei`);
    } else {
      assert.match(atlas.headers.get('content-type') ?? '', /^image\/jpeg\b/);
      assert.ok(bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, `${description} ist keine JPEG-Datei`);
    }
  }
  console.log(`OK: Retro-Grafikset und konfigurierte Atlasdateien (${images.map(({ image }) => image).join(', ')}).`);
}

export async function checkOnline(address) {
  if (!address) throw new Error('Aufruf: npm run check:online -- https://DEIN-DIENST.onrender.com');
  const base = new URL(address);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Bitte nur die HTTP-/HTTPS-Basisadresse ohne Pfad, Passwort oder Parameter angeben.');
  }
  console.log(`Prüfe ${base.origin} (erwartete Version ${version})`);
  const get = async (resource, redirect = 'follow') => {
    const response = await fetch(new URL(resource, base), { signal: AbortSignal.timeout(10000), redirect });
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
  await checkRetroSkin(get, base);

  const client = new Client(base.origin);
  const rooms = [];
  try {
    let a = observe(await client.create('rps', { name: 'Online-Prüfung A', seriesMode: 'best-of-3' }));
    rooms.push(a.room);
    await a.wait((view) => view.phase === 'waiting', 'erster Spieler');
    const b = observe(await client.joinById(a.room.roomId, { name: 'Online-Prüfung B' }));
    rooms.push(b.room);
    await Promise.all([a, b].map((player) => player.wait((view) => view.players.length === 2, 'zweiter Spieler')));
    const aId = a.room.sessionId;
    const bId = b.room.sessionId;
    checkHiddenArmies([a, b]);
    assert.equal(a.snapshot.series?.mode, 'best-of-3', 'Server übernimmt den gewählten Serienmodus nicht');
    assert.equal(a.snapshot.series.targetWins, 2);
    assert.equal(a.snapshot.series.gameNumber, 1);
    assert.equal(a.snapshot.series.completedGames, 0);
    assert.deepEqual(a.snapshot.series.winsByPlayer, { [aId]: 0, [bId]: 0 });
    assert.deepEqual(a.snapshot.series, b.snapshot.series);
    a.room.send('ready');
    b.room.send('ready');
    await Promise.all([a, b].map((player) => player.wait((view) => view.phase === 'playing', 'Partiestart')));
    assert.equal(a.snapshot.currentTurn, aId);
    await firstMove(a, [a, b]);
    console.log('OK: Zwei echte Spielverbindungen, verdeckte Figuren und bestätigter Zug.');

    // Only our newly created test room is affected by these synthetic endings.
    b.room.send('resign');
    await Promise.all([a, b].map((player) => player.wait((view) =>
      view.phase === 'finished' && view.series.completedGames === 1, 'erste gewertete Partie')));
    assert.equal(a.snapshot.winner, aId);
    assert.equal(a.snapshot.series.winner, null);
    assert.deepEqual(a.snapshot.series.winsByPlayer, { [aId]: 1, [bId]: 0 });
    await rejected(b, 'resign');
    const first = matchIdentity(a);
    a.room.send('restart', first);
    await Promise.all([a, b].map((player) => player.wait((view) =>
      view.players.find((entry) => entry.id === aId).restartRequested, 'erste Stimme für die nächste Partie')));
    assert.equal(a.snapshot.phase, 'finished', 'Eine einzelne Stimme startet die nächste Partie');
    assert.equal(a.snapshot.series.completedGames, 1);
    b.room.send('restart', first);
    await Promise.all([a, b].map((player) => player.wait((view) =>
      view.phase === 'setup' && view.series.gameNumber === 2, 'gemeinsam bestätigte nächste Partie')));
    assert.equal(a.snapshot.series.id, first.seriesId);
    assert.notEqual(a.snapshot.series.matchId, first.matchId);
    assert.equal(a.snapshot.series.startingPlayer, bId);
    assert.equal(a.snapshot.series.startingSeat, 1);
    assert.deepEqual(a.snapshot.series.winsByPlayer, { [aId]: 1, [bId]: 0 });
    checkHiddenArmies([a, b]);
    a.room.send('ready');
    b.room.send('ready');
    await Promise.all([a, b].map((player) => player.wait((view) => view.phase === 'playing', 'Start der zweiten Partie')));
    assert.equal(a.snapshot.currentTurn, bId, 'Der Startspieler hat nicht gewechselt');
    await firstMove(b, [a, b]);
    console.log('OK: Best-of-3, einmalige Wertung, gemeinsame Fortsetzung und wechselnder Startspieler.');

    const beforeReconnect = a.snapshot;
    const token = a.room.reconnectionToken;
    a.room.connection.close(4010, 'online verification');
    await b.wait((view) => view.paused, 'Pause nach Verbindungsabbruch');
    a = observe(await client.reconnect(token));
    rooms.push(a.room);
    await Promise.all([a, b].map((player) => player.wait((view) =>
      !view.paused && view.players.every((entry) => entry.connected), 'Wiederbeitritt')));
    assert.equal(a.room.sessionId, aId);
    assert.equal(a.snapshot.turnNumber, 1);
    assert.equal(a.snapshot.series.winsByPlayer[aId], 1, 'Der Siegstand geht beim Wiederbeitritt verloren');
    assert.deepEqual(a.snapshot.series, beforeReconnect.series);
    assert.deepEqual(a.snapshot.board, beforeReconnect.board);
    assert.equal(a.snapshot.currentTurn, beforeReconnect.currentTurn);
    assert.deepEqual(a.snapshot.series, b.snapshot.series);
    console.log('OK: Wiederbeitritt erhält Spieleridentität, verdeckten Spielstand und einen bereits gewerteten Sieg.');

    b.room.send('resign');
    await Promise.all([a, b].map((player) => player.wait((view) =>
      view.phase === 'finished' && view.series.completedGames === 2, 'entscheidender zweiter Sieg')));
    assert.equal(a.snapshot.winner, aId);
    assert.equal(a.snapshot.series.winner, aId);
    assert.deepEqual(a.snapshot.series.winsByPlayer, { [aId]: 2, [bId]: 0 });
    const decided = matchIdentity(a);
    const seriesNumber = a.snapshot.series.number;
    await rejected(a, 'restart', decided);
    a.room.send('new_series', decided);
    await Promise.all([a, b].map((player) => player.wait((view) =>
      view.players.find((entry) => entry.id === aId).newSeriesRequested, 'erste Stimme für eine neue Serie')));
    assert.equal(a.snapshot.phase, 'finished');
    assert.equal(a.snapshot.series.id, decided.seriesId);
    assert.equal(a.snapshot.series.winsByPlayer[aId], 2, 'Eine einzelne Stimme setzt die Wertung zurück');
    b.room.send('new_series', decided);
    await Promise.all([a, b].map((player) => player.wait((view) =>
      view.phase === 'setup' && view.series.number === seriesNumber + 1, 'gemeinsam bestätigte neue Serie')));
    assert.notEqual(a.snapshot.series.id, decided.seriesId);
    assert.notEqual(a.snapshot.series.matchId, decided.matchId);
    assert.equal(a.snapshot.series.mode, 'best-of-3');
    assert.equal(a.snapshot.series.gameNumber, 1);
    assert.equal(a.snapshot.series.completedGames, 0);
    assert.equal(a.snapshot.series.draws, 0);
    assert.equal(a.snapshot.series.winner, null);
    assert.equal(a.snapshot.series.startingPlayer, aId);
    assert.deepEqual(a.snapshot.series.winsByPlayer, { [aId]: 0, [bId]: 0 });
    assert.deepEqual(a.snapshot.series, b.snapshot.series);
    checkHiddenArmies([a, b]);
    console.log('OK: Zweiter Sieg entscheidet die Serie; nur beide Stimmen starten eine neue Serie mit leerer Wertung.');
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
