import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matchMaker } from '@colyseus/core';
import { Client, CloseCode, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import type { GameState } from '../shared/game.js';
import { SERVER_SHUTDOWN_MESSAGE, type ServerShutdown, type Snapshot } from '../shared/protocol.js';

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Der erwartete Serverzustand wurde nicht erreicht.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function observe(room: Room) {
  const observer = {
    room,
    snapshot: undefined as Snapshot | undefined,
    shutdown: undefined as ServerShutdown | undefined,
    events: [] as string[],
    leaveCode: undefined as number | undefined,
    drops: 0,
  };
  room.onMessage('snapshot', (value: Snapshot) => {
    observer.snapshot = value;
    observer.events.push('snapshot');
  });
  room.onMessage('server_shutdown', (value: ServerShutdown) => {
    observer.shutdown = value;
    observer.events.push('server_shutdown');
  });
  room.onMessage('problem', () => {});
  room.onDrop(() => { observer.drops += 1; });
  room.onLeave((code) => { observer.leaveCode = code; observer.events.push('leave'); });
  room.onError(() => {});
  room.send('sync');
  return observer;
}

test('online server reports readiness and terminates matches explicitly on shutdown', { timeout: 15000 }, async (context) => {
  const running = await startServer({ port: 0, host: '127.0.0.1' });
  const rooms: Room[] = [];
  let releaseShutdown: (() => void) | undefined;
  try {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    await context.test('liveness and readiness return the package version without caching', async () => {
      for (const endpoint of ['/health', '/ready']) {
        const response = await fetch(`${running.url}${endpoint}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { ok: true, version: manifest.version });
      }
    });

    const client = new Client(running.url);
    const a = observe(await client.create('rps', { name: 'Alice' }));
    rooms.push(a.room);
    const b = observe(await client.joinById(a.room.roomId, { name: 'Bob' }));
    rooms.push(b.room);
    await until(() => a.snapshot?.players.length === 2 && b.snapshot?.players.length === 2);
    a.room.send('ready');
    b.room.send('ready');
    await until(() => a.snapshot?.phase === 'playing' && b.snapshot?.phase === 'playing');

    await context.test('readiness changes before drain; both players receive shutdown before close', async () => {
      // Retain the actual state in this server-only test: the last public
      // snapshot alone could miss a mistaken score after sockets have closed.
      const localRoom = matchMaker.getLocalRoomById(a.room.roomId) as unknown as { game: GameState };
      const authoritative = localRoom.game;
      const initialSeries = structuredClone(authoritative.series);
      // Keep the normal public shutdown hook pending briefly so its readiness
      // response can be observed deterministically, without timing assumptions.
      running.gameServer.onBeforeShutdown(() => new Promise<void>((resolve) => { releaseShutdown = resolve; }));
      const closing = running.close();
      assert.equal(running.close(), closing, 'concurrent closes must share the same drain');
      const readiness = await fetch(`${running.url}/ready`);
      assert.equal(readiness.status, 503);
      assert.deepEqual(await readiness.json(), { ok: false, version: manifest.version });
      const liveness = await fetch(`${running.url}/health`);
      assert.equal(liveness.status, 200, 'a draining process is still alive');
      releaseShutdown!();
      await closing;
      await until(() => a.leaveCode !== undefined && b.leaveCode !== undefined);
      assert.deepEqual(structuredClone(authoritative.series), initialSeries, 'shutdown callbacks cannot mutate the authoritative series');
      assert.equal(authoritative.phase, 'playing');
      assert.equal(authoritative.winner, null);

      for (const observer of [a, b]) {
        assert.deepEqual(observer.shutdown, { message: SERVER_SHUTDOWN_MESSAGE });
        assert.deepEqual(observer.events.slice(-2), ['server_shutdown', 'leave']);
        assert.equal(observer.events.filter((event) => event === 'server_shutdown').length, 1);
        assert.equal(observer.leaveCode, CloseCode.SERVER_SHUTDOWN);
        assert.equal(observer.drops, 0, 'a server restart must not start SDK reconnection');
        assert.equal(observer.snapshot?.phase, 'playing', 'shutdown must not fabricate a resignation winner');
        assert.equal(observer.snapshot?.winner, null);
        assert.equal(observer.snapshot?.series.completedGames, 0, 'shutdown must not award a game or series point');
        assert.ok(Object.values(observer.snapshot!.series.winsByPlayer).every((wins) => wins === 0));
      }
    });
  } finally {
    releaseShutdown?.();
    for (const room of rooms) {
      room.reconnection.enabled = false;
      if (room.connection.isOpen) await room.leave();
    }
    await running.close();
  }
});
