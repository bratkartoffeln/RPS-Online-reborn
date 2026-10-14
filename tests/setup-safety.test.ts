import assert from 'node:assert/strict';
import test from 'node:test';
import { addPlayer, createGame, readyPlayer, shuffleSetup, swapSetup, type GameState, type PieceKind } from '../shared/game.js';

function trapped(game: GameState): number[] {
  return [[0, 1, 7], [6, 5, 13], [35, 36, 28], [41, 40, 34]].flatMap(([corner, a, b]) => {
    const piece = game.board[corner!];
    return piece && ['rock', 'paper', 'scissors'].includes(piece.kind) && [a!, b!].every(index => {
      const neighbour = game.board[index];
      return neighbour?.owner === piece.owner && ['flag', 'trap'].includes(neighbour.kind);
    }) ? [corner!] : [];
  });
}

function setup(random: () => number): GameState {
  let nextId = 0;
  const game = createGame({ random, idGenerator: () => `piece-${++nextId}` });
  assert.equal(addPlayer(game, 'a', 'Ada').ok, true);
  assert.equal(addPlayer(game, 'b', 'Ben').ok, true);
  return game;
}

function inventory(game: GameState): string[] {
  return game.board.flatMap(piece => piece ? [`${piece.owner}/${piece.id}/${piece.kind}/${piece.revealed}`] : []).sort();
}

test('initial and shuffled armies keep every fighter free of permanent corner traps, including constant random sources', () => {
  for (let seed = 0; seed < 250; seed++) {
    let state = seed;
    const random = seed < 3 ? () => [0, .5, .999999][seed]! : () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const game = setup(random);
    assert.deepEqual(trapped(game), [], `initial seed ${seed}`);
    const original = inventory(game);
    for (let count = 0; count < 12; count++) {
      for (const id of ['a', 'b']) assert.equal(shuffleSetup(game, id).ok, true);
      assert.deepEqual(trapped(game), [], `shuffle ${count}, seed ${seed}`);
      assert.deepEqual(inventory(game), original, 'Shuffling preserves owners, IDs, weapons and visibility');
    }
    for (const id of ['a', 'b']) {
      const counts = game.board.filter(piece => piece?.owner === id).reduce((result, piece) => {
        result[piece!.kind] = (result[piece!.kind] ?? 0) + 1; return result;
      }, {} as Record<string, number>);
      assert.deepEqual(counts, { rock: 4, paper: 4, scissors: 4, flag: 1, trap: 1 });
    }
  }
});

function cornerFixture(corner: number, fighter: PieceKind, reverse: boolean) {
  const game = setup(() => .5);
  const owner = corner < 7 ? 'b' : 'a';
  const home = game.board.flatMap((piece, index) => piece?.owner === owner ? [index] : []);
  const pool = home.map(index => game.board[index]!);
  const take = (kind: PieceKind) => pool.splice(pool.findIndex(piece => piece.kind === kind), 1)[0]!;
  const beside = corner + (corner % 7 === 0 ? 1 : -1);
  const ahead = corner + (corner < 7 ? 7 : -7);
  const safe = corner < 7 ? 3 : 31;
  game.board[corner] = take(fighter);
  game.board[beside] = take(reverse ? 'trap' : 'flag');
  game.board[safe] = take(reverse ? 'flag' : 'trap');
  for (const index of home) if (![corner, beside, safe].includes(index)) game.board[index] = pool.shift()!;
  assert.deepEqual(trapped(game), []);
  return { game, owner, ahead, safe };
}

test('manual swaps reject every corner, fighter and flag/trap order atomically in either swap direction', () => {
  for (const corner of [0, 6, 35, 41]) for (const fighter of ['rock', 'paper', 'scissors'] as const) for (const reverse of [false, true]) {
    const { game, owner, ahead, safe } = cornerFixture(corner, fighter, reverse);
    const before = JSON.stringify(game);
    for (const [from, to] of [[safe, ahead], [ahead, safe]]) {
      const result = swapSetup(game, owner, from!, to!);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /Ecke.*Flagge und Falle/);
      assert.equal(JSON.stringify(game), before, 'Rejected swaps leave board, revision and readiness unchanged');
    }
    assert.equal(swapSetup(game, owner, corner, safe).ok, true, 'A corner may contain an immobile piece');
    assert.deepEqual(trapped(game), []);
    assert.equal(readyPlayer(game, owner).ok, true);
  }
});

test('readiness guards existing invalid arrangements while ordinary movable blockers remain allowed', () => {
  const { game, owner, ahead, safe } = cornerFixture(35, 'rock', false);
  assert.equal(readyPlayer(structuredClone(game), owner).ok, true, 'One immobile neighbour and one fighter is safe');
  [game.board[ahead], game.board[safe]] = [game.board[safe]!, game.board[ahead]!];
  const before = JSON.stringify(game);
  assert.equal(readyPlayer(game, owner).ok, false);
  assert.equal(JSON.stringify(game), before);
  assert.equal(shuffleSetup(game, owner).ok, true);
  assert.deepEqual(trapped(game), []);
  assert.equal(readyPlayer(game, owner).ok, true);
});
