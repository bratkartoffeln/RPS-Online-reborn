import assert from 'node:assert/strict';
import test from 'node:test';
import type { FighterKind, GameActionView, PieceKind } from '../shared/game';
import type { Snapshot } from '../shared/protocol';
import { combatModel, duelChoiceState, waitForCombatAnimation } from './combat-ui';

function animationEnd(name: string, bubbledTarget?: EventTarget): Event {
  const event = new Event('animationend');
  Object.defineProperty(event, 'animationName', { value: name });
  if (bubbledTarget) Object.defineProperty(event, 'target', { value: bubbledTarget });
  return event;
}

test('combat animation endpoints ignore unrelated and bubbled animations and complete exactly once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const target = new EventTarget(), child = new EventTarget();
  let completed = 0;
  waitForCombatAnimation(target, 'combat-impact', 1300, () => completed++);
  target.dispatchEvent(animationEnd('other-animation'));
  target.dispatchEvent(animationEnd('combat-impact', child));
  assert.equal(completed, 0);
  target.dispatchEvent(animationEnd('combat-impact'));
  assert.equal(completed, 1);
  target.dispatchEvent(animationEnd('combat-impact'));
  t.mock.timers.tick(2000);
  assert.equal(completed, 1, 'A later event or fallback cannot advance a second phase.');
});

test('cancelled combat nodes cannot advance a replacement, while a missing animation has a bounded fallback', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldNode = new EventTarget(), newNode = new EventTarget();
  let oldCompleted = 0, newCompleted = 0;
  const cancel = waitForCombatAnimation(oldNode, 'combat-approach-left', 1300, () => oldCompleted++);
  cancel();
  cancel();
  waitForCombatAnimation(newNode, 'combat-approach-left', 1300, () => newCompleted++);
  oldNode.dispatchEvent(animationEnd('combat-approach-left'));
  t.mock.timers.tick(1299);
  assert.equal(oldCompleted, 0);
  assert.equal(newCompleted, 0);
  t.mock.timers.tick(1);
  assert.equal(newCompleted, 1);
  newNode.dispatchEvent(animationEnd('combat-approach-left'));
  assert.equal(newCompleted, 1);
  assert.equal(oldCompleted, 0);
});

function fixture(): Snapshot {
  return {
    roomId: 'room', reconnectSeconds: 45, revision: 8, phase: 'playing', you: 'a',
    currentTurn: 'b', turnNumber: 3, paused: false, winner: null, finishReason: null,
    players: [
      { id: 'a', name: 'Anna', seat: 0, ready: true, connected: true, restartRequested: false, newSeriesRequested: false },
      { id: 'b', name: 'Ben', seat: 1, ready: true, connected: true, restartRequested: false, newSeriesRequested: false },
    ],
    board: Array(42).fill(null), legalMoves: {}, log: [], duel: null, lastAction: null,
    series: {
      id: 'series', number: 1, mode: 'free', matchId: 'match', gameNumber: 1,
      completedGames: 0, draws: 0, winsByPlayer: { a: 0, b: 0 }, targetWins: null,
      winner: null, startingSeat: 0, startingPlayer: 'a',
    },
  };
}

function action(attackerKind: PieceKind = 'rock', defenderKind: PieceKind = 'scissors', winner: 'attacker' | 'defender' | null = 'attacker'): GameActionView {
  return {
    id: 8, kind: 'battle', turnNumber: 3, from: 21, to: 14, duelRound: null,
    attacker: { id: 'attacker-piece', owner: 'a', kind: attackerKind, revealed: true },
    defender: { id: 'defender-piece', owner: 'b', kind: defenderKind, revealed: true },
    outcome: winner ?? 'duel', winnerId: winner ? `${winner}-piece` : null,
    removedIds: winner ? [winner === 'attacker' ? 'defender-piece' : 'attacker-piece'] : [],
  };
}

function duelView(): Snapshot {
  return { ...fixture(), phase: 'duel', duel: { id: 'duel', attacker: 'a', defender: 'b', from: 21, to: 14, round: 1, choiceLocked: { a: false, b: false }, yourChoice: null } };
}

test('public combat models retain seat colors, attack roles and winner ownership in both browser perspectives', () => {
  for (const you of ['a', 'b']) {
    const view = { ...fixture(), you };
    if (you === 'b') view.players.reverse();
    const result = combatModel(action(), view)!;
    assert.equal(result.attacker.team, 'blue');
    assert.equal(result.defender.team, 'red');
    assert.equal(result.attacker.own, you === 'a');
    assert.equal(result.defender.own, you === 'b');
    assert.equal(result.attacker.role, 'Angriff');
    assert.equal(result.defender.role, 'Verteidigung');
    assert.equal(result.attacker.result, 'winner');
    assert.equal(result.defender.result, 'loser');
    assert.equal(result.winnerOwnerId, 'a');
    assert.match(result.result, /Anna gewinnt/);
  }
});

test('all resolved weapon pairings display the server-confirmed winner rather than recomputing combat rules', () => {
  const wins: Array<[FighterKind, FighterKind]> = [['rock', 'scissors'], ['paper', 'rock'], ['scissors', 'paper']];
  for (const [winner, loser] of wins) {
    for (const attackerWins of [true, false]) {
      const result = combatModel(action(attackerWins ? winner : loser, attackerWins ? loser : winner, attackerWins ? 'attacker' : 'defender'), fixture())!;
      assert.equal(result.winnerOwnerId, attackerWins ? 'a' : 'b');
      assert.equal(result.attacker.kind, attackerWins ? winner : loser);
      assert.equal(result.defender.kind, attackerWins ? loser : winner);
      assert.equal(result.attacker.result, attackerWins ? 'winner' : 'loser');
      assert.equal(result.defender.result, attackerWins ? 'loser' : 'winner');
    }
  }
});

test('trap and flag combat preserve their public artwork and celebrate only the surviving owner', () => {
  const trap = combatModel({ ...action('scissors', 'trap', 'defender'), outcome: 'trap' }, fixture())!;
  assert.equal(trap.defender.kind, 'trap');
  assert.equal(trap.attacker.result, 'loser');
  assert.equal(trap.winnerOwnerId, 'b');
  assert.match(trap.result, /Falle von Ben hält stand/);
  const flag = combatModel({ ...action('paper', 'flag'), outcome: 'flag' }, fixture())!;
  assert.equal(flag.defender.kind, 'flag');
  assert.equal(flag.defender.result, 'loser');
  assert.equal(flag.winnerOwnerId, 'a');
  assert.match(flag.result, /Anna erobert die Flagge/);
});

test('equal weapons and repeated tied choices remain neutral even if stale winner fields are present', () => {
  for (const kind of ['rock', 'paper', 'scissors'] as const) {
    for (const outcome of ['duel', 'tie'] as const) {
      const result = combatModel({ ...action(kind, kind), kind: outcome === 'tie' ? 'duel' : 'battle', outcome, duelRound: outcome === 'tie' ? 2 : null }, fixture())!;
      assert.equal(result.winnerOwnerId, null);
      assert.equal(result.attacker.result, 'neutral');
      assert.equal(result.defender.result, 'neutral');
      assert.match(result.result, /wähl/i);
    }
  }
});

test('combat models never recover hidden weapons from current board cells or either private duel choice', () => {
  const view = duelView();
  view.board[14] = { id: 'defender-piece', owner: 'b', kind: 'trap', revealed: true };
  view.duel!.yourChoice = 'paper';
  const hidden = action();
  hidden.attacker.revealed = false;
  hidden.defender!.kind = null;
  const result = combatModel(hidden, view)!;
  assert.equal(result.attacker.kind, null);
  assert.equal(result.defender.kind, null);
  assert.equal(result.heading, 'Verdeckte Figur gegen Verdeckte Figur');
  const before = JSON.stringify(result);
  hidden.attacker.kind = 'paper';
  hidden.defender!.kind = 'trap';
  view.players[0].name = 'Changed';
  assert.equal(JSON.stringify(result), before, 'Queued models own their public display values.');
});

test('moves, incomplete opponents and unconfirmed removals never create a winning celebration', () => {
  assert.equal(combatModel({ ...action(), kind: 'move', outcome: 'move', defender: null }, fixture()), null);
  assert.equal(combatModel({ ...action(), defender: null }, fixture()), null);
  assert.equal(combatModel({ ...action(), defender: { ...action().attacker } }, fixture()), null);
  const invalidOwner = action();
  invalidOwner.defender!.owner = 'missing';
  assert.equal(combatModel(invalidOwner, fixture()), null);
  for (const change of [{ winnerId: 'missing' }, { removedIds: [] }, { removedIds: ['attacker-piece', 'defender-piece'] }, { outcome: 'move' as const }]) {
    const result = combatModel({ ...action(), ...change }, fixture())!;
    assert.equal(result.winnerOwnerId, null);
    assert.equal(result.attacker.result, 'neutral');
    assert.equal(result.defender.result, 'neutral');
  }
});

test('weapon selection shows only the viewer choice and remembers its fixed team color', () => {
  for (const you of ['a', 'b']) {
    const view = { ...duelView(), you };
    view.duel!.yourChoice = 'paper';
    view.duel!.choiceLocked[you] = true;
    const choice = duelChoiceState(view, { connected: true, pending: false })!;
    assert.equal(choice.team, you === 'a' ? 'blue' : 'red');
    assert.equal(choice.selected, 'paper');
    assert.equal(choice.locked, true);
    assert.equal(choice.disabled, true);
    assert.match(choice.status, /Du hast Papier gewählt/);
  }
  const otherLocked = duelView();
  otherLocked.duel!.choiceLocked.b = true;
  const choice = duelChoiceState(otherLocked, { connected: true, pending: false })!;
  assert.equal(choice.selected, null);
  assert.equal(choice.disabled, false);
  assert.match(choice.status, /Gegner hat verdeckt gewählt/);
  assert.doesNotMatch(choice.status, /Papier|Stein|Schere/);
});

test('weapon choices are blocked during the fight, pause, disconnect, submission and spectator states', () => {
  assert.equal(duelChoiceState(null, { connected: true, pending: false }), null);
  assert.equal(duelChoiceState(fixture(), { connected: true, pending: false }), null);
  assert.equal(duelChoiceState(duelView(), { connected: true, pending: false }, true), null);
  assert.equal(duelChoiceState({ ...duelView(), you: 'spectator' }, { connected: true, pending: false }), null);
  for (const [connected, pending, paused] of [[false, false, false], [true, true, false], [true, false, true]]) {
    assert.equal(duelChoiceState({ ...duelView(), paused }, { connected, pending })?.disabled, true);
  }
  assert.equal(duelChoiceState(duelView(), { connected: true, pending: false })?.disabled, false);
});

test('duel and match identity change only when the corresponding displayed round or match changes', () => {
  const initial = duelView();
  const options = { connected: true, pending: false };
  const identity = duelChoiceState(initial, options)!.identity;
  assert.equal(duelChoiceState({ ...initial, revision: initial.revision + 1 }, options)!.identity, identity);
  assert.notEqual(duelChoiceState({ ...initial, duel: { ...initial.duel!, round: 2 } }, options)!.identity, identity);
  const nextMatch = { ...initial, series: { ...initial.series, matchId: 'next-match' } };
  assert.notEqual(duelChoiceState(nextMatch, options)!.identity, identity);
  assert.notEqual(combatModel(action(), nextMatch)!.identity, combatModel(action(), initial)!.identity);
});
