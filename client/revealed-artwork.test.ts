import assert from 'node:assert/strict';
import test from 'node:test';
import { artworkForPiece, artworkFrame, clipDuration } from './board-motion';
import type { PieceArtwork, SkinDefinition, SkinPiece } from './skin-types';
import { DEFAULT_SKIN, parseSkinDefinition, SkinError } from './skins';

const fighterKinds = ['rock', 'paper', 'scissors'] as const;
const rawSkin = () => ({
  version: 1, name: 'Revealed artwork',
  atlas: { image: 'atlas.png', frames: {
    base: { x: 0, y: 0, width: 64, height: 64 },
    raised: { x: 64, y: 0, width: 64, height: 64 },
    raised2: { x: 128, y: 0, width: 64, height: 64 },
  } },
});

test('revealed artwork parses its own resting frame and independently validated animation clips', () => {
  const revealed = { frame: 'raised', animations: { attack: { frames: ['raised', 'raised2'], fps: 12 } } };
  const parsed = parseSkinDefinition({ ...rawSkin(), pieces: { own: { rock: { frame: 'base', revealed } } } });
  assert.deepEqual(parsed.pieces?.own?.rock?.revealed, revealed);
  assert.equal(parsed.pieces?.own?.rock?.frame, 'base');
  assert.equal(parsed.pieces?.own?.rock?.animations, undefined);
  const staticVariant = parseSkinDefinition({ ...rawSkin(), pieces: { own: { paper: { frame: 'base', revealed: { frame: 'raised' } } } } });
  assert.deepEqual(staticVariant.pieces?.own?.paper?.revealed, { frame: 'raised' });
});

test('revealed variants reject nested variants, invalid objects, missing frames and unsafe clips', () => {
  for (const revealed of [
    null, [], 'raised', {}, { frame: 'missing' }, { frame: 'raised', extra: true },
    { frame: 'raised', revealed: { frame: 'base' } },
    { frame: 'raised', animations: { surprise: { frames: ['raised'], fps: 12 } } },
    { frame: 'raised', animations: { idle: { frames: ['missing'], fps: 12 } } },
    { frame: 'raised', animations: { idle: { frames: [], fps: 12 } } },
    { frame: 'raised', animations: { idle: { frames: Array(65).fill('raised'), fps: 12 } } },
    { frame: 'raised', animations: { idle: { frames: ['raised'], fps: 31 } } },
    { frame: 'raised', animations: { idle: { frames: ['raised'], fps: 0 } } },
    { frame: 'raised', animations: { idle: { frames: ['raised'], fps: Number.NaN } } },
  ]) {
    assert.throws(() => parseSkinDefinition({ ...rawSkin(), pieces: { own: { rock: { frame: 'base', revealed } } } }), SkinError);
  }
});

test('known own weapons stay concealed until public reveal and return to base after a new setup', () => {
  const own: Partial<Record<SkinPiece, PieceArtwork>> = {};
  const skin: SkinDefinition = { ...DEFAULT_SKIN, pieces: { own } };
  for (const kind of fighterKinds) own[kind] = { frame: `own-${kind}`, revealed: { frame: `own-${kind}-revealed` } };
  for (const kind of fighterKinds) {
    assert.equal(artworkForPiece(skin, true, kind)?.frame, `own-${kind}`);
    assert.equal(artworkForPiece(skin, true, kind, false)?.frame, `own-${kind}`);
    assert.equal(artworkForPiece(skin, true, kind, true)?.frame, `own-${kind}-revealed`);
    // Resolving a recovered snapshot does not require a previous reveal event.
    assert.equal(artworkForPiece(structuredClone(skin), true, kind, true)?.frame, `own-${kind}-revealed`);
    assert.equal(artworkForPiece(skin, true, kind, false)?.frame, `own-${kind}`);
  }
});

test('missing variants preserve old skins and neither unknown nor null can select revealed artwork', () => {
  const base: PieceArtwork = { frame: 'own-rock', animations: { idle: { frames: ['base-idle'], fps: 8 } } };
  const unknown: PieceArtwork = { frame: 'unknown', revealed: { frame: 'must-not-be-used' } };
  const enemy: PieceArtwork = { frame: 'enemy-rock', revealed: { frame: 'enemy-rock-revealed' } };
  const skin: SkinDefinition = { ...DEFAULT_SKIN, pieces: { own: { rock: base, unknown }, enemy: { rock: enemy, unknown } } };
  assert.equal(artworkForPiece(skin, true, 'rock', true), base);
  assert.equal(artworkForPiece(skin, false, 'rock', true), enemy.revealed);
  assert.equal(artworkForPiece(skin, true, 'paper', true), undefined);
  for (const own of [false, true]) {
    for (const kind of [null, 'unknown'] as const) {
      assert.equal(artworkForPiece(skin, own, kind, true), unknown);
      assert.equal(artworkForPiece({ ...skin, pieces: { own: { rock: base }, enemy: { rock: enemy } } }, own, kind, true), undefined);
    }
  }
});

test('revealed clips replace concealed clips and reduced motion retains the revealed resting pose', () => {
  const artwork: PieceArtwork = {
    frame: 'concealed',
    animations: { idle: { frames: ['concealed-idle'], fps: 10 }, attack: { frames: ['concealed-attack'], fps: 10 } },
    revealed: { frame: 'raised', animations: { idle: { frames: ['raised-idle'], fps: 10 }, attack: { frames: ['raised-attack-1', 'raised-attack-2'], fps: 10 } } },
  };
  const skin: SkinDefinition = { ...DEFAULT_SKIN, pieces: { own: { rock: artwork } } };
  const selected = artworkForPiece(skin, true, 'rock', true)!;
  assert.equal(artworkFrame(selected, 'attack', 120, true), 'raised-attack-2');
  assert.equal(clipDuration(selected, 'attack'), 200);
  assert.equal(artworkFrame(selected, 'selected', 120, true), 'raised-idle');
  for (const state of ['idle', 'selected', 'move', 'duel', 'attack', 'win', 'lose'] as const) {
    assert.equal(artworkFrame(selected, state, 400, false), 'raised');
  }
  artwork.revealed = { frame: 'raised-static' };
  const staticVariant = artworkForPiece(skin, true, 'rock', true)!;
  assert.equal(artworkFrame(staticVariant, 'idle', 100, true), 'raised-static');
  assert.equal(artworkFrame(staticVariant, 'attack', 100, true), 'raised-static');
  assert.equal(clipDuration(staticVariant, 'attack'), 0);
});
