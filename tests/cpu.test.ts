import assert from 'node:assert/strict';
import test from 'node:test';
import { CpuBrain } from '../server/cpu.js';
import { addPlayer, chooseDuel, createGame, movePiece, readyPlayer, viewFor, type GameView } from '../shared/game.js';

function tacticalView(): GameView {
  const game = createGame();
  addPlayer(game, 'cpu', 'CPU');
  addPlayer(game, 'human', 'Mensch');
  game.board.fill(null);
  game.board[14] = { id: 'fighter', owner: 'cpu', kind: 'rock', revealed: false };
  game.board[15] = { id: 'win', owner: 'human', kind: 'scissors', revealed: true };
  game.board[21] = { id: 'lose', owner: 'human', kind: 'paper', revealed: true };
  game.phase = 'playing';
  game.currentTurn = 'cpu';
  return { ...viewFor(game, 'cpu'), legalMoves: { 14: [21, 15] } };
}

function seeded(seed = 42): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

test('three levels select legal moves, with measurable differences and mistakes even on hard', () => {
  const view = tacticalView();
  const successes: number[] = [];
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const cpu = new CpuBrain(difficulty, seeded());
    let wins = 0;
    for (let index = 0; index < 1000; index++) {
      const move = cpu.chooseMove(view)!;
      assert.equal(move.from, 14);
      assert.ok(view.legalMoves[14]!.includes(move.to));
      if (move.to === 15) wins++;
    }
    assert.ok(wins < 1000, `${difficulty} can make a mistake`);
    successes.push(wins);
  }
  assert.ok(successes[0]! < successes[1]! && successes[1]! < successes[2]!, String(successes));
});

test('CPU rejects flag and trap sources even in a corrupted move list, including random mistakes', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    for (const random of [() => 0, () => .99]) {
      const view = tacticalView();
      view.board[0] = { id: 'flag', owner: view.you, kind: 'flag', revealed: false };
      view.board[1] = { id: 'trap', owner: view.you, kind: 'trap', revealed: false };
      view.legalMoves = { 0: [7], 1: [8], 14: [15, 21], 15: [22], 20: [27] };
      const cpu = new CpuBrain(difficulty, random);
      assert.equal(cpu.chooseMove(view)!.from, 14);
      delete view.legalMoves[14];
      assert.equal(cpu.chooseMove(view), null, 'no movable own fighter remains');
    }
  }
});

test('server rejects actual flag and trap moves without changing any state', () => {
  const game = createGame();
  addPlayer(game, 'cpu', 'CPU');
  addPlayer(game, 'human', 'Mensch');
  readyPlayer(game, 'cpu');
  readyPlayer(game, 'human');
  for (const kind of ['flag', 'trap'] as const) {
    const from = game.board.findIndex(piece => piece?.owner === 'cpu' && piece.kind === kind);
    assert.equal(viewFor(game, 'cpu').legalMoves[from], undefined);
    const before = JSON.stringify(game);
    const result = movePiece(game, 'cpu', from, from >= 7 ? from - 7 : from + 7);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Fahne und Falle/);
    assert.equal(JSON.stringify(game), before);
  }
});

test('CPU remembers only observed traps and resets memory between games', () => {
  const view = tacticalView();
  view.board[15]!.kind = null;
  view.board[21] = null;
  view.lastAction = {
    id: 5, kind: 'battle', turnNumber: 1, from: 14, to: 15,
    attacker: { ...view.board[14]! }, defender: { ...view.board[15]!, kind: 'trap' },
    outcome: 'trap', winnerId: 'win', removedIds: ['old-attacker'], duelRound: null,
  };
  const hard = new CpuBrain('hard', () => .9);
  assert.equal(hard.chooseMove(view)!.to, 21);
  const easy = new CpuBrain('easy', () => .9);
  assert.equal(easy.chooseMove(view)!.to, 15);
  view.series.matchId = 'new-game';
  view.lastAction = null;
  assert.equal(hard.chooseMove(view)!.to, 15);
});

test('CPU has no access to unrevealed kinds or the current secret duel choice', () => {
  const game = createGame();
  addPlayer(game, 'cpu', 'CPU');
  addPlayer(game, 'human', 'Mensch');
  game.phase = 'playing';
  game.currentTurn = 'cpu';
  const before = viewFor(game, 'cpu');
  for (const piece of game.board) if (piece?.owner === 'human') piece.kind = 'trap';
  const after = viewFor(game, 'cpu');
  assert.deepEqual(before, after);
  assert.deepEqual(new CpuBrain('hard', seeded()).chooseMove(before), new CpuBrain('hard', seeded()).chooseMove(after));
  const cpu = new CpuBrain('hard', seeded());
  assert.deepEqual(new Set(Array.from({ length: 100 }, () => cpu.chooseDuel())), new Set(['rock', 'paper', 'scissors']));
});

test('delays vary and leave time for combat presentation', () => {
  const cpu = new CpuBrain('medium', seeded());
  const delays = Array.from({ length: 50 }, () => cpu.delay('playing'));
  assert.ok(delays.every(delay => delay >= 3200 && delay < 5900));
  assert.ok(new Set(delays).size > 40);
});

test('hard learns from resolved public duels, without counting the same event twice', () => {
  const view = tacticalView();
  const cpu = new CpuBrain('hard', () => .1);
  for (let id = 1; id <= 3; id++) {
    view.lastAction = {
      id, kind: 'duel', turnNumber: id, from: 14, to: 15,
      attacker: { ...view.board[14]!, kind: 'rock' },
      defender: { ...view.board[15]!, kind: 'rock' },
      outcome: 'tie', winnerId: null, removedIds: [], duelRound: id,
    };
    cpu.observe(view);
    cpu.observe(view);
    if (id === 1) assert.equal(cpu.chooseDuel(), 'rock', 'sync does not duplicate observations');
  }
  assert.equal(cpu.chooseDuel(), 'paper', 'counter the observed repeated rock choices');
  view.series.matchId = 'next-match';
  view.lastAction = null;
  cpu.observe(view);
  assert.equal(cpu.chooseDuel(), 'rock', 'a new match clears the learned pattern');
});

test('all CPU levels complete full games including secret duels and tied rounds', () => {
  let duels = 0;
  let ties = 0;
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (let seed = 1; seed <= 24; seed++) {
      const game = createGame({ random: seeded(seed) });
      addPlayer(game, 'a', 'CPU A');
      addPlayer(game, 'b', 'CPU B');
      readyPlayer(game, 'a');
      readyPlayer(game, 'b');
      const stationary = game.board.flatMap((piece, cell) => piece && (piece.kind === 'flag' || piece.kind === 'trap') ? [{ id: piece.id, cell, kind: piece.kind }] : []);
      const brains = { a: new CpuBrain(level, seeded(seed + 10)), b: new CpuBrain('hard', seeded(seed + 20)) };
      let actions = 0;
      while (game.phase !== 'finished' && actions++ < 3000) {
        for (const id of ['a', 'b'] as const) brains[id].observe(viewFor(game, id));
        if (game.phase === 'duel') {
          duels++;
          for (const id of ['a', 'b'] as const) assert.equal(chooseDuel(game, id, brains[id].chooseDuel()).ok, true);
          if (game.lastAction?.outcome === 'tie') ties++;
        } else {
          const id = game.currentTurn as 'a' | 'b';
          const move = brains[id].chooseMove(viewFor(game, id));
          assert.ok(move);
          assert.equal(movePiece(game, id, move.from, move.to).ok, true);
        }
        for (const piece of stationary) {
          const currentCell = game.board.findIndex(entry => entry?.id === piece.id);
          if (currentCell >= 0) {
            assert.equal(currentCell, piece.cell, `${piece.kind} must stay on its original cell`);
            assert.equal(game.board[currentCell]!.kind, piece.kind);
          } else {
            assert.equal(piece.kind, 'flag', 'only a captured flag can be removed');
            assert.equal(game.finishReason, 'flag');
          }
        }
      }
      assert.equal(game.phase, 'finished', `${level}, seed ${seed}`);
      assert.equal(game.series.completedGames, 1);
    }
  }
  assert.ok(duels > 0 && ties > 0, 'exercise secret choices and repeated tied rounds');
});
