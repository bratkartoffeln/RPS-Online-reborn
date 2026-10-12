import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../shared/game';
import {
  legacyTeamForColor, otherTeamColor, teamColorForPlayer, teamColorForSeat, teamColorName,
} from './team-ui';

const players: GameView['players'] = [
  { id: 'first', name: 'Blau', seat: 0, connected: true, ready: true, restartRequested: false, newSeriesRequested: false },
  { id: 'second', name: 'Rot', seat: 1, connected: true, ready: true, restartRequested: false, newSeriesRequested: false },
];

test('public seats keep each player color fixed in both viewing perspectives and roster orders', () => {
  for (const you of ['first', 'second']) {
    for (const roster of [players, [...players].reverse()]) {
      const view = { you, players: roster };
      assert.equal(teamColorForPlayer(view, 'first'), 'blue');
      assert.equal(teamColorForPlayer(view, 'second'), 'red');
    }
  }
  assert.equal(teamColorForSeat(0), 'blue');
  assert.equal(teamColorForSeat(1), 'red');
});

test('missing preview players use an explicit fallback without deriving a color from their id', () => {
  assert.equal(teamColorForPlayer(null, 'second'), 'blue');
  assert.equal(teamColorForPlayer(null, 'first', 'red'), 'red');
  assert.equal(teamColorForPlayer({ players }, 'unknown', 'red'), 'red');
  assert.equal(teamColorForPlayer({ players }, null), 'blue');
  assert.equal(teamColorForPlayer({ players }, undefined, 'red'), 'red');
});

test('color names, opposite colors and legacy artwork slots express the same fixed identity', () => {
  assert.equal(teamColorName('blue'), 'Blau');
  assert.equal(teamColorName('red'), 'Rot');
  assert.equal(otherTeamColor('blue'), 'red');
  assert.equal(otherTeamColor('red'), 'blue');
  assert.equal(legacyTeamForColor('blue'), 'own');
  assert.equal(legacyTeamForColor('red'), 'enemy');
});
