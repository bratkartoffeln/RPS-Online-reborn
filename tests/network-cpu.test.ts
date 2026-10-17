import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import { CpuBrain } from '../server/cpu.js';
import { CPU_OPPONENTS } from '../shared/cpu.js';
import type { Snapshot } from '../shared/protocol.js';

function observe(room: Room) {
  let snapshot: Snapshot | undefined;
  const problems: string[] = [];
  room.onMessage('snapshot', (value: Snapshot) => { snapshot = value; });
  room.onMessage('problem', (value: { message: string }) => problems.push(value.message));
  room.onMessage('chat', () => {});
  room.onMessage('server_shutdown', () => {});
  room.onError(() => {});
  room.send('sync');
  return {
    room, problems,
    async wait(predicate: (view: Snapshot) => boolean): Promise<Snapshot> {
      const deadline = Date.now() + 4000;
      while (!snapshot || !predicate(snapshot)) {
        if (Date.now() > deadline) throw new Error(`CPU timeout: ${JSON.stringify(snapshot)}; ${problems.join(', ')}`);
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      return snapshot;
    },
  };
}

test('CPU rooms play all levels, keep secrets, reconnect and continue series', { timeout: 30000 }, async () => {
  // Exercise real room scheduling without making the suite wait for human thinking times.
  const originalDelay = CpuBrain.prototype.delay;
  CpuBrain.prototype.delay = () => 100;
  const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 2 });
  const client = new Client(server.url);
  const rooms: Room[] = [];
  try {
    await assert.rejects(client.create('rps', { name: 'Test', cpuDifficulty: 'impossible' }), /Einfach/);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      let a = observe(await client.create('rps', { name: 'Mensch', cpuDifficulty: difficulty, seriesMode: 'best-of-3' }));
      rooms.push(a.room);
      let view = await a.wait(v => v.phase === 'setup' && v.players[1]!.ready);
      assert.equal(view.cpuDifficulty, difficulty);
      assert.equal(view.players[1]!.name, CPU_OPPONENTS[difficulty].name);
      assert.ok(view.board.filter(p => p && p.owner !== view.you).every(p => p!.kind === null));
      await assert.rejects(client.joinById(a.room.roomId, { name: 'Fremder' }));
      a.room.send('ready');
      view = await a.wait(v => v.phase === 'playing');
      const [openingFrom, openingTargets] = Object.entries(view.legalMoves)[0]!;
      a.room.send('move', { from: Number(openingFrom), to: openingTargets[0], revision: view.revision });
      view = await a.wait(v => v.phase === 'playing' && v.currentTurn !== v.you);
      const pausedTurn = view.turnNumber;
      const token = a.room.reconnectionToken;
      a.room.reconnection.enabled = false;
      a.room.connection.close();
      await new Promise(resolve => setTimeout(resolve, 180));
      a = observe(await client.reconnect(token));
      rooms.push(a.room);
      view = await a.wait(v => !v.paused);
      assert.equal(view.turnNumber, pausedTurn, 'the scheduled CPU move was cancelled during disconnect');
      assert.equal(view.cpuDifficulty, difficulty);
      view = await a.wait(v => v.phase === 'duel' || v.phase === 'finished' || (v.phase === 'playing' && v.currentTurn === v.you));
      for (let index = 0; index < 6 && view.phase !== 'finished'; index++) {
        if (view.phase === 'duel') {
          a.room.send('duel', { kind: 'rock', duelId: view.duel!.id, round: view.duel!.round });
        } else {
          assert.equal(view.currentTurn, view.you);
          const [from, targets] = Object.entries(view.legalMoves)[0]!;
          a.room.send('move', { from: Number(from), to: targets[0], revision: view.revision });
        }
        const revision = view.revision;
        view = await a.wait(v => v.revision > revision && (v.phase === 'finished' ||
          (v.phase === 'duel' && !v.duel!.choiceLocked[v.you]) ||
          (v.phase === 'playing' && v.currentTurn === v.you)));
      }
      assert.deepEqual(a.problems, []);
      if (view.phase !== 'finished') { a.room.send('resign'); view = await a.wait(v => v.phase === 'finished'); }
      const matchId = view.series.matchId;
      a.room.send('restart', { seriesId: view.series.id, matchId });
      view = await a.wait(v => v.phase === 'setup' && v.series.matchId !== matchId && v.players[1]!.ready);
      assert.equal(view.series.startingSeat, 1);
      a.room.send('ready');
      view = await a.wait(v => v.phase === 'playing' && v.turnNumber === 1);
      assert.equal(view.currentTurn, view.you, 'CPU also opens alternating games');
      a.room.send('resign');
      view = await a.wait(v => v.phase === 'finished');
      const seriesId = view.series.id;
      a.room.send('new_series', { seriesId, matchId: view.series.matchId });
      view = await a.wait(v => v.phase === 'setup' && v.series.id !== seriesId);
      assert.equal(view.series.completedGames, 0);
      assert.deepEqual(a.problems, []);
      await a.room.leave();
    }
  } finally {
    await Promise.all(rooms.map(async room => { if (room.connection.isOpen) await room.leave(); }));
    await server.close();
    CpuBrain.prototype.delay = originalDelay;
  }
});
