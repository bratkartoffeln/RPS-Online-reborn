import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_COLS, BOARD_ROWS, BOARD_SIZE, MAX_TURNS,
  addPlayer, chooseDuel, createGame, movePiece, readyPlayer, resign, restartVote,
  setConnected, shuffleSetup, swapSetup, viewFor,
  type ActionResult, type FighterKind, type GameState, type PieceKind,
} from '../shared/game.js';

function success(result: ActionResult): void {
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
}

function rejected(game: GameState, action: () => ActionResult): void {
  const before = JSON.stringify(game);
  const result = action();
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(game), before, 'a rejected action must not mutate state');
}

function newGame(): GameState {
  let unique = 0;
  let seed = 92731;
  return createGame({
    idGenerator: () => `opaque-${++unique}`,
    random: () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    },
  });
}

function startedGame(): GameState {
  const game = newGame();
  success(addPlayer(game, 'a', 'Ada'));
  success(addPlayer(game, 'b', 'Ben'));
  success(readyPlayer(game, 'a'));
  success(readyPlayer(game, 'b'));
  return game;
}

let fixtureId = 0;
function put(game: GameState, cell: number, owner: string, kind: PieceKind, revealed = false): void {
  game.board[cell] = { id: `fixture-${++fixtureId}`, owner, kind, revealed };
}

/** A central battle with spare fighters so a single loss does not end play. */
function battle(attacker: FighterKind, defender: PieceKind): GameState {
  const game = startedGame();
  game.board.fill(null);
  put(game, 24, 'a', attacker);
  put(game, 17, 'b', defender);
  put(game, 35, 'a', 'paper');
  put(game, 6, 'b', 'paper');
  put(game, 41, 'a', 'flag');
  put(game, 0, 'b', 'flag');
  return game;
}

test('starts with a 7 x 6 board, two randomized 14-piece armies, and opaque IDs', () => {
  const game = createGame();
  assert.equal(BOARD_COLS, 7);
  assert.equal(BOARD_ROWS, 6);
  assert.equal(game.board.length, BOARD_SIZE);
  assert.equal(game.revision, 0);
  assert.equal(game.phase, 'waiting');
  success(addPlayer(game, 'a', 'Same Name'));
  success(addPlayer(game, 'b', 'Same Name'));
  assert.equal(game.phase, 'setup');
  assert.equal(game.revision, 2);
  for (const [owner, cells] of [
    ['a', Array.from({ length: 14 }, (_, offset) => offset + 28)],
    ['b', Array.from({ length: 14 }, (_, offset) => offset)],
  ] as const) {
    const pieces = cells.map((cell) => game.board[cell]!);
    assert.ok(pieces.every((piece) => piece.owner === owner && !piece.revealed));
    for (const kind of ['rock', 'paper', 'scissors', 'flag', 'trap'] as PieceKind[]) {
      assert.equal(pieces.filter((piece) => piece.kind === kind).length, kind === 'flag' || kind === 'trap' ? 1 : 4);
    }
  }
  assert.ok(game.board.slice(14, 28).every((cell) => cell === null));
  const ids = game.board.flatMap((piece) => piece ? [piece.id] : []);
  assert.equal(new Set(ids).size, 28);
  assert.ok(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)));
  rejected(game, () => addPlayer(game, 'c', 'Third'));
});

test('sanitized view exposes own kinds only and contains no shared mutable objects', () => {
  const game = startedGame();
  const originalKind = game.board[0]!.kind;
  (game.board[0]! as unknown as Record<string, unknown>).secretInternalData = 'do not send';
  const snapshot = viewFor(game, 'a');
  assert.ok(snapshot.board.filter((piece) => piece?.owner === 'a').every((piece) => piece?.kind !== null));
  assert.ok(snapshot.board.filter((piece) => piece?.owner === 'b').every((piece) => piece?.kind === null));
  assert.equal(JSON.stringify(snapshot).includes('secretInternalData'), false);
  assert.equal(JSON.stringify(snapshot).includes('do not send'), false);
  assert.ok(Object.keys(snapshot.legalMoves).length > 0);
  assert.deepEqual(viewFor(game, 'b').legalMoves, {});
  assert.ok(viewFor(game, 'outsider').board.every((piece) => !piece || piece.kind === null));
  assert.deepEqual(viewFor(game, 'outsider').legalMoves, {});
  snapshot.board[0]!.kind = 'flag';
  snapshot.players[0]!.name = 'changed';
  snapshot.log.push('injected');
  assert.notEqual(game.players[0]!.name, 'changed');
  assert.equal(game.log.includes('injected'), false);
  assert.equal(game.board[0]!.kind, originalKind);
});

test('a lone player can shuffle, swap and ready; both ready starts with seat zero', () => {
  const game = newGame();
  success(addPlayer(game, 'a', 'Ada'));
  const firstId = game.board[28]!.id;
  const secondId = game.board[41]!.id;
  success(swapSetup(game, 'a', 28, 41));
  assert.equal(game.board[28]!.id, secondId);
  assert.equal(game.board[41]!.id, firstId);
  const beforeIds = game.board.slice(28).map((piece) => piece!.id).sort();
  success(shuffleSetup(game, 'a'));
  assert.deepEqual(game.board.slice(28).map((piece) => piece!.id).sort(), beforeIds);
  rejected(game, () => swapSetup(game, 'a', 28, 0));
  rejected(game, () => swapSetup(game, 'a', 28, 28));
  success(readyPlayer(game, 'a'));
  assert.equal(game.phase, 'waiting');
  rejected(game, () => shuffleSetup(game, 'a'));
  rejected(game, () => swapSetup(game, 'a', 28, 29));
  success(addPlayer(game, 'b', 'Ben'));
  assert.equal(game.phase, 'setup');
  success(readyPlayer(game, 'b'));
  assert.equal(game.phase, 'playing');
  assert.equal(game.currentTurn, 'a');
  assert.equal(game.turnNumber, 0);
  rejected(game, () => readyPlayer(game, 'b'));
});

test('validates identity, name and malformed setup payloads without mutation', () => {
  const game = newGame();
  rejected(game, () => addPlayer(game, '', 'Ada'));
  rejected(game, () => addPlayer(game, 'a', ' '));
  rejected(game, () => addPlayer(game, 'a', 'x'.repeat(25)));
  rejected(game, () => addPlayer(game, 'a', null as unknown as string));
  success(addPlayer(game, 'a', ' Ada\n   Name '));
  assert.equal(game.players[0]!.name, 'Ada Name');
  rejected(game, () => addPlayer(game, 'a', 'Again'));
  rejected(game, () => shuffleSetup(game, 'outsider'));
  rejected(game, () => swapSetup(game, 'a', NaN, 28));
  rejected(game, () => swapSetup(game, 'a', 28, '29' as unknown as number));
  rejected(game, () => setConnected(game, 'a', 1 as unknown as boolean));
});

test('moves only one orthogonal cell and rejects all invalid/out-of-turn moves', () => {
  const game = battle('rock', 'scissors');
  put(game, 25, 'a', 'trap');
  rejected(game, () => movePiece(game, 'outsider', 24, 23));
  rejected(game, () => movePiece(game, 'b', 17, 16));
  rejected(game, () => movePiece(game, 'a', 17, 16));
  rejected(game, () => movePiece(game, 'a', 24, 24));
  rejected(game, () => movePiece(game, 'a', 24, 22));
  rejected(game, () => movePiece(game, 'a', 24, 16));
  rejected(game, () => movePiece(game, 'a', 24, 25));
  rejected(game, () => movePiece(game, 'a', 25, 26));
  rejected(game, () => movePiece(game, 'a', 41, 40));
  rejected(game, () => movePiece(game, 'a', -1, 0));
  rejected(game, () => movePiece(game, 'a', 24, 42));
  rejected(game, () => movePiece(game, 'a', 24, Infinity));
  rejected(game, () => movePiece(game, 'a', 24.5, 23));
  rejected(game, () => movePiece(game, 'a', '24' as unknown as number, 23));
  const originalId = game.board[24]!.id;
  success(movePiece(game, 'a', 24, 23));
  assert.equal(game.board[24], null);
  assert.equal(game.board[23]!.id, originalId);
  assert.equal(game.board[23]!.revealed, false);
  assert.equal(viewFor(game, 'b').board[23]!.kind, null);
  assert.equal(game.currentTurn, 'b');
  assert.equal(game.turnNumber, 1);
  rejected(game, () => movePiece(game, 'a', 23, 22));
});

test('does not wrap a horizontal move around an edge', () => {
  const game = battle('rock', 'scissors');
  put(game, 27, 'a', 'rock');
  rejected(game, () => movePiece(game, 'a', 27, 28));
  assert.equal(viewFor(game, 'a').legalMoves[27]?.includes(28), false);
});

test('all six unequal RPS matchups resolve correctly and reveal the surviving fighter', () => {
  const wins: [FighterKind, FighterKind][] = [['rock', 'scissors'], ['scissors', 'paper'], ['paper', 'rock']];
  for (const [winner, loser] of wins) {
    const attackingWinner = battle(winner, loser);
    success(movePiece(attackingWinner, 'a', 24, 17));
    assert.equal(attackingWinner.board[24], null);
    assert.equal(attackingWinner.board[17]!.owner, 'a');
    assert.equal(attackingWinner.board[17]!.kind, winner);
    assert.equal(viewFor(attackingWinner, 'b').board[17]!.kind, winner);
    assert.equal(attackingWinner.turnNumber, 1);
    assert.equal(attackingWinner.currentTurn, 'b');

    const defendingWinner = battle(loser, winner);
    success(movePiece(defendingWinner, 'a', 24, 17));
    assert.equal(defendingWinner.board[24], null);
    assert.equal(defendingWinner.board[17]!.owner, 'b');
    assert.equal(viewFor(defendingWinner, 'a').board[17]!.kind, winner);
    assert.equal(defendingWinner.currentTurn, 'b');
  }
});

test('equal fighters enter a duel; opponent locked choices are never sent early', () => {
  const game = battle('rock', 'rock');
  success(movePiece(game, 'a', 24, 17));
  assert.equal(game.phase, 'duel');
  assert.equal(game.turnNumber, 0);
  assert.equal(game.duel!.round, 1);
  assert.equal(viewFor(game, 'a').duel!.yourChoice, null);
  assert.deepEqual(viewFor(game, 'a').legalMoves, {});
  rejected(game, () => movePiece(game, 'a', 35, 28));
  success(chooseDuel(game, 'a', 'paper'));
  const opponent = viewFor(game, 'b');
  assert.equal(opponent.duel!.yourChoice, null);
  assert.equal(opponent.duel!.choiceLocked.a, true);
  assert.equal(opponent.duel!.choiceLocked.b, false);
  assert.equal(Object.hasOwn(opponent.duel!, 'choices'), false);
  assert.equal(opponent.board[24]!.kind, 'rock', 'a pending choice cannot alter the public piece type');
  assert.equal(viewFor(game, 'a').duel!.yourChoice, 'paper');
  assert.equal(JSON.stringify(opponent.duel).includes('paper'), false);
  rejected(game, () => chooseDuel(game, 'a', 'scissors'));
  rejected(game, () => chooseDuel(game, 'b', 'flag' as FighterKind));
  rejected(game, () => chooseDuel(game, 'outsider', 'rock'));
  success(chooseDuel(game, 'b', 'rock'));
  assert.equal(game.phase, 'playing');
  assert.equal(game.duel, null);
  assert.equal(game.board[24], null);
  assert.equal(game.board[17]!.owner, 'a');
  assert.equal(game.board[17]!.kind, 'paper');
  assert.equal(game.board[17]!.revealed, true);
  assert.equal(game.turnNumber, 1);
  assert.equal(game.currentTurn, 'b');
});

test('duel ties repeat with a new round and immutable choices reset; defender can win', () => {
  const game = battle('scissors', 'scissors');
  success(movePiece(game, 'a', 24, 17));
  const duelId = game.duel!.id;
  success(chooseDuel(game, 'b', 'paper'));
  success(chooseDuel(game, 'a', 'paper'));
  assert.equal(game.phase, 'duel');
  assert.equal(game.duel!.id, duelId);
  assert.equal(game.duel!.round, 2);
  assert.deepEqual(Object.keys(game.duel!.choices), []);
  assert.equal(game.turnNumber, 0);
  assert.equal(game.board[24]!.kind, 'paper');
  assert.equal(game.board[17]!.kind, 'paper');
  assert.equal(viewFor(game, 'a').duel!.choiceLocked.a, false);
  success(chooseDuel(game, 'a', 'rock'));
  success(chooseDuel(game, 'b', 'paper'));
  assert.equal(game.phase, 'playing');
  assert.equal(game.board[24], null);
  assert.equal(game.board[17]!.owner, 'b');
  assert.equal(game.board[17]!.kind, 'paper');
  assert.equal(game.currentTurn, 'b');
  assert.equal(game.turnNumber, 1);
});

test('flag capture wins immediately, including on the turn-limit boundary', () => {
  const game = battle('scissors', 'flag');
  game.turnNumber = MAX_TURNS - 1;
  success(movePiece(game, 'a', 24, 17));
  assert.equal(game.phase, 'finished');
  assert.equal(game.winner, 'a');
  assert.equal(game.finishReason, 'flag');
  assert.equal(game.currentTurn, null);
  assert.equal(game.turnNumber, MAX_TURNS);
  rejected(game, () => movePiece(game, 'b', 6, 5));
  rejected(game, () => chooseDuel(game, 'b', 'rock'));
});

test('trap kills the attacker and remains publicly revealed on its cell', () => {
  const game = battle('paper', 'trap');
  const trapId = game.board[17]!.id;
  success(movePiece(game, 'a', 24, 17));
  assert.equal(game.board[24], null);
  assert.equal(game.board[17]!.id, trapId);
  assert.equal(game.board[17]!.kind, 'trap');
  assert.equal(game.board[17]!.revealed, true);
  assert.equal(viewFor(game, 'a').board[17]!.kind, 'trap');
  assert.equal(game.phase, 'playing');
  assert.equal(game.currentTurn, 'b');
  rejected(game, () => movePiece(game, 'b', 17, 16));
});

test('taking the last enemy fighter or losing the last attacker ends the game', () => {
  const game = battle('rock', 'scissors');
  game.board[6] = null;
  success(movePiece(game, 'a', 24, 17));
  assert.equal(game.phase, 'finished');
  assert.equal(game.winner, 'a');
  assert.equal(game.finishReason, 'no_moves');

  const trapped = battle('rock', 'trap');
  trapped.board[35] = null;
  success(movePiece(trapped, 'a', 24, 17));
  assert.equal(trapped.phase, 'finished');
  assert.equal(trapped.winner, 'b');
  assert.equal(trapped.finishReason, 'no_moves');
});

test('no-legal-move detection handles fully blocked fighters, not just piece counts', () => {
  const game = startedGame();
  game.board.fill(null);
  put(game, 0, 'b', 'rock');
  put(game, 1, 'b', 'flag');
  put(game, 7, 'b', 'trap');
  put(game, 24, 'a', 'paper');
  put(game, 41, 'a', 'flag');
  success(movePiece(game, 'a', 24, 23));
  assert.equal(game.phase, 'finished');
  assert.equal(game.winner, 'a');
  assert.equal(game.finishReason, 'no_moves');
});

test('draws after 300 completed turns and keeps unrevealed enemy kinds hidden', () => {
  const game = battle('paper', 'rock');
  game.turnNumber = MAX_TURNS - 1;
  success(movePiece(game, 'a', 24, 23));
  assert.equal(game.phase, 'finished');
  assert.equal(game.winner, null);
  assert.equal(game.finishReason, 'turn_limit');
  assert.equal(viewFor(game, 'a').board[0]!.kind, null);
  assert.deepEqual(viewFor(game, 'a').legalMoves, {});
});

test('connection loss pauses moves and duel choices without losing private choices', () => {
  const game = battle('rock', 'rock');
  success(setConnected(game, 'b', false));
  assert.equal(viewFor(game, 'a').paused, true);
  assert.deepEqual(viewFor(game, 'a').legalMoves, {});
  rejected(game, () => movePiece(game, 'a', 24, 17));
  const revision = game.revision;
  success(setConnected(game, 'b', false));
  assert.equal(game.revision, revision);
  success(setConnected(game, 'b', true));
  success(movePiece(game, 'a', 24, 17));
  success(chooseDuel(game, 'a', 'paper'));
  success(setConnected(game, 'b', false));
  rejected(game, () => chooseDuel(game, 'b', 'rock'));
  success(setConnected(game, 'b', true));
  assert.equal(viewFor(game, 'a').duel!.yourChoice, 'paper');
  assert.equal(viewFor(game, 'b').duel!.yourChoice, null);
  success(chooseDuel(game, 'b', 'rock'));
  assert.equal(game.phase, 'playing');
});

test('resignation ends a duel and a two-player rematch resets all match secrets', () => {
  const game = battle('rock', 'rock');
  success(movePiece(game, 'a', 24, 17));
  success(chooseDuel(game, 'a', 'scissors'));
  rejected(game, () => restartVote(game, 'a'));
  success(resign(game, 'b'));
  assert.equal(game.winner, 'a');
  assert.equal(game.finishReason, 'resign');
  assert.equal(game.duel, null);
  const oldIds = new Set(game.board.flatMap((piece) => piece ? [piece.id] : []));
  const revision = game.revision;
  success(restartVote(game, 'a'));
  assert.equal(game.phase, 'finished');
  assert.equal(game.players[0]!.restartRequested, true);
  success(restartVote(game, 'a'));
  assert.equal(game.revision, revision + 1);
  success(restartVote(game, 'b'));
  assert.equal(game.revision, revision + 2);
  assert.equal(game.phase, 'setup');
  assert.equal(game.turnNumber, 0);
  assert.equal(game.winner, null);
  assert.equal(game.finishReason, null);
  assert.equal(game.duel, null);
  assert.equal(game.currentTurn, null);
  assert.ok(game.players.every((player) => !player.ready && !player.restartRequested));
  assert.ok(game.board.every((piece) => !piece || (!piece.revealed && !oldIds.has(piece.id))));
  assert.equal(game.board.filter(Boolean).length, 28);
  assert.ok(viewFor(game, 'a').board.filter((piece) => piece?.owner === 'b').every((piece) => piece?.kind === null));
});

test('public log is capped at 20 entries', () => {
  const game = startedGame();
  for (let index = 0; index < 60; index += 1) success(setConnected(game, 'a', index % 2 === 1));
  assert.equal(game.log.length, 20);
  assert.equal(viewFor(game, 'a').log.length, 20);
});
