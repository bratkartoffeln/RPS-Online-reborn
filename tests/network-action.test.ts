import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import type { Snapshot } from '../shared/protocol.js';

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Der erwartete Ereignis-Spielstand wurde nicht empfangen.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function observe(room: Room) {
  const observer = {
    room,
    snapshot: undefined as Snapshot | undefined,
    received: 0,
    async wait(predicate: (snapshot: Snapshot) => boolean) {
      await until(() => !!observer.snapshot && predicate(observer.snapshot));
      return observer.snapshot!;
    },
  };
  room.onMessage('snapshot', (snapshot: Snapshot) => { observer.snapshot = snapshot; observer.received += 1; });
  room.onMessage('problem', () => {});
  room.onError(() => {});
  room.send('sync');
  return observer;
}

test('wire events keep movers and unsubmitted duel choices private and retain their ID on sync/reconnect', { timeout: 20000 }, async () => {
  const running = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 8 });
  const client = new Client(running.url);
  const rooms: Room[] = [];
  try {
    let a = observe(await client.create('rps', { name: 'Ada' }));
    rooms.push(a.room);
    const b = observe(await client.joinById(a.room.roomId, { name: 'Ben' }));
    rooms.push(b.room);
    await Promise.all([a.wait((view) => view.players.length === 2), b.wait((view) => view.players.length === 2)]);
    for (const [observer, target] of [[a, 30], [b, 9]] as const) {
      const view = observer.snapshot!;
      if (view.board[target]!.kind !== 'rock') {
        const source = view.board.findIndex((piece) => piece?.owner === view.you && piece.kind === 'rock');
        observer.room.send('swap', { from: source, to: target });
        await observer.wait((snapshot) => snapshot.board[target]!.kind === 'rock');
      }
    }
    a.room.send('ready');
    b.room.send('ready');
    await Promise.all([a.wait((view) => view.phase === 'playing'), b.wait((view) => view.phase === 'playing')]);
    a.room.send('move', { from: 30, to: 23, revision: a.snapshot!.revision });
    await Promise.all([a.wait((view) => view.turnNumber === 1), b.wait((view) => view.turnNumber === 1)]);
    const ownMove = structuredClone(a.snapshot!.lastAction!);
    const opposingMove = structuredClone(b.snapshot!.lastAction!);
    assert.equal(ownMove.attacker.kind, 'rock');
    assert.equal(opposingMove.attacker.kind, null);
    assert.equal(opposingMove.attacker.revealed, false);
    assert.equal(opposingMove.attacker.id, ownMove.attacker.id);
    assert.equal(opposingMove.id, ownMove.id);
    assert.equal(opposingMove.defender, null);
    assert.deepEqual(Object.keys(opposingMove).sort(), [
      'attacker', 'defender', 'duelRound', 'from', 'id', 'kind', 'outcome', 'removedIds', 'to', 'turnNumber', 'winnerId',
    ]);

    const previousPackets = b.received;
    b.room.send('sync');
    await until(() => b.received > previousPackets);
    assert.deepEqual(b.snapshot!.lastAction, opposingMove);
    const token = a.room.reconnectionToken;
    const identity = a.room.sessionId;
    a.room.reconnection.enabled = false;
    a.room.connection.close(4010, 'event reconnect check');
    await b.wait((view) => view.paused);
    assert.deepEqual(b.snapshot!.lastAction, opposingMove);
    a = observe(await client.reconnect(token));
    rooms.push(a.room);
    await Promise.all([a.wait((view) => !view.paused), b.wait((view) => !view.paused)]);
    assert.equal(a.room.sessionId, identity);
    assert.deepEqual(a.snapshot!.lastAction, ownMove);
    assert.deepEqual(b.snapshot!.lastAction, opposingMove);

    b.room.send('move', { from: 9, to: 16, revision: b.snapshot!.revision });
    await Promise.all([a.wait((view) => view.turnNumber === 2), b.wait((view) => view.turnNumber === 2)]);
    a.room.send('move', { from: 23, to: 16, revision: a.snapshot!.revision });
    await Promise.all([a.wait((view) => view.phase === 'duel'), b.wait((view) => view.phase === 'duel')]);
    const opening = structuredClone(b.snapshot!.lastAction!);
    const duel = a.snapshot!.duel!;
    a.room.send('duel', { kind: 'paper', duelId: duel.id, round: duel.round });
    await b.wait((view) => view.duel?.choiceLocked[identity] === true);
    assert.deepEqual(b.snapshot!.lastAction, opening, 'the new event channel must not leak the first secret choice');
    assert.equal(b.snapshot!.lastAction!.attacker.kind, 'rock');
    assert.equal(b.snapshot!.duel!.yourChoice, null);
    b.room.send('duel', { kind: 'scissors', duelId: duel.id, round: duel.round });
    await Promise.all([a.wait((view) => view.phase === 'playing'), b.wait((view) => view.phase === 'playing')]);
    const resolved = b.snapshot!.lastAction!;
    assert.equal(resolved.kind, 'duel');
    assert.equal(resolved.outcome, 'defender');
    assert.equal(resolved.attacker.kind, 'paper');
    assert.equal(resolved.defender!.kind, 'scissors');
    assert.deepEqual(a.snapshot!.lastAction, resolved);
  } finally {
    for (const room of rooms) {
      room.reconnection.enabled = false;
      if (room.connection.isOpen) await room.leave();
    }
    await running.close();
  }
});
