import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import type { ContinuationMessage, Snapshot } from '../shared/protocol.js';

async function until(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timeout: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function observe(room: Room) {
  const observer = {
    room,
    snapshot: undefined as Snapshot | undefined,
    updates: 0,
    problems: [] as string[],
    async wait(predicate: (view: Snapshot) => boolean): Promise<Snapshot> {
      await until(() => !!observer.snapshot && predicate(observer.snapshot), 'Serienstand erhalten');
      return observer.snapshot!;
    },
  };
  room.onMessage('snapshot', (snapshot: Snapshot) => { observer.snapshot = snapshot; observer.updates++; });
  room.onMessage('chat', () => {}); // The separate chat suite inspects room history.
  room.onMessage('problem', (value: { message: string }) => observer.problems.push(value.message));
  room.onMessage('server_shutdown', () => {});
  room.onError(() => {});
  room.send('sync');
  return observer;
}

type Observer = ReturnType<typeof observe>;
const identity = (observer: Observer): ContinuationMessage => ({
  seriesId: observer.snapshot!.series.id,
  matchId: observer.snapshot!.series.matchId,
});

async function rejected(observer: Observer, message: string, payload?: unknown): Promise<void> {
  const problems = observer.problems.length;
  const updates = observer.updates;
  const before = structuredClone(observer.snapshot);
  observer.room.send(message, payload);
  await until(() => observer.problems.length > problems && observer.updates > updates, `${message} abgelehnt`);
  assert.deepEqual(observer.snapshot, before, 'invalid commands cannot change scores, votes, generation or hidden state');
}

async function ready(a: Observer, b: Observer): Promise<void> {
  a.room.send('ready');
  b.room.send('ready');
  await Promise.all([a.wait((view) => view.phase === 'playing'), b.wait((view) => view.phase === 'playing')]);
  assert.equal(a.snapshot!.currentTurn, a.snapshot!.series.startingPlayer);
  assert.deepEqual(a.snapshot!.series, b.snapshot!.series);
}

async function resign(a: Observer, b: Observer, loser: Observer): Promise<void> {
  const completed = a.snapshot!.series.completedGames;
  loser.room.send('resign');
  await Promise.all([a, b].map((observer) => observer.wait((view) =>
    view.phase === 'finished' && view.series.completedGames === completed + 1)));
}

test('real room series coordinate scores, continuation generations and reconnected seats', { timeout: 30000 }, async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 2 });
  const client = new Client(server.url);
  const rooms: Room[] = [];
  try {
    await context.test('creation validates the room mode and older create callers default to free', async () => {
      await assert.rejects(client.create('rps', { name: 'Invalid', seriesMode: 'best-of-7' }), /Freies Spiel/);
      await assert.rejects(client.create('rps', { name: 'Invalid', seriesMode: null }), /Freies Spiel/);
      for (const mode of [undefined, 'best-of-5'] as const) {
        const room = observe(await client.create('rps', { name: 'Lobby', ...(mode ? { seriesMode: mode } : {}) }));
        rooms.push(room.room);
        const view = await room.wait((value) => value.phase === 'waiting');
        assert.equal(view.series.mode, mode ?? 'free');
        assert.equal(view.series.targetWins, mode ? 3 : null);
        assert.deepEqual(view.series.winsByPlayer, { [room.room.sessionId]: 0 });
        await room.room.leave();
      }
    });

    let a = observe(await client.create('rps', { name: 'Same Name', seriesMode: 'best-of-3' }));
    rooms.push(a.room);
    const b = observe(await client.joinById(a.room.roomId, { name: 'Same Name', seriesMode: 'free' }));
    rooms.push(b.room);
    await Promise.all([a, b].map((observer) => observer.wait((view) => view.players.length === 2)));
    const aId = a.room.sessionId;
    const bId = b.room.sessionId;
    const firstIdentity = identity(a);

    await context.test('room mode and score keys belong to the server and not the joining nickname', async () => {
      assert.notEqual(aId, bId);
      assert.ok(a.snapshot!.players.every((player) => player.name === 'Same Name'));
      assert.equal(a.snapshot!.series.mode, 'best-of-3');
      assert.equal(a.snapshot!.series.targetWins, 2);
      assert.deepEqual(a.snapshot!.series.winsByPlayer, { [aId]: 0, [bId]: 0 });
      await rejected(a, 'restart', firstIdentity);
      await ready(a, b);
      assert.equal(a.snapshot!.currentTurn, aId);
      await resign(a, b, b);
      assert.equal(a.snapshot!.series.winsByPlayer[aId], 1);
      assert.equal(a.snapshot!.series.completedGames, 1);
      assert.equal(a.snapshot!.series.winner, null);
      await rejected(b, 'resign');
      await rejected(a, 'restart');
    });

    await context.test('both next-game votes from the same snapshot succeed and alternate the starter', async () => {
      const oldPieces = new Set(a.snapshot!.board.flatMap((piece) => piece ? [piece.id] : []));
      const errors = [a.problems.length, b.problems.length];
      // Submit both votes before either client receives the first vote's revision.
      a.room.send('restart', firstIdentity);
      b.room.send('restart', firstIdentity);
      await Promise.all([a, b].map((observer) => observer.wait((view) =>
        view.phase === 'setup' && view.series.gameNumber === 2)));
      assert.deepEqual([a.problems.length, b.problems.length], errors);
      for (const observer of [a, b]) {
        const view = observer.snapshot!;
        assert.equal(view.series.id, firstIdentity.seriesId);
        assert.notEqual(view.series.matchId, firstIdentity.matchId);
        assert.equal(view.series.startingPlayer, bId);
        assert.equal(view.series.startingSeat, 1);
        assert.equal(view.series.completedGames, 1);
        assert.deepEqual(view.series.winsByPlayer, { [aId]: 1, [bId]: 0 });
        assert.ok(view.players.every((player) => !player.ready && !player.restartRequested && !player.newSeriesRequested));
        assert.ok(view.board.every((piece) => !piece || (!oldPieces.has(piece.id) && !piece.revealed)));
        assert.ok(view.board.filter((piece) => piece?.owner !== view.you && piece).every((piece) => piece!.kind === null));
      }
      await ready(a, b);
      assert.equal(a.snapshot!.currentTurn, bId);
      await resign(a, b, b);
      assert.equal(a.snapshot!.series.winsByPlayer[aId], 2);
      assert.equal(a.snapshot!.series.winner, aId);
      assert.equal(a.snapshot!.series.completedGames, 2);
    });

    await context.test('a decided best-of cannot continue; resetting needs two fresh series votes', async () => {
      const decided = identity(a);
      await rejected(a, 'restart', decided);
      await rejected(a, 'new_series', firstIdentity);
      await rejected(b, 'new_series', { seriesId: decided.seriesId });
      a.room.send('new_series', decided);
      await Promise.all([a, b].map((observer) => observer.wait((view) =>
        view.players.find((player) => player.id === aId)!.newSeriesRequested)));
      assert.equal(a.snapshot!.phase, 'finished');
      assert.equal(a.snapshot!.series.winsByPlayer[aId], 2, 'a unilateral vote cannot erase results');
      b.room.send('new_series', decided);
      await Promise.all([a, b].map((observer) => observer.wait((view) =>
        view.phase === 'setup' && view.series.number === 2)));
      assert.notEqual(a.snapshot!.series.id, decided.seriesId);
      assert.notEqual(a.snapshot!.series.matchId, decided.matchId);
      assert.equal(a.snapshot!.series.mode, 'best-of-3');
      assert.equal(a.snapshot!.series.gameNumber, 1);
      assert.equal(a.snapshot!.series.completedGames, 0);
      assert.equal(a.snapshot!.series.draws, 0);
      assert.equal(a.snapshot!.series.winner, null);
      assert.deepEqual(a.snapshot!.series.winsByPlayer, { [aId]: 0, [bId]: 0 });
      assert.equal(a.snapshot!.series.startingPlayer, aId);
      await ready(a, b);
      await resign(a, b, b);
      await rejected(a, 'new_series', decided);
    });

    await context.test('finished-game reconnect retains scores but clears pending continuation consent', async () => {
      const ended = identity(a);
      const score = structuredClone(a.snapshot!.series);
      b.room.send('restart', ended);
      await Promise.all([a, b].map((observer) => observer.wait((view) =>
        view.players.find((player) => player.id === bId)!.restartRequested)));
      const token = a.room.reconnectionToken;
      a.room.reconnection.enabled = false;
      a.room.connection.close(4010, 'series reload test');
      await b.wait((view) => !view.players.find((player) => player.id === aId)!.connected);
      assert.ok(b.snapshot!.players.every((player) => !player.restartRequested && !player.newSeriesRequested));
      assert.deepEqual(b.snapshot!.series, score);
      await rejected(b, 'restart', ended);
      await rejected(b, 'new_series', ended);
      a = observe(await client.reconnect(token));
      rooms.push(a.room);
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.players.every((player) => player.connected))));
      assert.equal(a.room.sessionId, aId);
      assert.notEqual(a.room.reconnectionToken, token);
      assert.equal(a.snapshot!.phase, 'finished', 'old setup-ready flags cannot restart a finished board');
      assert.deepEqual(a.snapshot!.series, score);
      assert.ok(a.snapshot!.board.filter((piece) => piece?.owner === bId && !piece.revealed).every((piece) => piece!.kind === null));
      a.room.send('restart', ended);
      await Promise.all([a, b].map((observer) => observer.wait((view) =>
        view.players.find((player) => player.id === aId)!.restartRequested)));
      assert.equal(a.snapshot!.phase, 'finished', 'the earlier opponent vote is no longer consent');
      b.room.send('restart', ended);
      await Promise.all([a, b].map((observer) => observer.wait((view) =>
        view.phase === 'setup' && view.series.gameNumber === 2)));
      assert.equal(a.snapshot!.series.startingPlayer, bId);
      assert.equal(a.snapshot!.series.completedGames, 1);
      await ready(a, b);
    });

    await context.test('an expired reconnection forfeits once and never permits a new match with the missing seat', async () => {
      const previous = structuredClone(a.snapshot!.series);
      const token = b.room.reconnectionToken;
      b.room.reconnection.enabled = false;
      b.room.connection.close(4010, 'permanent disconnect test');
      await a.wait((view) => view.paused);
      assert.deepEqual(a.snapshot!.series, previous, 'a temporary drop itself is not a loss');
      await a.wait((view) => view.phase === 'finished' && view.series.completedGames === 2);
      assert.equal(a.snapshot!.winner, aId);
      assert.equal(a.snapshot!.finishReason, 'resign');
      assert.equal(a.snapshot!.series.winsByPlayer[aId], 2);
      assert.equal(a.snapshot!.series.winner, aId);
      assert.equal(a.snapshot!.series.matchId, previous.matchId);
      assert.equal(a.snapshot!.players.find((player) => player.id === bId)!.connected, false);
      assert.ok(a.snapshot!.board.every(piece => piece?.owner !== bId), 'expired reconnect removes the departed army');
      await rejected(a, 'restart', identity(a));
      await rejected(a, 'new_series', identity(a));
      await rejected(a, 'resign');
      await assert.rejects(client.reconnect(token));
      await assert.rejects(client.joinById(a.room.roomId, { name: 'Replacement' }));
      const update = a.updates;
      a.room.send('sync');
      await until(() => a.updates > update, 'Endstand erneut synchronisiert');
      assert.equal(a.snapshot!.series.completedGames, 2);
      assert.equal(a.snapshot!.series.winsByPlayer[aId], 2);
    });
  } finally {
    for (const room of rooms) {
      room.reconnection.enabled = false;
      try { if (room.connection.isOpen) await room.leave(); } catch { /* already disconnected */ }
    }
    await server.close();
  }
});
