import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import type { Snapshot } from '../shared/protocol.js';
import { addPlayer, createGame, readyPlayer, swapSetup, viewFor } from '../shared/game.js';
import { rockSetupSwaps, stageRock } from './helpers/rock-setup.js';

function seededSetup(seed: number) {
  let state = seed;
  const game = createGame({ random: () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  } });
  addPlayer(game, 'a', 'Ada'); addPlayer(game, 'b', 'Ben');
  return game;
}

test('wire-test setup avoids the corner-blocking swaps reproduced by seeds 151 and 270', () => {
  for (const [seed, owner, target] of [[151, 'b', 9], [270, 'a', 30]] as const) {
    const game = seededSetup(seed);
    const from = game.board.findIndex(piece => piece?.owner === owner && piece.kind === 'rock');
    const rejected = swapSetup(structuredClone(game), owner, from, target);
    assert.equal(rejected.ok, false, `Seed ${seed} reproduces the former setup failure`);
    if (!rejected.ok) assert.match(rejected.error, /Ecke.*Flagge und Falle/);
    for (const swap of rockSetupSwaps(viewFor(game, owner), target)) {
      assert.deepEqual(swapSetup(game, owner, swap.from, swap.to), { ok: true });
    }
    assert.equal(game.board[target]?.kind, 'rock');
    assert.equal(readyPlayer(game, owner).ok, true);
  }
});

test('wire-test setup produces valid rock staging for both seats across 512 deterministic layouts', () => {
  for (let seed = 0; seed < 512; seed++) {
    const game = seededSetup(seed);
    for (const [owner, target] of [['a', 30], ['b', 9]] as const) {
      for (const swap of rockSetupSwaps(viewFor(game, owner), target)) {
        assert.equal(swapSetup(game, owner, swap.from, swap.to).ok, true, `Seed ${seed}, ${owner}: valid swap`);
      }
      assert.equal(game.board[target]?.kind, 'rock');
      assert.equal(readyPlayer(game, owner).ok, true, `Seed ${seed}, ${owner}: valid setup`);
    }
  }
});

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
    problems: [] as string[],
    check() {
      if (observer.problems.length) throw new Error(`Serverfehler im Netzwerk-Test: ${observer.problems.join('; ')}`);
    },
    async wait(predicate: (snapshot: Snapshot) => boolean) {
      await until(() => {
        observer.check();
        return !!observer.snapshot && predicate(observer.snapshot);
      });
      return observer.snapshot!;
    },
  };
  room.onMessage('snapshot', (snapshot: Snapshot) => { observer.snapshot = snapshot; observer.received += 1; });
  room.onMessage('chat', () => {});
  room.onMessage('problem', (problem: { message: string }) => observer.problems.push(problem.message));
  room.onError((code, message) => observer.problems.push(`${code}: ${message}`));
  room.send('sync');
  return observer;
}

test('wire-test waits report a rejected command with its server error instead of timing out', { timeout: 10000 }, async () => {
  const running = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 1 });
  let room: Room | undefined;
  try {
    room = await new Client(running.url).create('rps', { name: 'Ada' });
    const observer = observe(room);
    await observer.wait(view => view.phase === 'waiting');
    room.send('swap', { from: -1, to: 30 });
    await assert.rejects(observer.wait(() => false), /Serverfehler im Netzwerk-Test: Ungültige Felder/);
  } finally {
    if (room) {
      room.reconnection.enabled = false;
      if (room.connection.isOpen) await room.leave();
    }
    await running.close();
  }
});

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
      await stageRock(observer, target);
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
    await until(() => { b.check(); return b.received > previousPackets; });
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
