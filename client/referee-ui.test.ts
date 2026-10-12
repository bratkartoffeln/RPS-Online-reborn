import assert from 'node:assert/strict';
import test from 'node:test';
import { refereePortrait, type RefereeView } from './referee-ui';
import { DEFAULT_SKIN, parseSkinDefinition, SkinError } from './skins';
import type { SkinDefinition } from './skin-types';

const skin: SkinDefinition = { ...DEFAULT_SKIN, portrait: 'neutral', colorTurnPortraits: { blue: 'blue-turn', red: 'red-turn' } };
const directionalSkin: SkinDefinition = {
  ...skin,
  directionalTurnPortraits: {
    blue: { top: 'blue-top', bottom: 'blue-bottom' },
    red: { top: 'red-top', bottom: 'red-bottom' },
  },
};
function fixture(): RefereeView {
  return {
    phase: 'playing', you: 'a', currentTurn: 'a', winner: null, paused: false,
    players: [
      { id: 'a', name: 'Anna', seat: 0, ready: true, connected: true, restartRequested: false, newSeriesRequested: false },
      { id: 'b', name: 'Ben', seat: 1, ready: true, connected: true, restartRequested: false, newSeriesRequested: false },
    ],
  };
}

test('referee portraits accept optional per-team atlas references and reject invalid mappings', () => {
  const raw = { version: 1, name: 'Referee', atlas: { image: 'atlas.png', frames: { neutral: { x: 0, y: 0, width: 64, height: 64 } } } };
  const parsed = parseSkinDefinition({ ...raw, portrait: 'neutral', turnPortraits: { own: 'neutral', enemy: 'neutral' } });
  assert.deepEqual(parsed.turnPortraits, { own: 'neutral', enemy: 'neutral' });
  assert.deepEqual(parseSkinDefinition({ ...raw, turnPortraits: { own: 'neutral' } }).turnPortraits, { own: 'neutral' });
  for (const turnPortraits of [null, [], 'neutral', { own: 'missing' }, { enemy: 'missing' }, { observer: 'neutral' }, { own: { frame: 'neutral' } }]) {
    assert.throws(() => parseSkinDefinition({ ...raw, turnPortraits }), SkinError);
  }
});

test('both viewers see the same seat color for a turn, independent of player order', () => {
  const first = fixture();
  const second = { ...first, you: 'b', players: [...first.players].reverse() };
  assert.equal(refereePortrait(skin, first).frame, 'blue-turn');
  assert.equal(refereePortrait(skin, first).team, 'blue');
  assert.match(refereePortrait(skin, first).label, /Anna \(du\).*Blau/);
  assert.equal(refereePortrait(skin, second).frame, 'blue-turn');
  assert.equal(refereePortrait(skin, second).team, 'blue');
  assert.match(refereePortrait(skin, second).label, /Anna.*Blau/);
  first.currentTurn = second.currentTurn = 'b';
  assert.equal(refereePortrait(skin, first).frame, 'red-turn');
  assert.equal(refereePortrait(skin, first).team, 'red');
  assert.match(refereePortrait(skin, first).label, /Ben.*Rot/);
  assert.equal(refereePortrait(skin, second).frame, 'red-turn');
  assert.equal(refereePortrait(skin, second).team, 'red');
  assert.match(refereePortrait(skin, second).label, /Ben \(du\).*Rot/);
});

test('each viewer gets the active flag color pointing toward that player on their board', () => {
  for (const you of ['a', 'b']) {
    for (const currentTurn of ['a', 'b']) {
      const view = { ...fixture(), you, currentTurn };
      if (you === 'b') view.players.reverse();
      const result = refereePortrait(directionalSkin, view);
      const team = currentTurn === 'a' ? 'blue' : 'red';
      const direction = currentTurn === you ? 'bottom' : 'top';
      assert.equal(result.team, team);
      assert.equal(result.direction, direction);
      assert.equal(result.frame, `${team}-${direction}`);
      assert.match(result.label, direction === 'bottom' ? /unten auf dem Spielfeld/ : /oben auf dem Spielfeld/);
    }
  }
});

test('waiting, setup and simultaneous duels use the neutral referee with both flags', () => {
  assert.equal(refereePortrait(skin, null).frame, 'neutral');
  for (const phase of ['waiting', 'setup', 'duel'] as const) {
    const state = refereePortrait(directionalSkin, { ...fixture(), phase });
    assert.equal(state.frame, 'neutral');
    assert.equal(state.team, null);
    assert.equal(state.direction, null);
    assert.doesNotMatch(state.label, /oben|unten/);
  }
  assert.match(refereePortrait(skin, { ...fixture(), phase: 'duel' }).label, /Beide Spieler wählen/);
});

test('finished games retain the confirmed winner\'s seat color in both browsers', () => {
  for (const winner of ['a', 'b']) {
    const finished: RefereeView = { ...fixture(), phase: 'finished', winner, currentTurn: winner === 'a' ? 'b' : 'a' };
    const own = refereePortrait(skin, { ...finished, you: winner });
    const enemy = refereePortrait(skin, { ...finished, you: winner === 'a' ? 'b' : 'a' });
    const winnerName = winner === 'a' ? 'Anna' : 'Ben';
    const team = winner === 'a' ? 'blue' : 'red';
    const color = winner === 'a' ? 'Blau' : 'Rot';
    assert.equal(own.frame, team + '-turn');
    assert.equal(own.team, team);
    assert.equal(own.caption, `Du hast gewonnen · ${color}`);
    assert.equal(own.direction, 'bottom');
    assert.equal(own.label, `Schiedsrichter: ${winnerName} (du) hat die Partie gewonnen (${color}, unten auf dem Spielfeld).`);
    assert.equal(enemy.frame, team + '-turn');
    assert.equal(enemy.team, team);
    assert.equal(enemy.caption, `Gegner gewinnt · ${color}`);
    assert.equal(enemy.direction, 'top');
    assert.equal(enemy.label, `Schiedsrichter: ${winnerName} hat die Partie gewonnen (${color}, oben auf dem Spielfeld).`);
    assert.doesNotMatch(own.label + enemy.label, /am Zug|unentschieden/i);
  }
});

test('winner portraits point toward the winner in both browsers, regardless of the last turn', () => {
  for (const winner of ['a', 'b']) {
    for (const you of ['a', 'b']) {
      const result = refereePortrait(directionalSkin, {
        ...fixture(), phase: 'finished', you, winner, currentTurn: winner === 'a' ? 'b' : 'a',
      });
      const team = winner === 'a' ? 'blue' : 'red';
      const direction = winner === you ? 'bottom' : 'top';
      assert.equal(result.frame, `${team}-${direction}`);
      assert.equal(result.team, team);
      assert.equal(result.direction, direction);
      assert.match(result.label, /gewonnen/);
    }
  }
});

test('draws use both flags while invalid winner IDs do not claim a draw or a winner', () => {
  const draw = refereePortrait(directionalSkin, { ...fixture(), phase: 'finished', winner: null });
  assert.equal(draw.frame, 'neutral');
  assert.equal(draw.team, null);
  assert.equal(draw.direction, null);
  assert.match(draw.caption, /Unentschieden/);
  assert.match(draw.label, /unentschieden/);
  for (const view of [
    { ...fixture(), phase: 'finished' as const, winner: 'missing' },
    { ...fixture(), phase: 'finished' as const, winner: 'a', you: 'missing' },
  ]) {
    const invalid = refereePortrait(directionalSkin, view);
    assert.equal(invalid.frame, 'neutral');
    assert.equal(invalid.team, null);
    assert.equal(invalid.direction, null);
    assert.equal(invalid.caption, 'Partie beendet.');
    assert.doesNotMatch(invalid.label, /am Zug|gewonnen|unentschieden/i);
  }
});

test('pause and a freshly recovered snapshot retain the current turn without animation history', () => {
  const paused = { ...fixture(), currentTurn: 'b', paused: true };
  paused.players[1].connected = false;
  assert.equal(refereePortrait(skin, paused).frame, 'red-turn');
  assert.match(refereePortrait(skin, paused).label, /pausiert.*Ben.*Rot/);
  const otherViewer = refereePortrait(skin, { ...paused, you: 'b' });
  assert.equal(otherViewer.frame, 'red-turn');
  assert.equal(otherViewer.caption, 'Pause · dein Zug · Rot');
  assert.deepEqual(refereePortrait(skin, structuredClone(paused)), refereePortrait(skin, paused));
  assert.equal(refereePortrait(directionalSkin, paused).frame, 'red-top');
  const ownDirectional = refereePortrait(directionalSkin, { ...paused, you: 'b' });
  assert.equal(ownDirectional.frame, 'red-bottom');
  assert.equal(ownDirectional.direction, 'bottom');
  assert.match(ownDirectional.label, /pausiert.*Rot, unten/);
  assert.deepEqual(refereePortrait(directionalSkin, structuredClone(paused)), refereePortrait(directionalSkin, paused));
});

test('absolute portraits take precedence and legacy portraits retain their fixed blue and red slots', () => {
  const legacy = { ...skin, colorTurnPortraits: undefined, turnPortraits: { own: 'legacy-blue', enemy: 'legacy-red' } };
  for (const you of ['a', 'b']) {
    assert.equal(refereePortrait(legacy, { ...fixture(), you, currentTurn: 'a' }).frame, 'legacy-blue');
    assert.equal(refereePortrait(legacy, { ...fixture(), you, currentTurn: 'b' }).frame, 'legacy-red');
    const partial = { ...legacy, colorTurnPortraits: { red: 'red-turn' } };
    assert.equal(refereePortrait(partial, { ...fixture(), you, currentTurn: 'a' }).frame, 'legacy-blue');
    assert.equal(refereePortrait(partial, { ...fixture(), you, currentTurn: 'b' }).frame, 'red-turn');
  }
});

test('partial directional mappings fall back per color without borrowing the opposite flag direction', () => {
  const partial: SkinDefinition = {
    ...directionalSkin,
    directionalTurnPortraits: { blue: { top: 'blue-top' }, red: {} },
    colorTurnPortraits: { blue: 'blue-turn' },
    turnPortraits: { own: 'legacy-blue', enemy: 'legacy-red' },
  };
  assert.equal(refereePortrait(partial, { ...fixture(), you: 'b' }).frame, 'blue-top');
  const ownBlue = refereePortrait(partial, fixture());
  assert.equal(ownBlue.frame, 'blue-turn');
  assert.equal(ownBlue.direction, 'bottom');
  for (const you of ['a', 'b']) {
    assert.equal(refereePortrait(partial, { ...fixture(), you, currentTurn: 'b' }).frame, 'legacy-red');
  }
  const noColorFallback = { ...partial, colorTurnPortraits: undefined, turnPortraits: undefined };
  assert.equal(refereePortrait(noColorFallback, { ...fixture(), you: 'b' }).frame, 'blue-top');
  assert.equal(refereePortrait(noColorFallback, fixture()).frame, 'neutral');
  assert.equal(refereePortrait(noColorFallback, { ...fixture(), currentTurn: 'b' }).frame, 'neutral');
});

test('unknown turns and missing portrait variants fall back without inventing a team', () => {
  for (const view of [{ ...fixture(), currentTurn: null }, { ...fixture(), currentTurn: 'missing' }, { ...fixture(), you: 'missing' }]) {
    assert.equal(refereePortrait(directionalSkin, view).frame, 'neutral');
    assert.equal(refereePortrait(directionalSkin, view).team, null);
    assert.equal(refereePortrait(directionalSkin, view).direction, null);
  }
  assert.equal(refereePortrait({ ...skin, colorTurnPortraits: undefined }, fixture()).frame, 'neutral');
  assert.equal(refereePortrait({ ...skin, colorTurnPortraits: { red: 'red-turn' } }, fixture()).frame, 'neutral');
  assert.equal(refereePortrait(DEFAULT_SKIN, fixture()).frame, undefined);
  assert.match(refereePortrait(DEFAULT_SKIN, fixture()).label, /Anna.*Blau/);
});
