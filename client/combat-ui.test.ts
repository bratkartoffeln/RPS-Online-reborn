import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { FighterKind, GameActionView, PieceKind } from '../shared/game';
import type { Snapshot } from '../shared/protocol';
import { CombatOverlay, combatModel, confirmedDuelChoice, duelChoiceState, icqCombatScene, isTextEntry, waitForCombatAnimation, type CombatModel, type CombatStage, type DuelChoiceState } from './combat-ui';
import { builtInSkin } from './skins';

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

/** Keep the real queue, epoch guards and animation waits; substitute only DOM painting. */
function overlayHarness(t: TestContext, systemReduced = false, beforeBattle?: () => Promise<void>) {
  const left = new EventTarget(), cloud = new EventTarget(), winner = new EventTarget();
  const nodes: Record<string, EventTarget> = {
    '.combat-fighter:first-child .combat-art': left,
    '.combat-cloud': cloud,
    '.combat-fighter[data-result="winner"] .combat-art': winner,
  };
  const root = {
    classList: { add() {} }, dataset: {}, hidden: true, childElementCount: 0,
    contains: () => false, querySelector: (selector: string) => nodes[selector] ?? null,
    ownerDocument: { activeElement: null, body: {}, defaultView: { matchMedia: () => ({ matches: systemReduced }) } },
  } as unknown as HTMLElement;
  const starts: GameActionView[] = [], celebrations: string[] = [], busyChanges: boolean[] = [], choices: DuelChoiceState[] = [];
  const overlay = new CombatOverlay(root, {
    onBusyChange: (busy) => busyChanges.push(busy),
    onCelebrate: (owner) => celebrations.push(owner),
    onBattleStart: (event) => starts.push(event),
    beforeBattle,
  });
  const paint = overlay as unknown as {
    active: CombatModel | null; activeStage: CombatStage; activeReduced: boolean;
    paintChoice: (choice: DuelChoiceState) => void; paintBattle: () => void; continueBattle: () => void;
  };
  t.mock.method(paint, 'paintChoice', (choice: DuelChoiceState) => {
    root.hidden = false;
    root.dataset.mode = 'choice';
    choices.push({ ...choice });
  });
  t.mock.method(paint, 'paintBattle', () => {
    root.hidden = false;
    root.dataset.mode = 'battle';
    root.dataset.stage = paint.activeStage;
    root.dataset.motion = paint.activeReduced ? 'reduced' : 'full';
    delete root.dataset.transition;
    paint.continueBattle();
  });
  return { overlay, root, left, cloud, winner, starts, celebrations, busyChanges, choices, skin: builtInSkin() };
}

function resolvedChoice(id = 8): GameActionView {
  return { ...action('paper', 'rock'), id, kind: 'duel', duelRound: 1 };
}

test('the overlay stays hidden until the board movement completes; a cancelled wait cannot reveal a stale fight', async (t) => {
  for (const cancel of [false, true]) {
    let landed!: () => void;
    const movement = new Promise<void>(resolve => { landed = resolve; });
    const h = overlayHarness(t, false, () => movement), view = fixture();
    h.overlay.update(view, h.skin, { connected: true, pending: false });
    h.overlay.present(action(), view);
    h.overlay.update(view, h.skin, { connected: true, pending: false });
    assert.equal(h.overlay.busy, true);
    assert.equal(h.root.hidden, true);
    assert.equal(h.starts.length, 0);
    if (cancel) h.overlay.reset();
    landed();
    await movement;
    assert.equal(h.starts.length, cancel ? 0 : 1);
    assert.equal(h.root.hidden, cancel);
    h.overlay.reset();
  }
});

test('both ICQ designs select the physical encounter for either attack direction', () => {
  for (const id of ['icq-retro', 'icq-retro-dark']) {
    const skin = { ...builtInSkin(), id };
    for (const [winner, loser, scene] of [['paper', 'rock', 'wrap'], ['scissors', 'paper', 'cut'], ['rock', 'scissors', 'split']] as const) {
      assert.equal(icqCombatScene(skin, combatModel(action(winner, loser), fixture())!), scene);
      assert.equal(icqCombatScene(skin, combatModel(action(loser, winner, 'defender'), fixture())!), scene);
    }
    assert.equal(icqCombatScene(skin, combatModel(action('rock', 'rock', null), fixture())!), 'standard');
  }
  assert.equal(icqCombatScene(builtInSkin(), combatModel(action('paper', 'rock'), fixture())!), 'standard');
});

test('a permanent departure cancels a queued fight even when the final snapshot is not paused', async (t) => {
  let landed!: () => void;
  const movement = new Promise<void>(resolve => { landed = resolve; });
  const h = overlayHarness(t, false, () => movement), view = fixture();
  h.overlay.update(view, h.skin, { connected: true, pending: false });
  h.overlay.present(action(), view);
  h.overlay.update({ ...view, phase: 'finished', players: view.players.map(player => ({ ...player, connected: player.id === 'a' })) }, h.skin, { connected: true, pending: false });
  landed();
  await movement;
  assert.equal(h.root.hidden, true);
  assert.equal(h.overlay.busy, false);
  assert.equal(h.starts.length, 0);
});

test('confirmed choice pause contains only the viewer weapon, including the second submitter without a private acknowledgement', () => {
  for (const you of ['a', 'b']) {
    const view = { ...fixture(), you };
    const model = combatModel(resolvedChoice(), view)!;
    const held = confirmedDuelChoice(model, null)!;
    assert.equal(held.selected, you === 'a' ? 'paper' : 'rock');
    assert.equal(held.team, you === 'a' ? 'blue' : 'red');
    assert.equal(held.disabled, true);
    assert.equal(held.locked, true);
    assert.doesNotMatch(held.status, /Papier|Stein|Schere|gewinnt|verliert/);
    const changedOpponent = resolvedChoice();
    (you === 'a' ? changedOpponent.defender! : changedOpponent.attacker).kind = 'scissors';
    assert.deepEqual(confirmedDuelChoice(combatModel(changedOpponent, view)!, null), held, 'The held UI does not depend on the opponent weapon.');
  }
  assert.equal(confirmedDuelChoice(combatModel(action(), fixture())!, null), null, 'Ordinary attacks do not create a choice pause.');
});

test('confirmed choices hold the board busy for 600ms; skin repaints neither reveal early nor repeat the start callback', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = overlayHarness(t), before = duelView(), after = fixture();
  before.duel!.yourChoice = 'paper';
  before.duel!.choiceLocked.a = true;
  h.overlay.update(before, h.skin, { connected: true, pending: false });
  const event = resolvedChoice();
  h.overlay.present(event, after);
  assert.equal(h.overlay.busy, true);
  assert.equal(h.overlay.waitingForReveal, true);
  assert.equal(h.root.dataset.transition, 'reveal');
  assert.equal(h.root.dataset.mode, 'choice');
  assert.equal(h.choices.at(-1)!.duelId, 'duel');
  assert.equal(h.choices.at(-1)!.selected, 'paper');
  assert.equal(h.starts.length, 0);
  t.mock.timers.tick(300);
  h.overlay.update(after, { ...h.skin }, { connected: true, pending: false });
  t.mock.timers.tick(299);
  assert.equal(h.starts.length, 0);
  event.defender!.kind = 'scissors';
  t.mock.timers.tick(1);
  assert.equal(h.overlay.waitingForReveal, false);
  assert.equal(h.root.dataset.mode, 'battle');
  assert.equal(h.starts.length, 1);
  assert.equal(h.starts[0].defender!.kind, 'rock', 'The deferred callback owns a copy of its original public event.');
  h.overlay.update(after, { ...h.skin }, { connected: true, pending: false });
  assert.equal(h.starts.length, 1);
  assert.deepEqual(h.busyChanges, [true]);
  h.overlay.reset();
  t.mock.timers.tick(20000);
  assert.deepEqual(h.celebrations, []);
});

test('reset, disconnect, pause and a new match discard delayed and queued fights without affecting a later valid pause', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const cancel of ['reset', 'disconnect', 'pause', 'match']) {
    const h = overlayHarness(t), before = duelView();
    let current = fixture();
    h.overlay.update(before, h.skin, { connected: true, pending: false });
    h.overlay.present(resolvedChoice(8), current);
    h.overlay.present(resolvedChoice(9), current);
    t.mock.timers.tick(250);
    if (cancel === 'reset') h.overlay.reset();
    if (cancel === 'disconnect') h.overlay.update(current, h.skin, { connected: false, pending: false });
    if (cancel === 'pause') h.overlay.update({ ...current, paused: true }, h.skin, { connected: true, pending: false });
    if (cancel === 'match') {
      current = { ...current, series: { ...current.series, matchId: 'next-match' } };
      h.overlay.update(current, h.skin, { connected: true, pending: false });
    }
    assert.equal(h.overlay.busy, false, cancel);
    assert.equal(h.overlay.waitingForReveal, false, cancel);
    h.overlay.update(current, h.skin, { connected: true, pending: false });
    h.overlay.present(resolvedChoice(10), current);
    t.mock.timers.tick(350); // The cancelled first pause would have expired here.
    assert.equal(h.overlay.waitingForReveal, true, cancel);
    assert.equal(h.starts.length, 0, cancel);
    t.mock.timers.tick(249);
    assert.equal(h.starts.length, 0, cancel);
    t.mock.timers.tick(1);
    assert.deepEqual(h.starts.map((event) => event.id), [10], cancel);
    h.overlay.reset();
    t.mock.timers.tick(20000);
    assert.deepEqual(h.starts.map((event) => event.id), [10], cancel);
    assert.deepEqual(h.celebrations, [], cancel);
  }
});

test('ordinary fights start immediately and use all four animation endpoints before celebration; neutral results remain for 1800ms', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = overlayHarness(t), view = fixture();
  h.overlay.update(view, h.skin, { connected: true, pending: false });
  h.overlay.present(action(), view);
  assert.equal(h.overlay.waitingForReveal, false);
  assert.equal(h.starts.length, 1);
  t.mock.timers.tick(600);
  h.left.dispatchEvent(animationEnd('combat-approach-left'));
  assert.equal(h.root.dataset.stage, 'impact');
  t.mock.timers.tick(600);
  h.cloud.dispatchEvent(animationEnd('combat-impact'));
  assert.equal(h.root.dataset.stage, 'shatter');
  t.mock.timers.tick(700);
  h.left.dispatchEvent(animationEnd('combat-return-left'));
  assert.equal(h.root.dataset.stage, 'winner');
  t.mock.timers.tick(1100);
  assert.deepEqual(h.celebrations, []);
  h.winner.dispatchEvent(animationEnd('combat-winner-pulse'));
  assert.equal(h.overlay.busy, false);
  assert.deepEqual(h.celebrations, ['a']);
  h.overlay.present({ ...action('rock', 'rock', null), id: 9 }, duelView());
  t.mock.timers.tick(600);
  h.left.dispatchEvent(animationEnd('combat-approach-left'));
  t.mock.timers.tick(600);
  h.cloud.dispatchEvent(animationEnd('combat-impact'));
  assert.equal(h.root.dataset.stage, 'result');
  t.mock.timers.tick(1799);
  assert.equal(h.overlay.busy, true);
  t.mock.timers.tick(1);
  assert.equal(h.overlay.busy, false);
  assert.equal(h.root.dataset.mode, 'choice');
  assert.deepEqual(h.celebrations, ['a']);
  h.overlay.reset();
});

test('missing animation events use the longer bounded phase fallbacks', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = overlayHarness(t), view = fixture();
  h.overlay.update(view, h.skin, { connected: true, pending: false });
  h.overlay.present(action(), view);
  for (const [delay, current, next] of [[1600, 'approach', 'impact'], [1600, 'impact', 'shatter'], [1700, 'shatter', 'winner']] as const) {
    t.mock.timers.tick(delay - 1);
    assert.equal(h.root.dataset.stage, current);
    t.mock.timers.tick(1);
    assert.equal(h.root.dataset.stage, next);
  }
  t.mock.timers.tick(2099);
  assert.equal(h.overlay.busy, true);
  t.mock.timers.tick(1);
  assert.equal(h.overlay.busy, false);
  assert.deepEqual(h.celebrations, ['a']);
  h.overlay.reset();
});

test('motion disabled during the choice pause and system reduced motion retain the pause followed by a static 350ms result', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const systemReduced of [false, true]) {
    const h = overlayHarness(t, systemReduced);
    h.overlay.update(duelView(), h.skin, { connected: true, pending: false });
    h.overlay.present(resolvedChoice(), fixture());
    t.mock.timers.tick(300);
    if (!systemReduced) h.overlay.setAnimationsEnabled(false);
    assert.equal(h.overlay.waitingForReveal, true);
    assert.equal(h.starts.length, 0);
    t.mock.timers.tick(300);
    assert.equal(h.root.dataset.stage, 'result');
    assert.equal(h.root.dataset.motion, 'reduced');
    assert.equal(h.starts.length, 1);
    t.mock.timers.tick(349);
    assert.equal(h.overlay.busy, true);
    t.mock.timers.tick(1);
    assert.equal(h.overlay.busy, false);
    assert.deepEqual(h.celebrations, ['a']);
    h.left.dispatchEvent(animationEnd('combat-approach-left'));
    t.mock.timers.tick(20000);
    assert.equal(h.starts.length, 1);
    assert.deepEqual(h.celebrations, ['a']);
    h.overlay.reset();
  }
});

test('typing targets preserve their focus while board controls can still receive the initial weapon choice focus', () => {
  const element = (tagName: string, type = '', isContentEditable = false) => ({ tagName, type, isContentEditable }) as unknown as Element;
  for (const input of [element('INPUT', 'text'), element('INPUT', 'search'), element('TEXTAREA'), element('SPAN', '', true)]) {
    assert.equal(isTextEntry(input), true);
  }
  for (const control of [null, element('DIV'), element('BUTTON', 'button'), element('INPUT', 'checkbox'), element('SPAN')]) {
    assert.equal(isTextEntry(control), false);
  }
});
