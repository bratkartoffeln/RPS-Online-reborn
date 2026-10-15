import assert from 'node:assert/strict';
import test from 'node:test';
import { addPlayer, createGame, readyPlayer, viewFor } from '../shared/game';
import { freshMatchStart, gongMarkup } from './gong-ui';
import { builtInSkin, parseSkinDefinition } from './skins';
import { refereePortrait } from './referee-ui';
import { readFileSync } from 'node:fs';

function start() {
  const game = createGame();
  addPlayer(game, 'a', 'Ada'); addPlayer(game, 'b', 'Ben');
  readyPlayer(game, 'a');
  const before = viewFor(game, 'a');
  readyPlayer(game, 'b');
  return { before, after: viewFor(game, 'a') };
}

test('gong plays only after a live second ready confirmation in the same game', () => {
  const { before, after } = start();
  assert.equal(freshMatchStart(before, after), true);
  assert.equal(freshMatchStart({ ...before, you: 'b' }, { ...after, you: 'b' }), true);
  assert.equal(freshMatchStart(null, after), false);
  assert.equal(freshMatchStart(after, after), false);
  assert.equal(freshMatchStart(before, { ...after, revision: after.revision + 1 }), false);
  assert.equal(freshMatchStart({ ...before, paused: true }, after), false);
  assert.equal(freshMatchStart(before, { ...after, paused: true }), false);
  assert.equal(freshMatchStart(before, { ...after, series: { ...after.series, matchId: 'other' } }), false);
  assert.equal(freshMatchStart(before, { ...after, players: after.players.map(p => ({ ...p, connected: false })) }), false);
  assert.equal(freshMatchStart(before, { ...after, players: after.players.map(p => ({ ...p, ready: false })) }), false);
});

test('every pack has its own static or single-strike gong artwork', () => {
  for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    const skin = { ...builtInSkin(), id, definition: parseSkinDefinition(JSON.parse(readFileSync(`public/skins/${id}/skin.json`, 'utf8'))) };
    assert.ok(gongMarkup(skin, 76).includes(`data-gong-style="${id}" data-animated="false"`));
    assert.ok(gongMarkup(skin, 180, true).includes('data-animated="true"'));
    assert.ok(gongMarkup(skin, 180, true, 5).includes(`/skins/${id}/gong/strike.svg?play=5`));
    const svg = readFileSync(`public/skins/${id}/${skin.definition.artwork!.gong!.strike}`, 'utf8');
    assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /@keyframes gong-strike/);
    assert.doesNotMatch(svg, /<script|(?:href|src)="https?:/);
    if (id.startsWith('icq')) assert.match(svg, /href="data:image\/png;base64,/);
    else assert.doesNotMatch(svg, /<image/);
  }
});

test('Classic and Arcade turn indicators share the ICQ seat and orientation logic', () => {
  const { after } = start();
  for (const id of ['classic', 'arcade']) {
    const skin = parseSkinDefinition(JSON.parse(readFileSync(`public/skins/${id}/skin.json`, 'utf8')));
    for (const you of ['a', 'b']) for (const currentTurn of ['a', 'b']) {
      const portrait = refereePortrait(skin, { ...after, you, currentTurn });
      const team = currentTurn === 'a' ? 'blue' : 'red';
      const direction = currentTurn === you ? 'bottom' : 'top';
      assert.equal(portrait.frame, `referee-${team}-${direction}`);
      assert.ok(skin.atlas?.frames[portrait.frame!]);
    }
    assert.equal(refereePortrait(skin, { ...after, phase: 'duel' }).frame, 'referee-neutral');
  }
});

test('resting and strike gong frames exist in all desktop and mobile atlases', () => {
  for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    const skin = parseSkinDefinition(JSON.parse(readFileSync(`public/skins/${id}/skin.json`, 'utf8')));
    for (const pose of ['idle', 'strike']) {
      const frame = skin.atlas!.frames[`gong-${pose}`];
      assert.ok(frame, `${id}: ${pose}`);
      assert.equal(frame.width / frame.height, 4 / 3);
      if (skin.mobileAtlas) assert.ok(skin.mobileAtlas.frames[`gong-${pose}`], `${id}: mobile ${pose}`);
    }
  }
});
