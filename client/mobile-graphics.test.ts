import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileGraphics, mobileRenderScale } from './mobile-graphics';
import { parseSkinDefinition } from './skins';
import { readFileSync } from 'node:fs';

test('mobile rendering follows the displayed board and caps density', () => {
  assert.equal(mobileRenderScale(340, 308, 3), 1);
  assert.equal(mobileRenderScale(340, 308, 1), .5);
  assert.equal(mobileRenderScale(680, 616, 3), 1);
  assert.equal(mobileRenderScale(680, 308, 1), .5);
  assert.equal(mobileGraphics(), false);
});

test('mobile atlas is a complete raster replacement; desktop SVG is preserved', () => {
  const source = JSON.parse(readFileSync('public/skins/icq-retro/skin.json', 'utf8'));
  const skin = parseSkinDefinition(source);
  assert.equal(skin.atlas?.image, 'atlas.svg');
  assert.equal(skin.mobileAtlas?.image, 'atlas-mobile.webp');
  for (const [name, frame] of Object.entries(skin.mobileAtlas!.frames)) {
    assert.ok(skin.atlas!.frames[name]);
    assert.ok(frame.x + frame.width <= 1008 && frame.y + frame.height <= 1374);
  }
  delete source.mobileAtlas.frames['blue-back-rock'];
  assert.throws(() => parseSkinDefinition(source), /alle Frames/);
});

// A new optional field must stay accepted by the strict parser on both devices.
test('mobileAtlas contract rejects invalid data and retains legacy definitions', () => {
  const source = JSON.parse(readFileSync('public/skins/icq-retro/skin.json', 'utf8'));
  const desktop = structuredClone(source.atlas);
  assert.deepEqual(JSON.parse(JSON.stringify(parseSkinDefinition(source).atlas)), desktop);
  const legacy = structuredClone(source); delete legacy.mobileAtlas;
  assert.equal(parseSkinDefinition(legacy).mobileAtlas, undefined);
  for (const image of ['../outside.webp', 'https://example.com/a.webp', 'atlas.svg']) {
    const bad = structuredClone(source); bad.mobileAtlas.image = image;
    assert.throws(() => parseSkinDefinition(bad));
  }
  const bad = structuredClone(source); bad.mobileAtlas.unrecognized = true;
  assert.throws(() => parseSkinDefinition(bad), /Unbekanntes Feld/);
});
