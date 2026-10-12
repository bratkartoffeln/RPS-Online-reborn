import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addPlayer, createGame, readyPlayer, resign, setConnected, viewFor } from '../shared/game';
import { freshVictory } from './match-victory';

function started() {
  const game = createGame();
  assert.equal(addPlayer(game, 'blue', 'Blau').ok, true);
  assert.equal(addPlayer(game, 'red', 'Rot').ok, true);
  assert.equal(readyPlayer(game, 'blue').ok, true);
  assert.equal(readyPlayer(game, 'red').ok, true);
  return game;
}

test('a resignation celebrates the same winning army in both browser perspectives exactly once', () => {
  const game = started();
  const beforeBlue = viewFor(game, 'blue');
  const beforeRed = viewFor(game, 'red');
  assert.equal(resign(game, 'red').ok, true);
  const afterBlue = viewFor(game, 'blue');
  const afterRed = viewFor(game, 'red');
  assert.equal(freshVictory(beforeBlue, afterBlue), 'blue');
  assert.equal(freshVictory(beforeRed, afterRed), 'blue');
  assert.equal(freshVictory(afterBlue, viewFor(game, 'blue')), null);
  assert.equal(freshVictory(null, afterBlue), null);
});

test('a restored winner, a changed match and a draw do not launch a stale or invented celebration', () => {
  const game = started();
  const before = viewFor(game, 'blue');
  assert.equal(resign(game, 'blue').ok, true);
  const after = viewFor(game, 'blue');
  assert.equal(freshVictory(before, after), 'red');
  for (const mutate of [
    (next: typeof after) => { next.revision += 1; },
    (next: typeof after) => { next.series.matchId += '-new'; },
    (next: typeof after) => { next.series.id += '-new'; },
    (next: typeof after) => { next.you = 'red'; },
    (next: typeof after) => { next.winner = null; next.finishReason = 'turn_limit'; },
    (next: typeof after) => { next.winner = 'unknown-player'; },
    (next: typeof after) => { next.paused = true; },
  ]) {
    const changed = structuredClone(after);
    mutate(changed);
    assert.equal(freshVictory(before, changed), null);
  }
});

test('reconnection and pause snapshots cannot celebrate a completed game again', () => {
  const game = started();
  assert.equal(setConnected(game, 'red', false).ok, true);
  const paused = viewFor(game, 'blue');
  assert.equal(setConnected(game, 'red', true).ok, true);
  assert.equal(resign(game, 'red').ok, true);
  const finished = viewFor(game, 'blue');
  assert.equal(freshVictory(paused, finished), null);
  assert.equal(setConnected(game, 'red', false).ok, true);
  assert.equal(freshVictory(finished, viewFor(game, 'blue')), null);
});
