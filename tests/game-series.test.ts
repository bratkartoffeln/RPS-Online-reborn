import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_TURNS, addPlayer, chooseDuel, createGame, movePiece, newSeriesVote,
  readyPlayer, resign, restartVote, setConnected, viewFor,
  type ActionResult, type GameState, type MatchIdentity, type PieceKind, type SeriesMode,
} from '../shared/game.js';

const success = (result: ActionResult) => assert.equal(result.ok, true, result.ok ? undefined : result.error);
const identity = (game: GameState): MatchIdentity => ({ seriesId: game.series.id, matchId: game.series.matchId });

function rejected(game: GameState, action: () => ActionResult): void {
  const before = JSON.stringify(game);
  assert.equal(action().ok, false);
  assert.equal(JSON.stringify(game), before, 'rejection must leave scores, votes, generation and private state unchanged');
}

function fixture(mode: SeriesMode = 'free'): GameState {
  let id = 0;
  const game = createGame({ seriesMode: mode, random: () => 0.5, idGenerator: () => `opaque-${++id}` });
  success(addPlayer(game, 'a', 'Same Name'));
  success(addPlayer(game, 'b', 'Same Name'));
  ready(game);
  return game;
}

function ready(game: GameState): void {
  success(readyPlayer(game, 'a'));
  success(readyPlayer(game, 'b'));
  assert.equal(game.phase, 'playing');
  assert.equal(game.currentTurn, game.players.find((player) => player.seat === game.series.startingSeat)!.id);
}

function next(game: GameState): void {
  const from = identity(game);
  success(restartVote(game, 'a', from));
  assert.equal(game.phase, 'finished');
  success(restartVote(game, 'b', from));
  assert.equal(game.phase, 'setup');
  assert.equal(game.series.id, from.seriesId);
  assert.notEqual(game.series.matchId, from.matchId);
  ready(game);
}

let pieceId = 0;
function put(game: GameState, cell: number, owner: string, kind: PieceKind): void {
  game.board[cell] = { id: `fixture-${++pieceId}`, owner, kind, revealed: false };
}

function draw(game: GameState): void {
  const mover = game.currentTurn!;
  const other = mover === 'a' ? 'b' : 'a';
  game.board.fill(null);
  put(game, 24, mover, 'rock');
  put(game, 6, other, 'paper');
  put(game, 41, mover, 'flag');
  put(game, 0, other, 'flag');
  game.turnNumber = MAX_TURNS - 1;
  success(movePiece(game, mover, 24, 23));
  assert.equal(game.phase, 'finished');
  assert.equal(game.winner, null);
  assert.equal(game.finishReason, 'turn_limit');
}

test('room modes default to free, validate values and initialize identity-based scores', () => {
  const game = createGame();
  assert.equal(game.series.mode, 'free');
  assert.equal(game.series.number, 1);
  assert.equal(game.series.gameNumber, 1);
  assert.equal(game.series.completedGames, 0);
  assert.equal(game.series.draws, 0);
  assert.equal(game.series.targetWins, null);
  assert.equal(game.series.winner, null);
  assert.notEqual(game.series.id, game.series.matchId);
  assert.equal(viewFor(game, 'a').series.startingPlayer, null);
  success(addPlayer(game, 'a', 'Same Name'));
  success(addPlayer(game, 'b', 'Same Name'));
  assert.deepEqual(viewFor(game, 'a').series.winsByPlayer, { a: 0, b: 0 });
  assert.equal(viewFor(game, 'a').series.startingPlayer, 'a');
  assert.equal(fixture('best-of-3').series.targetWins, 2);
  assert.equal(fixture('best-of-5').series.targetWins, 3);
  for (const mode of ['bo3', 'best-of-7', '', null, 3, {}]) {
    assert.throws(() => createGame({ seriesMode: mode as SeriesMode }), /Freies Spiel/);
  }
});

test('free mode keeps wins and draws beyond three games and alternates every start', () => {
  const game = fixture();
  const starters: string[] = [];
  const originalSeries = game.series.id;
  for (const result of ['a', 'a', 'draw', 'b', 'a'] as const) {
    starters.push(game.currentTurn!);
    if (result === 'draw') draw(game);
    else success(resign(game, result === 'a' ? 'b' : 'a'));
    assert.equal(game.series.winner, null);
    assert.equal(game.series.id, originalSeries);
    if (game.series.completedGames < 5) next(game);
  }
  assert.deepEqual(starters, ['a', 'b', 'a', 'b', 'a']);
  assert.deepEqual(viewFor(game, 'a').series.winsByPlayer, { a: 3, b: 1 });
  assert.equal(game.series.draws, 1);
  assert.equal(game.series.completedGames, 5);
  assert.equal(game.series.gameNumber, 5);
  next(game);
  assert.equal(game.currentTurn, 'b');
  assert.equal(game.series.gameNumber, 6);
});

test('best-of-3 needs two wins even with a draw and then requires a jointly agreed new series', () => {
  const game = fixture('best-of-3');
  success(resign(game, 'b'));
  assert.equal(game.series.winner, null);
  next(game);
  draw(game);
  assert.equal(game.series.draws, 1);
  assert.equal(game.series.winner, null);
  next(game);
  success(resign(game, 'a'));
  assert.deepEqual(viewFor(game, 'a').series.winsByPlayer, { a: 1, b: 1 });
  next(game);
  success(resign(game, 'b'));
  assert.equal(game.series.winner, 'a');
  assert.equal(game.series.gameNumber, 4);
  assert.equal(game.series.completedGames, 4);
  const oldIdentity = identity(game);
  rejected(game, () => restartVote(game, 'a', oldIdentity));
  rejected(game, () => restartVote(game, 'b', oldIdentity));
  success(newSeriesVote(game, 'b', oldIdentity));
  assert.equal(game.series.winner, 'a');
  assert.equal(game.series.completedGames, 4);
  success(newSeriesVote(game, 'a', oldIdentity));
  assert.notEqual(game.series.id, oldIdentity.seriesId);
  assert.notEqual(game.series.matchId, oldIdentity.matchId);
  assert.equal(game.series.number, 2);
  assert.equal(game.series.mode, 'best-of-3');
  assert.equal(game.series.targetWins, 2);
  assert.equal(game.series.gameNumber, 1);
  assert.equal(game.series.completedGames, 0);
  assert.equal(game.series.draws, 0);
  assert.equal(game.series.winner, null);
  assert.deepEqual(viewFor(game, 'b').series.winsByPlayer, { a: 0, b: 0 });
  ready(game);
  assert.equal(game.currentTurn, 'a', 'start alternation also continues across series boundaries');
});

test('best-of-5 finishes at three wins, not two', () => {
  const game = fixture('best-of-5');
  for (let wins = 1; wins <= 3; wins++) {
    success(resign(game, 'a'));
    assert.equal(game.series.winsByPlayer.b, wins);
    assert.equal(game.series.winner, wins === 3 ? 'b' : null);
    if (wins < 3) next(game);
  }
  assert.equal(game.series.completedGames, 3);
  rejected(game, () => restartVote(game, 'a', identity(game)));
});

test('a finish is scored once despite repeated resignations, sync views and connection callbacks', () => {
  const game = fixture('best-of-3');
  success(resign(game, 'b'));
  const score = structuredClone(viewFor(game, 'a').series);
  rejected(game, () => resign(game, 'a'));
  rejected(game, () => resign(game, 'b'));
  rejected(game, () => resign(game, 'outsider'));
  for (let index = 0; index < 3; index++) {
    success(setConnected(game, 'b', false));
    success(setConnected(game, 'b', true));
    assert.deepEqual(viewFor(game, 'a').series, score);
  }
  assert.equal(game.phase, 'finished', 'reconnection cannot restart the old ready board');
});

test('next-game and new-series votes are exclusive per player and never combine to reset scores', () => {
  const game = fixture();
  success(resign(game, 'b'));
  const first = identity(game);
  success(newSeriesVote(game, 'a', first));
  assert.equal(game.series.completedGames, 1);
  const votedRevision = game.revision;
  success(newSeriesVote(game, 'a', first));
  assert.equal(game.revision, votedRevision, 'duplicate consent is idempotent');
  success(restartVote(game, 'b', first));
  assert.equal(game.phase, 'finished');
  assert.equal(game.players[0]!.newSeriesRequested, true);
  assert.equal(game.players[0]!.restartRequested, false);
  assert.equal(game.players[1]!.newSeriesRequested, false);
  assert.equal(game.players[1]!.restartRequested, true);
  success(restartVote(game, 'a', first));
  assert.equal(game.phase, 'setup');
  assert.equal(game.series.number, 1);
  assert.equal(game.series.gameNumber, 2);
  assert.deepEqual(viewFor(game, 'a').series.winsByPlayer, { a: 1, b: 0 });
  ready(game);
  draw(game);
  const second = identity(game);
  success(newSeriesVote(game, 'a', second));
  assert.equal(game.series.draws, 1, 'one vote cannot reset a free series');
  success(newSeriesVote(game, 'b', second));
  assert.equal(game.series.mode, 'free');
  assert.equal(game.series.number, 2);
  assert.equal(game.series.completedGames, 0);
  assert.equal(game.series.draws, 0);
  assert.deepEqual(viewFor(game, 'a').series.winsByPlayer, { a: 0, b: 0 });
});

test('both votes from one generation succeed; stale, malformed or foreign votes cannot advance later games', () => {
  const game = fixture();
  const first = identity(game);
  rejected(game, () => restartVote(game, 'a', first));
  rejected(game, () => newSeriesVote(game, 'a', first));
  success(resign(game, 'b'));
  const before = game.revision;
  success(restartVote(game, 'a', first));
  success(restartVote(game, 'a', first));
  success(restartVote(game, 'b', first));
  assert.equal(game.revision, before + 2, 'the second voter must not depend on the first voter revision');
  ready(game);
  success(resign(game, 'a'));
  rejected(game, () => restartVote(game, 'a', first));
  rejected(game, () => newSeriesVote(game, 'b', first));
  const current = identity(game);
  for (const malformed of [undefined, null, [], 'old', {}, { ...current, seriesId: 'previous' }, { ...current, matchId: 'previous' }]) {
    rejected(game, () => restartVote(game, 'a', malformed as MatchIdentity));
    rejected(game, () => newSeriesVote(game, 'a', malformed as MatchIdentity));
  }
  rejected(game, () => restartVote(game, 'outsider', current));
  success(newSeriesVote(game, 'a', current));
  success(newSeriesVote(game, 'b', current));
  ready(game);
  success(resign(game, 'b'));
  rejected(game, () => newSeriesVote(game, 'a', { seriesId: current.seriesId, matchId: game.series.matchId }));
});

test('disconnect clears consent and blocks both continuations without altering series results', () => {
  const game = fixture();
  success(resign(game, 'b'));
  const current = identity(game);
  success(restartVote(game, 'a', current));
  success(setConnected(game, 'b', false));
  assert.ok(game.players.every((player) => !player.restartRequested && !player.newSeriesRequested));
  rejected(game, () => restartVote(game, 'a', current));
  rejected(game, () => newSeriesVote(game, 'a', current));
  rejected(game, () => restartVote(game, 'b', current));
  assert.equal(game.series.completedGames, 1);
  success(setConnected(game, 'b', true));
  assert.equal(game.phase, 'finished');
  assert.ok(game.players.every((player) => !player.restartRequested && !player.newSeriesRequested));
  success(restartVote(game, 'b', current));
  assert.equal(game.phase, 'finished');
  success(restartVote(game, 'a', current));
  assert.equal(game.phase, 'setup');
});

test('ready confirmations never begin a game while one participant is disconnected', () => {
  const game = createGame();
  success(addPlayer(game, 'a', 'Ada'));
  success(addPlayer(game, 'b', 'Ben'));
  success(readyPlayer(game, 'b'));
  success(setConnected(game, 'b', false));
  success(readyPlayer(game, 'a'));
  assert.equal(game.phase, 'setup');
  assert.equal(game.currentTurn, null);
  assert.equal(game.series.completedGames, 0);
  success(setConnected(game, 'b', true));
  assert.equal(game.phase, 'playing');
  assert.equal(game.currentTurn, 'a');
});

test('restarting preserves identities and secrets while series views are detached and explicitly sanitized', () => {
  const game = fixture('best-of-3');
  const ids = game.players.map((player) => player.id);
  const oldPieces = new Set(game.board.flatMap((piece) => piece ? [piece.id] : []));
  success(resign(game, 'a'));
  next(game);
  assert.deepEqual(game.players.map((player) => player.id), ids);
  assert.ok(game.board.every((piece) => !piece || (!piece.revealed && !oldPieces.has(piece.id))));
  (game.series as unknown as Record<string, unknown>).privateInternal = 'never send';
  game.series.winsByPlayer.extraInternalKey = 91;
  const snapshot = viewFor(game, 'a');
  assert.equal(JSON.stringify(snapshot.series).includes('privateInternal'), false);
  assert.deepEqual(snapshot.series.winsByPlayer, { a: 0, b: 1 });
  assert.ok(snapshot.board.filter((piece) => piece?.owner === 'b').every((piece) => piece!.kind === null));
  snapshot.series.winsByPlayer.b = 900;
  snapshot.series.mode = 'free';
  assert.equal(game.series.winsByPlayer.b, 1);
  assert.equal(game.series.mode, 'best-of-3');
});

test('flag, trap and duel endings use the same exactly-once series scoring', () => {
  for (const ending of ['flag', 'trap', 'duel'] as const) {
    const game = fixture('best-of-5');
    game.board.fill(null);
    put(game, 24, 'a', 'rock');
    put(game, 17, 'b', ending === 'duel' ? 'rock' : ending);
    put(game, 41, 'a', 'flag');
    if (ending === 'trap') put(game, 6, 'b', 'paper');
    if (ending === 'flag') game.turnNumber = MAX_TURNS - 1;
    success(movePiece(game, 'a', 24, 17));
    if (ending === 'duel') {
      assert.equal(game.series.completedGames, 0);
      success(chooseDuel(game, 'a', 'paper'));
      assert.equal(game.series.completedGames, 0);
      success(chooseDuel(game, 'b', 'paper'));
      assert.equal(game.series.completedGames, 0, 'tied duel choices are not a drawn game');
      success(chooseDuel(game, 'a', 'paper'));
      success(chooseDuel(game, 'b', 'rock'));
    }
    const winner = ending === 'trap' ? 'b' : 'a';
    assert.equal(game.phase, 'finished');
    assert.equal(game.winner, winner);
    assert.equal(game.series.completedGames, 1);
    assert.equal(game.series.draws, 0);
    assert.equal(game.series.winsByPlayer[winner], 1);
    rejected(game, () => resign(game, winner === 'a' ? 'b' : 'a'));
  }
});
