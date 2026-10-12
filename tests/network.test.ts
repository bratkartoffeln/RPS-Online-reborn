import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import type { Snapshot } from '../shared/protocol.js';

async function until(predicate: () => boolean, description: string) {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timeout: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function observe(room: Room) {
  const observer = {
    room,
    snapshot: undefined as Snapshot | undefined,
    problems: [] as string[],
    async wait(predicate: (view: Snapshot) => boolean) {
      await until(() => !!observer.snapshot && predicate(observer.snapshot), 'Spielstand erhalten');
      return observer.snapshot!;
    },
  };
  room.onMessage('snapshot', (value: Snapshot) => { observer.snapshot = value; });
  room.onMessage('chat', () => {}); // The separate chat suite inspects room history.
  room.onMessage('problem', (value: { message: string }) => observer.problems.push(value.message));
  room.onError(() => {});
  room.send('sync');
  return observer;
}

test('real two-client sessions keep secrets, validate commands and recover seats', { timeout: 30000 }, async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 4 });
  const client = new Client(server.url);
  const rooms: Room[] = [];
  try {
    const health = await fetch(`${server.url}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    let a = observe(await client.create('rps', { name: 'Alice' }));
    rooms.push(a.room);
    await a.wait((view) => view.phase === 'waiting');
    const b = observe(await client.joinById(a.room.roomId, { name: 'Bob' }));
    rooms.push(b.room);
    await Promise.all([a.wait((view) => view.players.length === 2), b.wait((view) => view.players.length === 2)]);

    await context.test('each player receives only their own hidden army; third player rejected', async () => {
      for (const observer of [a, b]) {
        const view = observer.snapshot!;
        const own = view.board.filter((piece) => piece?.owner === view.you);
        const enemy = view.board.filter((piece) => piece && piece.owner !== view.you);
        assert.equal(own.length, 14);
        assert.equal(enemy.length, 14);
        assert.ok(own.every((piece) => piece!.kind !== null));
        assert.ok(enemy.every((piece) => piece!.kind === null));
        assert.equal(view.duel, null);
      }
      await assert.rejects(client.joinById(a.room.roomId, { name: 'Third player' }));
      const separate = observe(await client.create('rps', { name: 'Other room' }));
      rooms.push(separate.room);
      const view = await separate.wait((value) => value.phase === 'waiting');
      assert.notEqual(view.roomId, a.room.roomId);
      assert.equal(view.players.length, 1);
      assert.equal(view.board.filter(Boolean).length, 14);
      await separate.room.leave();
    });

    await context.test('setup swaps and ready lead to a synchronized match', async () => {
      for (const [observer, target] of [[a, 30], [b, 9]] as const) {
        const view = observer.snapshot!;
        if (view.board[target]?.kind !== 'rock') {
          const source = view.board.findIndex((piece) => piece?.owner === view.you && piece.kind === 'rock');
          observer.room.send('swap', { from: source, to: target });
          await observer.wait((updated) => updated.board[target]?.kind === 'rock');
        }
      }
      a.room.send('ready');
      b.room.send('ready');
      await Promise.all([a.wait((view) => view.phase === 'playing'), b.wait((view) => view.phase === 'playing')]);
      assert.equal(a.snapshot!.currentTurn, a.room.sessionId);
    });

    await context.test('illegal, out-of-turn and repeated stale moves do not alter the game', async () => {
      const initialRevision = b.snapshot!.revision;
      const errors = b.problems.length;
      b.room.send('move', { from: 9, to: 16, revision: initialRevision });
      await until(() => b.problems.length > errors, 'Zug außerhalb der Reihe abgelehnt');
      assert.equal(b.snapshot!.revision, initialRevision);
      const aErrors = a.problems.length;
      a.room.send('move', { from: 30, to: -1, revision: a.snapshot!.revision });
      await until(() => a.problems.length > aErrors, 'Ungültiges Feld abgelehnt');
      const command = { from: 30, to: 23, revision: a.snapshot!.revision };
      a.room.send('move', command);
      a.room.send('move', command);
      await Promise.all([a.wait((view) => view.turnNumber === 1), b.wait((view) => view.turnNumber === 1)]);
      await until(() => a.problems.length > aErrors + 1, 'Veralteter Zug abgelehnt');
      assert.equal(a.snapshot!.board[23]?.owner, a.room.sessionId);
      assert.equal(a.snapshot!.board[30], null);
      assert.equal(b.snapshot!.board[23]?.kind, null);
    });

    await context.test('secret duel choices work concurrently and reject old duel rounds', async () => {
      b.room.send('move', { from: 9, to: 16, revision: b.snapshot!.revision });
      await Promise.all([a.wait((view) => view.turnNumber === 2), b.wait((view) => view.turnNumber === 2)]);
      a.room.send('move', { from: 23, to: 16, revision: a.snapshot!.revision });
      await Promise.all([a.wait((view) => view.phase === 'duel'), b.wait((view) => view.phase === 'duel')]);
      const first = a.snapshot!.duel!;
      a.room.send('duel', { kind: 'rock', duelId: first.id, round: first.round });
      const hidden = await b.wait((view) => !!view.duel?.choiceLocked[a.room.sessionId]);
      assert.equal(hidden.duel!.yourChoice, null);
      assert.equal('choices' in hidden.duel!, false);
      assert.deepEqual(Object.keys(hidden.duel!).sort(), ['attacker', 'choiceLocked', 'defender', 'from', 'id', 'round', 'to', 'yourChoice'].sort());
      b.room.send('duel', { kind: 'rock', duelId: first.id, round: first.round });
      await Promise.all([a.wait((view) => view.duel?.round === 2), b.wait((view) => view.duel?.round === 2)]);
      const count = a.problems.length;
      a.room.send('duel', { kind: 'scissors', duelId: first.id, round: 1 });
      await until(() => a.problems.length > count, 'Alte Duellrunde abgelehnt');
      assert.equal(a.snapshot!.duel!.yourChoice, null);
      // Issue both sends before either client receives an updated revision.
      a.room.send('duel', { kind: 'paper', duelId: first.id, round: 2 });
      b.room.send('duel', { kind: 'scissors', duelId: first.id, round: 2 });
      await Promise.all([a.wait((view) => view.phase === 'playing'), b.wait((view) => view.phase === 'playing')]);
      assert.equal(a.snapshot!.board[23], null);
      assert.equal(a.snapshot!.board[16]?.owner, b.room.sessionId);
      assert.equal(a.snapshot!.board[16]?.kind, 'scissors');
      assert.equal(a.snapshot!.board[16]?.revealed, true);
    });

    await context.test('a page-reload reconnect preserves identity and private game state', async () => {
      const oldSession = a.room.sessionId;
      const token = a.room.reconnectionToken;
      const turns = b.snapshot!.turnNumber;
      a.room.reconnection.enabled = false;
      a.room.connection.close(4010, 'test reload');
      await b.wait((view) => view.paused);
      const errorCount = b.problems.length;
      const ownFighter = b.snapshot!.board.findIndex((piece) => piece?.owner === b.room.sessionId && piece.kind === 'rock');
      b.room.send('move', { from: ownFighter, to: ownFighter + 7, revision: b.snapshot!.revision });
      await until(() => b.problems.length > errorCount, 'Pausierter Zug abgelehnt');
      a = observe(await client.reconnect(token));
      rooms.push(a.room);
      await Promise.all([a.wait((view) => !view.paused), b.wait((view) => !view.paused)]);
      assert.equal(a.room.sessionId, oldSession);
      assert.notEqual(a.room.reconnectionToken, token);
      assert.equal(a.snapshot!.turnNumber, turns);
      assert.ok(a.snapshot!.board.filter((piece) => piece && piece.owner !== oldSession && !piece.revealed).every((piece) => piece!.kind === null));
    });

    await context.test('rematch requires both votes and a departed player cannot be replaced', async () => {
      a.room.send('resign');
      await Promise.all([a.wait((view) => view.phase === 'finished'), b.wait((view) => view.phase === 'finished')]);
      assert.equal(a.snapshot!.winner, b.room.sessionId);
      const identity = { seriesId: a.snapshot!.series.id, matchId: a.snapshot!.series.matchId };
      a.room.send('restart', identity);
      await a.wait((view) => view.players.find((player) => player.id === a.room.sessionId)!.restartRequested);
      assert.equal(a.snapshot!.phase, 'finished');
      b.room.send('restart', identity);
      await Promise.all([a.wait((view) => view.phase === 'setup'), b.wait((view) => view.phase === 'setup')]);
      assert.equal(a.snapshot!.turnNumber, 0);
      assert.ok(a.snapshot!.players.every((player) => !player.ready));
      await b.room.leave();
      await a.wait((view) => view.phase === 'finished');
      await assert.rejects(client.joinById(a.room.roomId, { name: 'Replacement' }));
    });
  } finally {
    for (const room of rooms) {
      room.reconnection.enabled = false;
      try { if (room.connection.isOpen) await room.leave(); } catch { /* already disconnected */ }
    }
    await server.close();
  }
});
