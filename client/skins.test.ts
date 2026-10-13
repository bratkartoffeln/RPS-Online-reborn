import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import {
  builtInSkin, DEFAULT_SKIN, loadSkin, loadSkinCatalog, parseSkinCatalog,
  parseSkinDefinition, SKIN_LIMITS, SkinError, validateAtlasDimensions,
} from './skins';
import type { SkinEntry } from './skin-types';

const entry: SkinEntry = { id: 'example', name: 'Beispiel', file: 'example/skin.json' };
const minimal = () => ({ version: 1, name: 'Beispiel' });
const artwork = () => ({
  ...minimal(),
  atlas: { image: 'atlas.png', frames: {
    base: { x: 0, y: 0, width: 64, height: 64 },
    pulse: { x: 64, y: 0, width: 64, height: 64 },
  } },
});
const vectorArtwork = () => ({
  ...artwork(),
  atlas: { ...artwork().atlas, image: 'atlas.svg', fallbackImage: 'atlas.png' },
});
const weaponArtwork = () => ({
  ...artwork(),
  weapons: { rock: 'base', paper: 'pulse' },
  weaponAtlas: { image: 'weapon-atlas.svg', frames: {
    base: { x: 0, y: 0, width: 64, height: 64 },
    pulse: { x: 64, y: 0, width: 64, height: 64 },
  } },
});
const catalog = () => ({ version: 1, default: 'example', skins: [entry] });

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

type ImageOutcome = { width?: number; height?: number; fails?: boolean; decodeFails?: boolean };
function mockImages(t: TestContext, width = 128, height = 64, outcome: boolean | ((url: string) => boolean | ImageOutcome) = false): string[] {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const urls: string[] = [];
  class FakeImage {
    naturalWidth = width;
    naturalHeight = height;
    decodeFails = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(url: string) {
      urls.push(url);
      const result = typeof outcome === 'function' ? outcome(url) : outcome;
      const behavior: ImageOutcome = typeof result === 'boolean' ? { fails: result } : result;
      this.naturalWidth = behavior.width ?? width;
      this.naturalHeight = behavior.height ?? height;
      this.decodeFails = behavior.decodeFails ?? false;
      queueMicrotask(() => { (behavior.fails ? this.onerror : this.onload)?.(); });
    }
    decode(): Promise<void> { return this.decodeFails ? Promise.reject(new Error('Decode failed')) : Promise.resolve(); }
    removeAttribute(): void { /* A cleared source must not trigger a second event. */ }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, writable: true, value: FakeImage });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'Image', descriptor);
    else Reflect.deleteProperty(globalThis, 'Image');
  });
  return urls;
}

test('partial palettes and motion merge defaults without sharing mutable state', () => {
  const parsed = parseSkinDefinition({ ...minimal(), palette: { ui: { accent: '#123AbC' } }, motion: { moveMs: 0 } });
  assert.equal(parsed.palette.ui.accent, '#123AbC');
  assert.equal(parsed.palette.ui.text, DEFAULT_SKIN.palette.ui.text);
  assert.deepEqual(parsed.palette.board, DEFAULT_SKIN.palette.board);
  assert.deepEqual(parsed.motion, { moveMs: 0, battleMs: 900 });
  parsed.palette.board.light = '#000000';
  const builtIn = builtInSkin();
  builtIn.definition.palette.ui.accent = '#000000';
  assert.equal(DEFAULT_SKIN.palette.ui.accent, '#c5f277');
  assert.equal(DEFAULT_SKIN.palette.board.light, '#29363e');
  assert.equal(builtInSkin().id, 'classic');
  assert.equal(builtInSkin().image, null);
  assert.equal(builtInSkin().imageUrl, null);
});

test('omitted artwork remains valid and allows vector fallback per team and piece', () => {
  const vector = parseSkinDefinition(minimal());
  assert.equal(vector.atlas, undefined);
  assert.equal(vector.pieces, undefined);
  const partial = parseSkinDefinition({ ...artwork(), pieces: { own: { rock: { frame: 'base' } } } });
  assert.equal(partial.pieces?.own?.rock?.frame, 'base');
  assert.equal(partial.pieces?.own?.paper, undefined);
  assert.equal(partial.pieces?.enemy, undefined);
});

test('retro presentation and a static referee are opt-in and validated', () => {
  assert.equal(parseSkinDefinition(minimal()).presentation, 'modern');
  const retro = parseSkinDefinition({ ...artwork(), presentation: 'retro', portrait: 'base' });
  assert.equal(retro.presentation, 'retro');
  assert.equal(retro.portrait, 'base');
  assert.throws(() => parseSkinDefinition({ ...minimal(), presentation: 'other' }), /presentation/);
  assert.throws(() => parseSkinDefinition({ ...artwork(), portrait: 'missing' }), /fehlenden Atlas-Frame/);
});

test('chat notice artwork must reference an existing atlas frame', () => {
  assert.equal(parseSkinDefinition({ ...artwork(), chatNotice: 'base' }).chatNotice, 'base');
  assert.throws(() => parseSkinDefinition({ ...artwork(), chatNotice: 'missing' }), /fehlenden Atlas-Frame/);
  assert.equal(parseSkinDefinition(minimal()).chatNotice, undefined);
});

test('every bundled style has chat artwork, including the mobile frame', () => {
  for (const id of ['classic', 'arcade', 'icq-retro']) {
    const skin = parseSkinDefinition(JSON.parse(readFileSync(new URL(`../public/skins/${id}/skin.json`, import.meta.url), 'utf8')));
    assert.ok(skin.chatNotice, id);
    assert.ok(skin.atlas?.frames[skin.chatNotice!], id);
    if (skin.mobileAtlas) assert.ok(skin.mobileAtlas.frames[skin.chatNotice!], id + ' mobile');
  }
});

test('absolute team colors support independent viewing directions and revealed artwork', () => {
  const blueBack = { frame: 'base', revealed: { frame: 'pulse', animations: { win: { frames: ['pulse', 'base'], fps: 4 } } } };
  const blueFront = { frame: 'pulse' };
  const redBack = { frame: 'pulse', animations: { idle: { frames: ['pulse', 'base'], fps: 3 } } };
  const input = {
    ...artwork(),
    pieces: { own: { rock: { frame: 'base' } }, enemy: { unknown: { frame: 'pulse' } } },
    teamPieces: { blue: { own: { rock: blueBack }, enemy: { rock: blueFront } }, red: { own: { rock: redBack } } },
    colorTurnPortraits: { blue: 'base', red: 'pulse' },
    turnPortraits: { own: 'base', enemy: 'pulse' },
  };
  const parsed = parseSkinDefinition(input);
  assert.equal(parsed.teamPieces?.red?.enemy, undefined, 'Partial packs can omit a direction or piece.');
  assert.deepEqual(parsed.teamPieces, input.teamPieces);
  assert.deepEqual(parsed.colorTurnPortraits, input.colorTurnPortraits);
  assert.deepEqual(parsed.pieces, input.pieces, 'Existing legacy artwork remains available per color.');
  assert.deepEqual(parsed.turnPortraits, input.turnPortraits);
  const empty = parseSkinDefinition({ ...minimal(), teamPieces: {}, colorTurnPortraits: {} });
  assert.deepEqual(empty.teamPieces, {});
  assert.deepEqual(empty.colorTurnPortraits, {});
  assert.equal(parseSkinDefinition(minimal()).teamPieces, undefined);
});

test('team artwork and color portraits strictly validate colors, directions and every frame reference', () => {
  for (const teamPieces of [
    { orange: {} }, { blue: { back: {} } }, { red: { own: { knight: { frame: 'base' } } } },
    { blue: { own: { rock: { frame: 'missing' } } } },
    { blue: { enemy: { unknown: { frame: 'base', animations: { idle: { frames: ['missing'], fps: 2 } } } } } },
    { red: { own: { rock: { frame: 'base', revealed: { frame: 'missing' } } } } },
    { red: { own: { rock: { frame: 'base', revealed: { frame: 'pulse', revealed: { frame: 'base' } } } } } },
    { red: { enemy: { paper: { frame: 'base', revealed: { frame: 'pulse', animations: { win: { frames: ['missing'], fps: 4 } } } } } } },
    { blue: { own: { scissors: { frame: 'base', animations: { idle: { frames: ['base'], fps: 31 } } } } } },
    { blue: [] }, [], null,
  ]) assert.throws(() => parseSkinDefinition({ ...artwork(), teamPieces }), SkinError);
  assert.throws(() => parseSkinDefinition({ ...minimal(), teamPieces: { blue: { own: { rock: { frame: 'base' } } } } }), /fehlenden Atlas-Frame/);
  for (const colorTurnPortraits of [{ own: 'base' }, { orange: 'base' }, { blue: 'missing' }, [], null]) {
    assert.throws(() => parseSkinDefinition({ ...artwork(), colorTurnPortraits }), SkinError);
  }
  assert.throws(() => parseSkinDefinition({ ...minimal(), colorTurnPortraits: { blue: 'base' } }), /fehlenden Atlas-Frame/);
  for (const turnPortraits of [{ blue: 'base' }, { enemy: 'missing' }]) {
    assert.throws(() => parseSkinDefinition({ ...artwork(), turnPortraits }), SkinError);
  }
});

test('directional referee portraits accept optional and partial top/bottom mappings for absolute colors', () => {
  const directionalTurnPortraits = { blue: { top: 'base', bottom: 'pulse' }, red: { bottom: 'base' } };
  const parsed = parseSkinDefinition({ ...artwork(), directionalTurnPortraits });
  assert.equal(parsed.directionalTurnPortraits?.red?.top, undefined);
  assert.deepEqual(parsed.directionalTurnPortraits, directionalTurnPortraits);
  assert.notEqual(parsed.directionalTurnPortraits?.blue, directionalTurnPortraits.blue, 'The parser owns its normalized mapping.');
  assert.deepEqual(parseSkinDefinition({ ...minimal(), directionalTurnPortraits: {} }).directionalTurnPortraits, {});
  assert.deepEqual(parseSkinDefinition({ ...minimal(), directionalTurnPortraits: { blue: {} } }).directionalTurnPortraits, { blue: {} });
  assert.equal(parseSkinDefinition(minimal()).directionalTurnPortraits, undefined, 'Existing packs need no new property.');
});

test('directional referee portraits reject unknown colors, directions and invalid atlas references', () => {
  for (const directionalTurnPortraits of [
    null, [], 'base', { orange: {} }, { own: { top: 'base' } },
    { blue: null }, { blue: [] }, { blue: 'base' },
    { blue: { up: 'base' } }, { red: { own: 'base' } },
    { blue: { top: 'missing' } }, { red: { bottom: 'missing' } },
    { blue: { top: null } }, { red: { bottom: { frame: 'base' } } },
  ]) assert.throws(() => parseSkinDefinition({ ...artwork(), directionalTurnPortraits }), SkinError);
  assert.throws(() => parseSkinDefinition({ ...minimal(), directionalTurnPortraits: { blue: { top: 'base' } } }), /fehlenden Atlas-Frame/);
});

test('catalog preserves selectable classic fallback and rejects ambiguous or escaping entries', () => {
  const parsed = parseSkinCatalog(catalog());
  assert.equal(parsed.default, 'example');
  assert.deepEqual(parsed.skins.map((skin) => skin.id), ['classic', 'example']);
  assert.throws(() => parseSkinCatalog({ ...catalog(), skins: [entry, entry] }), /einmal/);
  assert.throws(() => parseSkinCatalog({ ...catalog(), default: 'missing' }), /fehlt/);
  assert.throws(() => parseSkinCatalog({ ...catalog(), skins: [] }), SkinError);
  assert.throws(() => parseSkinCatalog({ ...catalog(), version: 2 }), /version/);
  for (const file of ['../skin.json', '/example/skin.json', 'other/skin.json', 'https://host/skin.json', 'example%2fskin.json']) {
    assert.throws(() => parseSkinCatalog({ ...catalog(), skins: [{ ...entry, file }] }), SkinError, file);
  }
  for (const id of ['../x', 'UPPER', 'bad id', '__proto__', 'constructor', 'a'.repeat(49)]) {
    assert.throws(() => parseSkinCatalog({ ...catalog(), skins: [{ ...entry, id, file: `${id}/skin.json` }] }), SkinError, id);
  }
});

test('configuration rejects unsupported fields, unsafe colors, invalid names and nonobjects', () => {
  for (const value of [null, [], 'skin', { ...minimal(), version: 2 }, { ...minimal(), unknown: true },
    { ...minimal(), palette: { css: {} } }, { ...minimal(), palette: { ui: { notAColor: '#123456' } } },
    { ...minimal(), name: '' }, { ...minimal(), name: 'x'.repeat(49) }, { ...minimal(), name: 'bad\nname' }]) {
    assert.throws(() => parseSkinDefinition(value), SkinError);
  }
  for (const accent of ['red', '#fff', '#12345678', '#12345Z', 'url(https://bad)', '#123456;display:none', null]) {
    assert.throws(() => parseSkinDefinition({ ...minimal(), palette: { ui: { accent } } }), /#RRGGBB/);
  }
});

test('atlas image paths stay local inside the selected pack and permit vector and raster images', () => {
  for (const image of ['sprites/atlas.webp', 'atlas.jpg', 'nested/atlas.JPEG', 'atlas.png', 'atlas.svg', 'sprites/atlas.SVG']) {
    assert.equal(parseSkinDefinition({ ...artwork(), atlas: { ...artwork().atlas, image } }).atlas?.image, image);
  }
  for (const image of ['../atlas.png', 'a/../../atlas.png', '/atlas.png', '//host/a.png', 'https://host/a.png',
    'data:image/png;base64,A', 'a\\atlas.png', 'a/%2e%2e/atlas.png', 'a//atlas.png', './atlas.png',
    'atlas.png?x=1', 'atlas.png#fragment', 'atlas.svg#frame', 'atlas.gif', 'bad name.png']) {
    assert.throws(() => parseSkinDefinition({ ...artwork(), atlas: { ...artwork().atlas, image } }), /relative/, image);
  }
});

test('atlas fallback images must be distinct local raster files', () => {
  for (const fallbackImage of ['atlas.png', 'backup/atlas.webp', 'backup.JPG']) {
    const parsed = parseSkinDefinition({ ...vectorArtwork(), atlas: { ...vectorArtwork().atlas, fallbackImage } });
    assert.equal(parsed.atlas?.fallbackImage, fallbackImage);
  }
  for (const fallbackImage of ['atlas.svg', '../atlas.png', '/atlas.png', 'https://host/atlas.png',
    'data:image/png;base64,A', 'atlas.png?cache=1', 'bad.gif', 'a\\atlas.png']) {
    assert.throws(() => parseSkinDefinition({ ...vectorArtwork(), atlas: { ...vectorArtwork().atlas, fallbackImage } }), /fallbackImage.*relative/);
  }
  assert.throws(() => parseSkinDefinition({ ...artwork(), atlas: { ...artwork().atlas, fallbackImage: 'atlas.png' } }), /andere Datei/);
  assert.equal(parseSkinDefinition(artwork()).atlas?.fallbackImage, undefined, 'Existing raster packs need no fallback configuration.');
});

test('atlas rectangles reject invalid values and every rectangle must fit the decoded image', () => {
  for (const rect of [
    { x: -1, y: 0, width: 64, height: 64 }, { x: 0.5, y: 0, width: 64, height: 64 },
    { x: 0, y: 0, width: 0, height: 64 }, { x: 0, y: 0, width: Infinity, height: 64 },
    { x: 4090, y: 0, width: 64, height: 64 }, { x: 0, y: 4095, width: 1, height: 2 },
  ]) {
    assert.throws(() => parseSkinDefinition({ ...artwork(), atlas: { image: 'atlas.png', frames: { base: rect } } }), SkinError);
  }
  const parsed = parseSkinDefinition(artwork());
  assert.doesNotThrow(() => validateAtlasDimensions(parsed, 128, 64));
  assert.throws(() => validateAtlasDimensions(parsed, 100, 64), /pulse.*außerhalb/); // Even an unused frame.
  for (const [width, height] of [[0, 64], [4097, 64], [128, 4097], [128, 0], [1.5, 64]]) {
    assert.throws(() => validateAtlasDimensions(parsed, width, height), SkinError);
  }
});

test('standalone weapon artwork requires existing main-atlas frames and leaves missing weapons optional', () => {
  const parsed = parseSkinDefinition({ ...artwork(), weapons: { rock: 'base' } });
  assert.equal(parsed.weapons?.rock, 'base');
  assert.equal(parsed.weapons?.paper, undefined);
  assert.equal(parsed.weaponAtlas, undefined);
  for (const value of [
    { ...minimal(), weapons: { rock: 'base' } },
    { ...artwork(), weapons: { rock: 'missing' } },
    { ...artwork(), weapons: { flag: 'base' } },
    { ...artwork(), weapons: ['base'] },
  ]) assert.throws(() => parseSkinDefinition(value), SkinError);
});

test('optional weapon atlases accept local SVG and raster paths but only declared weapon frames', () => {
  for (const image of ['weapon-atlas.svg', 'weapons/atlas.SVG', 'weapons/atlas.png', 'weapons.webp', 'weapons.jpg', 'weapons.JPEG']) {
    const parsed = parseSkinDefinition({ ...weaponArtwork(), weaponAtlas: { ...weaponArtwork().weaponAtlas, image } });
    assert.equal(parsed.weaponAtlas?.image, image);
  }
  for (const image of ['../weapons.svg', '/weapons.svg', 'https://host/weapons.svg', 'data:image/svg+xml,<svg/>',
    'weapons.svg#rock', 'weapons.svg?x=1', 'a/%2e%2e/weapons.svg', 'a\\weapons.svg', 'weapons.gif']) {
    assert.throws(() => parseSkinDefinition({ ...weaponArtwork(), weaponAtlas: { ...weaponArtwork().weaponAtlas, image } }), /relative/, image);
  }
  assert.throws(() => parseSkinDefinition({ ...weaponArtwork(), weapons: { rock: 'base' } }), /pulse.*weapons/);
  assert.throws(() => parseSkinDefinition({ ...weaponArtwork(), weapons: undefined }), /weapons/);
  const partial = parseSkinDefinition({ ...weaponArtwork(), weaponAtlas: {
    image: 'weapon-atlas.svg', frames: { base: weaponArtwork().weaponAtlas.frames.base },
  } });
  assert.equal(partial.weapons?.paper, 'pulse');
  assert.equal(partial.weaponAtlas?.frames.pulse, undefined, 'Unlisted weapons retain the main-atlas fallback.');
  assert.throws(() => parseSkinDefinition({ ...weaponArtwork(), weaponAtlas: {
    image: 'weapon-atlas.svg', frames: { base: { x: 4090, y: 0, width: 64, height: 64 } },
  } }), /maximalen Atlasmaße/);
});

test('all frame references and reserved texture names are checked', () => {
  for (const value of [
    { ...minimal(), logo: 'base' }, { ...artwork(), logo: 'missing' },
    { ...artwork(), board: { light: 'missing' } },
    { ...artwork(), pieces: { own: { rock: { frame: 'missing' } } } },
    { ...artwork(), pieces: { enemy: { unknown: { frame: 'base', animations: { idle: { frames: ['missing'], fps: 2 } } } } } },
    { ...artwork(), pieces: { spectator: {} } },
  ]) assert.throws(() => parseSkinDefinition(value), SkinError);
  for (const name of ['__BASE', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'bad/frame', 'a'.repeat(65)]) {
    const frames = { [name]: { x: 0, y: 0, width: 1, height: 1 } };
    assert.throws(() => parseSkinDefinition({ ...artwork(), atlas: { image: 'atlas.png', frames } }), /Frame-Name/);
  }
  const tooMany = Object.fromEntries(Array.from({ length: SKIN_LIMITS.atlasFrames + 1 }, (_, index) => [`f${index}`, { x: 0, y: 0, width: 1, height: 1 }]));
  assert.throws(() => parseSkinDefinition({ ...artwork(), atlas: { image: 'atlas.png', frames: tooMany } }), /512/);
});

test('animation validation supports battle states with bounded clips, speed and motion', () => {
  const states = ['idle', 'selected', 'move', 'duel', 'attack', 'win', 'lose'];
  const animations = Object.fromEntries(states.map((state) => [state, { frames: ['base', 'pulse'], fps: 12 }]));
  const parsed = parseSkinDefinition({ ...artwork(), pieces: { own: { rock: { frame: 'base', animations } } } });
  assert.equal(Object.keys(parsed.pieces!.own!.rock!.animations!).length, 7);
  for (const clip of [{ frames: [], fps: 2 }, { frames: ['base'], fps: 0 }, { frames: ['base'], fps: 31 },
    { frames: Array(65).fill('base'), fps: 2 }, { frames: ['base'], fps: Number.NaN }]) {
    assert.throws(() => parseSkinDefinition({ ...artwork(), pieces: { own: { rock: { frame: 'base', animations: { attack: clip } } } } }), SkinError);
  }
  for (const motion of [{ moveMs: -1 }, { moveMs: 1001 }, { battleMs: 0 }, { battleMs: 99 }, { battleMs: 2001 }]) {
    assert.throws(() => parseSkinDefinition({ ...minimal(), motion }), SkinError);
  }
  assert.deepEqual(parseSkinDefinition({ ...minimal(), motion: { moveMs: 1000, battleMs: 2000 } }).motion, { moveMs: 1000, battleMs: 2000 });
});

test('bundled retro, classic and Arcade packs resolve to existing, correctly bounded assets', () => {
  const root = new URL('../public/skins/', import.meta.url);
  const index = parseSkinCatalog(JSON.parse(readFileSync(new URL('index.json', root), 'utf8')));
  assert.equal(index.default, 'icq-retro');
  assert.deepEqual(index.skins.map((skin) => skin.id), ['icq-retro', 'classic', 'arcade']);
  const retro = parseSkinDefinition(JSON.parse(readFileSync(new URL('icq-retro/skin.json', root), 'utf8')));
  assert.equal(retro.atlas?.image, 'atlas.svg');
  assert.equal(retro.atlas?.fallbackImage, 'atlas.png');
  const retroPng = readFileSync(new URL(`icq-retro/${retro.atlas!.fallbackImage}`, root));
  assert.deepEqual(retroPng.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(retroPng[25], 6, 'The generated PNG keeps RGBA transparency.');
  const retroWidth = retroPng.readUInt32BE(16), retroHeight = retroPng.readUInt32BE(20);
  validateAtlasDimensions(retro, retroWidth, retroHeight);
  assert.equal(retro.presentation, 'retro');
  assert.ok(retro.board?.light && retro.board.dark && retro.logo && retro.portrait);
  assert.ok(retro.colorTurnPortraits?.blue && retro.colorTurnPortraits.red);
  assert.notEqual(retro.colorTurnPortraits.blue, retro.colorTurnPortraits.red);
  assert.notEqual(retro.colorTurnPortraits.blue, retro.portrait);
  assert.notEqual(retro.colorTurnPortraits.red, retro.portrait);
  assert.equal(Object.keys(retro.atlas!.frames).length, 44);
  assert.deepEqual(retro.flagVictoryFrames, { blue: 'blue-front-flag-victory', red: 'red-front-flag-victory' });
  assert.deepEqual(retro.directionalTurnPortraits, {
    blue: { top: 'referee-blue-top', bottom: 'referee-blue-turn' },
    red: { top: 'referee-red-turn', bottom: 'referee-red-bottom' },
  });
  const directionalReferees = Object.values(retro.directionalTurnPortraits).flatMap((directions) => Object.values(directions));
  assert.equal(new Set(directionalReferees).size, 4, 'Each team color has its own upward and downward flag pose.');
  for (const frameName of directionalReferees) {
    assert.notEqual(frameName, retro.portrait);
    assert.equal(retro.atlas!.frames[frameName].width, 272, 'All referee poses share the same presentation width.');
    assert.equal(retro.atlas!.frames[frameName].height, 204, 'All referee poses share the same presentation height.');
  }
  for (const kind of ['rock', 'paper', 'scissors'] as const) {
    assert.equal(retro.weapons?.[kind], `weapon-${kind}`);
    for (const color of ['blue', 'red'] as const) {
      const piece = retro.teamPieces?.[color]?.own?.[kind];
      assert.ok(piece?.revealed?.frame, `${color}/${kind} has a revealed rear pose.`);
      assert.notEqual(piece.revealed.frame, piece.frame);
      assert.equal(piece.revealed.animations, undefined, 'Revealed poses remain static.');
      for (const perspective of ['own', 'enemy'] as const) {
        assert.notEqual(retro.weapons?.[kind], retro.teamPieces?.[color]?.[perspective]?.[kind]?.frame,
          'Rules and choices have standalone weapon artwork.');
      }
    }
  }
  assert.equal(retro.weaponAtlas, undefined, 'All retro artwork now shares the main vector atlas.');
  const retroSvg = readFileSync(new URL(`icq-retro/${retro.atlas!.image}`, root), 'utf8');
  const svgRoot = retroSvg.match(/<svg\b[^>]*>/i)?.[0];
  assert.ok(svgRoot, 'The preferred atlas is an SVG document.');
  const svgWidth = Number(svgRoot.match(/\bwidth=["']([0-9.]+)["']/)?.[1]);
  const svgHeight = Number(svgRoot.match(/\bheight=["']([0-9.]+)["']/)?.[1]);
  assert.deepEqual([svgWidth, svgHeight], [retroWidth, retroHeight], 'SVG and PNG share dimensions and frame coordinates.');
  assert.doesNotMatch(retroSvg, /<script\b|<image\b|<foreignObject\b|(?:href|xlink:href)=["'](?!#)/i,
    'The entire atlas consists of vector shapes with no embedded raster or remote dependencies.');
  for (const color of ['blue', 'red'] as const) {
    for (const perspective of ['own', 'enemy'] as const) {
      for (const kind of ['rock', 'paper', 'scissors', 'flag', 'trap', 'unknown'] as const) {
        const piece = retro.teamPieces?.[color]?.[perspective]?.[kind];
        assert.ok(piece?.frame, `${color}/${perspective}/${kind} has artwork.`);
        assert.equal(piece.animations, undefined, 'No new animation clips in this release.');
        assert.notEqual(piece.frame, retro.teamPieces?.[color === 'blue' ? 'red' : 'blue']?.[perspective]?.[kind]?.frame,
          'Each team retains its atlas slots, including the shared yellow trap artwork.');
        assert.notEqual(piece.frame, retro.teamPieces?.[color]?.[perspective === 'own' ? 'enemy' : 'own']?.[kind]?.frame,
          'The viewer gets the correct front or rear view without swapping color.');
      }
    }
  }
  const classic = parseSkinDefinition(JSON.parse(readFileSync(new URL('classic/skin.json', root), 'utf8')));
  assert.deepEqual(classic.palette, DEFAULT_SKIN.palette);
  assert.equal(classic.atlas?.image, 'atlas.svg');
  validateAtlasDimensions(classic, 96, 96);
  assert.equal(classic.pieces, undefined, 'Classic pieces retain the built-in vector artwork.');
  const arcade = parseSkinDefinition(JSON.parse(readFileSync(new URL('arcade/skin.json', root), 'utf8')));
  assert.equal(arcade.atlas?.image, 'master.svg');
  assert.equal(arcade.atlas?.fallbackImage, 'atlas.png');
  const png = readFileSync(new URL(`arcade/${arcade.atlas!.fallbackImage}`, root));
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.deepEqual([width, height], [1152, 1248]);
  validateAtlasDimensions(arcade, width, height);
  assert.equal(Object.keys(arcade.atlas!.frames).length, 148);
  assert.ok(arcade.board?.light && arcade.board.dark && arcade.logo);
  for (const team of ['own', 'enemy'] as const) {
    for (const kind of ['rock', 'paper', 'scissors', 'flag', 'trap', 'unknown'] as const) {
      const piece = arcade.pieces?.[team]?.[kind];
      assert.ok(piece?.frame, `${team}/${kind}`);
      assert.deepEqual(Object.keys(piece!.animations!).sort(), ['attack', 'duel', 'idle', 'lose', 'move', 'selected', 'win']);
    }
  }
  const svg = readFileSync(new URL(`arcade/${arcade.atlas!.image}`, root), 'utf8');
  assert.match(svg, /width="1152" height="1248"/);
  assert.match(svg, /id="enemy-unknown-lose-1"/);
  assert.doesNotMatch(svg, /<script|<image|href=/i);
});

test('missing catalog rejects readably while the zero-network fallback remains available', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('missing', { status: 404 }));
  await assert.rejects(loadSkinCatalog(), /HTTP 404.*index\.json/);
  assert.equal(builtInSkin().id, 'classic');
  assert.equal(builtInSkin().definition.palette.ui.accent, '#c5f277');
});

test('JSON loading checks declared and streamed byte limits and malformed data', async (t) => {
  const responses = [
    new Response('{}', { headers: { 'content-length': String(SKIN_LIMITS.jsonBytes + 1) } }),
    new Response(new Uint8Array(SKIN_LIMITS.jsonBytes + 1)),
    new Response('<!doctype html><h1>Not found</h1>'),
  ];
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!);
  await assert.rejects(loadSkinCatalog(), /zu groß/);
  await assert.rejects(loadSkinCatalog(), /zu groß/);
  await assert.rejects(loadSkinCatalog(), /ungültiges JSON/);
});

test('a stalled catalog request is aborted after the bounded loading timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, 'fetch', (_url: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  });
  const pending = loadSkinCatalog();
  t.mock.timers.tick(SKIN_LIMITS.loadTimeoutMs + 1);
  await assert.rejects(pending, /innerhalb von 10 Sekunden/);
  assert.equal(signal?.aborted, true);
});

test('a vector-only pack loads without an image and fetches fresh same-origin JSON', async (t) => {
  let requested: RequestInfo | URL | undefined;
  let options: RequestInit | undefined;
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    requested = url; options = init; return jsonResponse(minimal());
  });
  const skin = await loadSkin(entry);
  assert.equal(skin.id, 'example');
  assert.equal(skin.image, null);
  assert.equal(skin.imageUrl, null);
  assert.match(String(requested), /^\/skins\/example\/skin\.json\?skin=/);
  assert.equal(options?.cache, 'no-store');
  assert.equal(options?.credentials, 'same-origin');
  assert.equal(options?.redirect, 'error');
  assert.ok(options?.signal);
});

test('malformed direct entries are rejected before fetch', async (t) => {
  let called = false;
  t.mock.method(globalThis, 'fetch', async () => { called = true; return jsonResponse(minimal()); });
  await assert.rejects(loadSkin({ ...entry, file: '../outside.json' }), SkinError);
  assert.equal(called, false);
});

test('missing or invalid custom assets reject and permit callers to restore the builtin', async (t) => {
  const responses = [new Response('missing', { status: 404 }), jsonResponse(artwork())];
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!);
  mockImages(t, 128, 64, true);
  await assert.rejects(loadSkin(entry), /HTTP 404/);
  await assert.rejects(loadSkin(entry), /Atlasbild.*atlas\.png.*nicht geladen/);
  assert.equal(builtInSkin().image, null);
});

test('decoded image bounds are enforced during actual pack loading', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(artwork()));
  mockImages(t, 100, 64);
  await assert.rejects(loadSkin(entry), /pulse.*außerhalb/);
});

test('successful image loads return the decoded image and distinct cache-busting URLs', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(artwork()));
  const urls = mockImages(t);
  const first = await loadSkin(entry);
  const second = await loadSkin(entry);
  assert.ok(first.image);
  assert.equal(first.image.naturalWidth, 128);
  assert.equal(first.imageIsVector, false);
  assert.equal(first.imageUrl, urls[0]);
  assert.match(first.imageUrl!, /^\/skins\/example\/atlas\.png\?skin=/);
  assert.notEqual(first.imageUrl, second.imageUrl);
});

test('a valid main SVG is preferred without loading its raster fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(vectorArtwork()));
  const urls = mockImages(t);
  const skin = await loadSkin(entry);
  assert.equal(urls.length, 1);
  assert.equal(skin.imageUrl, urls[0]);
  assert.match(skin.imageUrl!, /\/atlas\.svg\?skin=/);
  assert.equal(skin.imageIsVector, true);
  assert.equal(skin.definition.atlas?.fallbackImage, 'atlas.png');
});

test('an unavailable main SVG automatically uses the raster URL and format', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(vectorArtwork()));
  const urls = mockImages(t, 128, 64, (url) => url.includes('/atlas.svg'));
  const skin = await loadSkin(entry);
  assert.equal(urls.length, 2);
  assert.equal(skin.imageUrl, urls[1]);
  assert.match(skin.imageUrl!, /\/atlas\.png\?skin=/);
  assert.equal(skin.imageIsVector, false);
  assert.equal(skin.id, entry.id);
  assert.equal(skin.definition.atlas?.image, 'atlas.svg', 'The declared preference is preserved.');
});

test('main SVG decode failures and decoded bounds violations both try the raster fallback', async (t) => {
  for (const svg of [{ decodeFails: true }, { width: 100 }, { height: 0 }, { width: 4097 }]) {
    await t.test(JSON.stringify(svg), async (subtest) => {
      subtest.mock.method(globalThis, 'fetch', async () => jsonResponse(vectorArtwork()));
      const urls = mockImages(subtest, 128, 64, (url) => url.includes('/atlas.svg') ? svg : {});
      const skin = await loadSkin(entry);
      assert.equal(urls.length, 2);
      assert.ok(skin.image);
      assert.equal(skin.image.naturalWidth, 128);
      assert.equal(skin.image.naturalHeight, 64);
      assert.equal(skin.imageIsVector, false);
      assert.equal(skin.imageUrl, urls[1]);
    });
  }
});

test('failure of both main SVG and raster fallback keeps the normal skin-error behavior', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(vectorArtwork()));
  mockImages(t, 128, 64, true);
  await assert.rejects(loadSkin(entry), /atlas\.svg.*Ersatzbild.*atlas\.png/);
});

test('the main raster fallback must also satisfy every frame bound', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(vectorArtwork()));
  mockImages(t, 128, 64, (url) => url.includes('/atlas.svg') ? { fails: true } : { width: 100 });
  await assert.rejects(loadSkin(entry), /Ersatzbild.*pulse.*außerhalb/);
});

test('weapon SVG loads separately with validated bounds and a fresh same-skin URL', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(weaponArtwork()));
  const urls = mockImages(t);
  const skin = await loadSkin(entry);
  assert.ok(skin.image);
  assert.ok(skin.weaponAtlas?.image);
  assert.equal(skin.weaponAtlas.image.naturalWidth, 128);
  assert.equal(skin.imageUrl, urls[0]);
  assert.equal(skin.weaponAtlas.imageUrl, urls[1]);
  assert.match(skin.weaponAtlas.imageUrl, /^\/skins\/example\/weapon-atlas\.svg\?skin=/);
});

test('missing optional weapon images keep the selected pack and main-atlas weapon fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(weaponArtwork()));
  mockImages(t, 128, 64, (url) => url.includes('weapon-atlas.svg'));
  const skin = await loadSkin(entry);
  assert.equal(skin.id, entry.id);
  assert.ok(skin.image);
  assert.equal(skin.definition.weapons?.rock, 'base');
  assert.equal(skin.weaponAtlas, undefined);
});

test('out-of-bounds optional weapon images keep the decoded main-atlas fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ ...weaponArtwork(), weaponAtlas: {
    image: 'weapon-atlas.svg', frames: { base: { x: 128, y: 0, width: 64, height: 64 } },
  } }));
  const urls = mockImages(t);
  const skin = await loadSkin(entry);
  assert.equal(urls.length, 2);
  assert.ok(skin.image);
  assert.equal(skin.weaponAtlas, undefined);
});

test('optional weapons never hide a main-atlas loading failure', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(weaponArtwork()));
  mockImages(t, 128, 64, (url) => url.includes('/atlas.png'));
  await assert.rejects(loadSkin(entry), /Atlasbild.*atlas\.png.*nicht geladen/);
});

function touchDevice(t: TestContext): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: true }) } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); });
}

test('touch devices load only the small raster and use its own frame coordinates', async (t) => {
  touchDevice(t);
  const source = { ...vectorArtwork(), mobileAtlas: { image: 'mobile.webp', frames: { base: { x: 0, y: 0, width: 32, height: 32 }, pulse: { x: 32, y: 0, width: 32, height: 32 } } } };
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(source));
  const urls = mockImages(t, 64, 32);
  const skin = await loadSkin(entry);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /mobile\.webp/);
  assert.equal(skin.definition.atlas?.frames.pulse.x, 32);
  assert.equal(skin.imageIsVector, false);
});

test('missing optional mobile artwork falls back to the existing raster before SVG', async (t) => {
  touchDevice(t);
  const source = { ...vectorArtwork(), mobileAtlas: { ...artwork().atlas, image: 'mobile.webp' } };
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(source));
  const urls = mockImages(t, 128, 64, url => url.includes('mobile.webp'));
  const skin = await loadSkin(entry);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /atlas\.png/);
  assert.equal(skin.definition.atlas?.frames.pulse.x, 64);
});

test('touch devices with legacy packs prefer raster and skip the optional weapon SVG', async (t) => {
  touchDevice(t);
  const source = { ...weaponArtwork(), atlas: vectorArtwork().atlas };
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(source));
  const urls = mockImages(t);
  const skin = await loadSkin(entry);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /atlas\.png/);
  assert.equal(skin.weaponAtlas, undefined);
});
