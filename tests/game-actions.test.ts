import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addPlayer, chooseDuel, createGame, movePiece, readyPlayer, resign, restartVote,
  setConnected, viewFor,
  type ActionResult, type FighterKind, type GameState, type PieceKind,
} from '../shared/game.js';

function success(result: ActionResult): void {
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
}

/** Spare fighters preserve ordinary play after a single captured piece. */
function battle(attacker: FighterKind = 'rock', defender: PieceKind = 'scissors'): GameState {
  let sequence = 0;
  const game = createGame({ random: () => 0.5, idGenerator: () => `piece-${++sequence}` });
  success(addPlayer(game, 'a', 'Ada'));
  success(addPlayer(game, 'b', 'Ben'));
  success(readyPlayer(game, 'a'));
  success(readyPlayer(game, 'b'));
  game.board.fill(null);
  for (const [cell, owner, kind] of [
    [24, 'a', attacker], [17, 'b', defender],
    [35, 'a', 'paper'], [6, 'b', 'paper'],
    [41, 'a', 'flag'], [0, 'b', 'flag'],
  ] as const) {
    game.board[cell] = { id: `piece-${++sequence}`, owner, kind, revealed: false };
  }
  return game;
}

test('move events reveal an unknown mover only to its owner, while known movers stay public', () => {
  for (const revealed of [false, true]) {
    const game = battle();
    game.board[24]!.revealed = revealed;
    (game.board[24]! as unknown as Record<string, unknown>).internalSecret = 'never serialize this';
    const mover = game.board[24]!.id;
    success(movePiece(game, 'a', 24, 23));
    const own = viewFor(game, 'a').lastAction!;
    assert.equal(own.kind, 'move');
    assert.equal(own.id, game.revision);
    assert.equal(own.turnNumber, 1);
    assert.equal(own.attacker.id, mover);
    assert.equal(own.attacker.kind, 'rock');
    assert.equal(own.attacker.revealed, revealed);
    assert.equal(own.defender, null);
    assert.equal(own.winnerId, null);
    assert.deepEqual(own.removedIds, []);
    for (const viewer of ['b', 'not-a-player']) {
      const snapshot = viewFor(game, viewer);
      const action = snapshot.lastAction!;
      assert.equal(action.attacker.kind, revealed ? 'rock' : null, viewer);
      assert.equal(action.attacker.id, mover);
      assert.equal(action.from, 24);
      assert.equal(action.to, 23);
      assert.deepEqual(Object.keys(action.attacker).sort(), ['id', 'kind', 'owner', 'revealed']);
      assert.equal(JSON.stringify(snapshot).includes('internalSecret'), false);
      assert.equal(JSON.stringify(snapshot).includes('never serialize this'), false);
      assert.equal(snapshot.board[23]!.kind, revealed ? 'rock' : null);
    }
  }
});

test('resolved battles preserve both public participants even after the losing figure is removed', () => {
  for (const [attacker, defender, outcome, winnerSide] of [
    ['rock', 'scissors', 'attacker', 'attacker'],
    ['rock', 'paper', 'defender', 'defender'],
    ['rock', 'trap', 'trap', 'defender'],
    ['rock', 'flag', 'flag', 'attacker'],
  ] as const) {
    const game = battle(attacker, defender);
    const attackerId = game.board[24]!.id;
    const defenderId = game.board[17]!.id;
    success(movePiece(game, 'a', 24, 17));
    const event = viewFor(game, 'a').lastAction!;
    assert.equal(event.kind, 'battle', outcome);
    assert.equal(event.outcome, outcome);
    assert.equal(event.id, game.revision);
    assert.equal(event.turnNumber, 1);
    assert.equal(event.duelRound, null);
    assert.deepEqual(event.attacker, { id: attackerId, owner: 'a', kind: attacker, revealed: true });
    assert.deepEqual(event.defender, { id: defenderId, owner: 'b', kind: defender, revealed: true });
    assert.equal(event.winnerId, winnerSide === 'attacker' ? attackerId : defenderId);
    const removedId = winnerSide === 'attacker' ? defenderId : attackerId;
    assert.deepEqual(event.removedIds, [removedId]);
    assert.equal(game.board.some((piece) => piece?.id === removedId), false);
    assert.equal(game.board[17]!.id, event.winnerId);
    assert.deepEqual(viewFor(game, 'b').lastAction, event);
    assert.deepEqual(viewFor(game, 'not-a-player').lastAction, event);
    if (outcome === 'flag') assert.equal(game.finishReason, 'flag');
  }
});

test('duel events publish choices only after both submissions and keep earlier results unchanged', () => {
  for (const [attackChoice, defenseChoice, outcome] of [
    ['paper', 'rock', 'attacker'],
    ['rock', 'paper', 'defender'],
  ] as const) {
    const game = battle('rock', 'rock');
    success(movePiece(game, 'a', 24, 17));
    const opening = viewFor(game, 'b').lastAction!;
    const originalOpening = structuredClone(opening);
    assert.equal(opening.kind, 'battle');
    assert.equal(opening.outcome, 'duel');
    assert.equal(opening.duelRound, 1);
    assert.equal(opening.turnNumber, 1);
    assert.equal(opening.winnerId, null);
    assert.deepEqual(opening.removedIds, []);

    // Submit the defender first to cover either arrival order on the network.
    success(chooseDuel(game, 'b', 'scissors'));
    assert.ok(game.revision > opening.id);
    for (const viewer of ['a', 'b', 'not-a-player']) {
      assert.deepEqual(viewFor(game, viewer).lastAction, originalOpening);
    }
    assert.equal(viewFor(game, 'a').duel!.yourChoice, null);
    assert.equal(viewFor(game, 'b').duel!.yourChoice, 'scissors');
    assert.equal(viewFor(game, 'not-a-player').duel!.yourChoice, null);
    assert.equal(viewFor(game, 'a').board[17]!.kind, 'rock');
    const beforeRejectedChoice = JSON.stringify(game);
    assert.equal(chooseDuel(game, 'b', 'paper').ok, false);
    assert.equal(JSON.stringify(game), beforeRejectedChoice);

    success(chooseDuel(game, 'a', 'scissors'));
    const tied = viewFor(game, 'a').lastAction!;
    const originalTie = structuredClone(tied);
    assert.equal(tied.kind, 'duel');
    assert.equal(tied.outcome, 'tie');
    assert.equal(tied.duelRound, 1);
    assert.equal(tied.attacker.kind, 'scissors');
    assert.equal(tied.defender!.kind, 'scissors');
    assert.equal(tied.winnerId, null);
    assert.deepEqual(tied.removedIds, []);
    assert.equal(game.duel!.round, 2);
    assert.equal(game.turnNumber, 0);
    assert.deepEqual(opening, originalOpening, 'an already returned result must not change with a new choice');

    success(chooseDuel(game, 'a', attackChoice));
    assert.deepEqual(viewFor(game, 'b').lastAction, originalTie);
    assert.equal(viewFor(game, 'b').duel!.yourChoice, null);
    success(chooseDuel(game, 'b', defenseChoice));
    const resolved = viewFor(game, 'a').lastAction!;
    assert.equal(resolved.kind, 'duel');
    assert.equal(resolved.outcome, outcome);
    assert.equal(resolved.duelRound, 2);
    assert.equal(resolved.turnNumber, 1);
    assert.equal(resolved.attacker.kind, attackChoice);
    assert.equal(resolved.defender!.kind, defenseChoice);
    assert.ok(resolved.id > tied.id && tied.id > opening.id);
    const winner = outcome === 'attacker' ? resolved.attacker.id : resolved.defender!.id;
    const loser = outcome === 'attacker' ? resolved.defender!.id : resolved.attacker.id;
    assert.equal(resolved.winnerId, winner);
    assert.deepEqual(resolved.removedIds, [loser]);
    assert.equal(game.board[17]!.id, winner);
    assert.equal(game.turnNumber, 1);
    assert.equal(game.duel, null);
    assert.deepEqual(viewFor(game, 'b').lastAction, resolved);
    assert.deepEqual(tied, originalTie, 'the previous round remains an immutable client snapshot');
  }
});

test('action snapshots are detached, stable on invalid commands and reconnect, and cleared by an agreed rematch', () => {
  const game = battle();
  success(movePiece(game, 'a', 24, 23));
  const original = viewFor(game, 'a').lastAction!;
  const writable = viewFor(game, 'a').lastAction!;
  writable.attacker.kind = 'paper';
  writable.attacker.owner = 'someone else';
  writable.removedIds.push('injected');
  assert.deepEqual(viewFor(game, 'a').lastAction, original);

  const unchangedRevision = game.revision;
  assert.equal(movePiece(game, 'a', 23, 22).ok, false, 'out-of-turn command');
  assert.equal(movePiece(game, 'not-a-player', 23, 22).ok, false, 'unknown player');
  assert.equal(game.revision, unchangedRevision);
  assert.deepEqual(viewFor(game, 'a').lastAction, original);

  success(setConnected(game, 'b', false));
  assert.equal(viewFor(game, 'a').paused, true);
  assert.equal(movePiece(game, 'b', 17, 16).ok, false, 'paused command');
  assert.deepEqual(viewFor(game, 'a').lastAction, original);
  success(setConnected(game, 'b', true));
  assert.ok(game.revision > original.id);
  assert.deepEqual(viewFor(game, 'a').lastAction, original, 'connection revisions must not replay the event');

  success(resign(game, 'b'));
  const identity = { seriesId: game.series.id, matchId: game.series.matchId };
  success(restartVote(game, 'a', identity));
  assert.deepEqual(viewFor(game, 'a').lastAction, original, 'one vote has not started a new game');
  success(restartVote(game, 'b', identity));
  assert.equal(game.phase, 'setup');
  assert.equal(viewFor(game, 'a').lastAction, null);
  assert.equal(viewFor(game, 'b').lastAction, null);
  assert.equal(viewFor(game, 'not-a-player').lastAction, null);
});
