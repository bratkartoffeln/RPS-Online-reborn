import assert from 'node:assert/strict';
import test from 'node:test';
import { addPlayer, createGame, readyPlayer, resign, viewFor, type GameView } from '../shared/game';
import { EndgameOverlay, endgameModel } from './endgame-ui';

function finished(winner: 'a' | 'b' = 'a'): GameView {
  const game = createGame({ random: () => .5 });
  addPlayer(game, 'a', 'Blau'); addPlayer(game, 'b', 'Rot');
  readyPlayer(game, 'a'); readyPlayer(game, 'b');
  resign(game, winner === 'a' ? 'b' : 'a');
  return viewFor(game, 'a');
}

test('the winner raises their absolute team color and smiles, independently of the viewer and finish reason', () => {
  for (const winner of ['a', 'b'] as const) for (const viewer of ['a', 'b']) for (const finishReason of ['flag', 'no_moves', 'resign'] as const) {
    const view = { ...finished(winner), you: viewer, finishReason };
    const model = endgameModel(view)!;
    assert.equal(model.winnerTeam, winner === 'a' ? 'blue' : 'red');
    assert.equal(model.right.team, model.winnerTeam);
    assert.equal(model.right.mood, 'happy');
    assert.equal(model.left.mood, 'sad');
    assert.notEqual(model.left.team, model.right.team);
  }
});

test('draws use neutral characters and no winner flag; incomplete or active games have no end scene', () => {
  const view = finished();
  const draw = endgameModel({ ...view, winner: null, finishReason: 'turn_limit' })!;
  assert.equal(draw.title, 'Unentschieden');
  assert.equal(draw.winnerTeam, null);
  assert.equal(draw.left.mood, 'neutral');
  assert.equal(draw.right.mood, 'neutral');
  assert.equal(endgameModel(null), null);
  assert.equal(endgameModel({ ...view, phase: 'setup' }), null);
  assert.equal(endgameModel({ ...view, winner: 'unknown' }), null);
  assert.equal(endgameModel({ ...view, players: view.players.slice(0, 1) }), null);
});

test('the overlay waits for the last battle and persists through sync, votes and reconnects until a new game', () => {
  let markup = '', paints = 0;
  const root = {
    hidden: true, classList: { add() {} }, dataset: {},
    get innerHTML() { return markup; },
    set innerHTML(value: string) { markup = value; paints++; },
    replaceChildren() { markup = ''; },
  } as unknown as HTMLElement;
  const overlay = new EndgameOverlay(root);
  const view = finished();
  overlay.update(view, true);
  assert.equal(root.hidden, true);
  overlay.update(view, false);
  assert.equal(root.hidden, false);
  const painted = paints;
  for (let count = 0; count < 20; count++) {
    overlay.update({ ...view, revision: view.revision + count, players: view.players.map(player => ({ ...player, connected: count % 2 === 0, restartRequested: true })) }, false);
    assert.equal(root.hidden, false);
  }
  assert.equal(paints, painted, 'Unchanged results keep the existing DOM');
  overlay.update({ ...view, phase: 'setup', series: { ...view.series, matchId: 'new' } }, false);
  assert.equal(root.hidden, true);
  assert.equal(markup, '');
  overlay.update(view, false);
  overlay.update(null, false);
  assert.equal(root.hidden, true);
});

test('player names remain text in the end scene', () => {
  let markup = '';
  const root = { classList: { add() {} }, dataset: {}, hidden: true, set innerHTML(value: string) { markup = value; }, replaceChildren() {} } as unknown as HTMLElement;
  const view = finished();
  new EndgameOverlay(root).update({ ...view, players: view.players.map(player => ({ ...player, name: '<img onerror="bad">' })) }, false);
  assert.ok(markup.includes('&lt;img'));
  assert.ok(!markup.includes('<img onerror'));
});
