/** Derive the independent dark SVG/PNG/mobile atlases, preserving all character artwork.
 * Optional artwork dependency: sharp; pass its module directory as argv[2].
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = fileURLToPath(new URL('../public/skins/', import.meta.url));
const source = path.join(root, 'icq-retro');
const target = path.join(root, 'icq-retro-dark');
const manifest = JSON.parse(await readFile(path.join(source, 'skin.json'), 'utf8'));
const dark = JSON.parse(await readFile(path.join(target, 'skin.json'), 'utf8'));
const gradients = {
  'board-light-fill': ['#465840', '#44563e', '#42543c', '#44563e', '#465840'],
  'board-dark-fill': ['#29382b', '#27362a', '#253428', '#27362a', '#29382b'],
};
let svg = await readFile(path.join(source, 'atlas.svg'), 'utf8');
for (const [id, colors] of Object.entries(gradients)) {
  let count = 0;
  const pattern = new RegExp(`<linearGradient id="${id}"[\\s\\S]*?<\\/linearGradient>`);
  if (!pattern.test(svg)) throw new Error('Missing gradient: ' + id);
  svg = svg.replace(pattern, gradient => gradient.replace(/stop-color="#[a-f\d]{6}"/gi, () => `stop-color="${colors[count++]}"`));
  if (count !== colors.length) throw new Error('Unexpected gradient stops: ' + id);
}
await writeFile(path.join(target, 'atlas.svg'), svg);
// Only replace board tiles in the raster fallbacks, keeping character pixels exact.
const tiles = await Promise.all(Object.keys(gradients).map(async gradient => {
  const frame = manifest.atlas.frames[gradient.replace('-fill', '')];
  const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${frame.width}" height="${frame.height}" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}">${svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`;
  return { input: await sharp(Buffer.from(tileSvg)).png().toBuffer(), left: frame.x, top: frame.y };
}));
async function patchPixels(original, replacements) {
  const base = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const tile of replacements) {
    const pixels = await sharp(tile.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let row = 0; row < pixels.info.height; row++) {
      const start = row * pixels.info.width * 4;
      pixels.data.copy(base.data, ((tile.top + row) * base.info.width + tile.left) * 4, start, start + pixels.info.width * 4);
    }
  }
  return sharp(base.data, { raw: { width: base.info.width, height: base.info.height, channels: 4 } });
}
const png = await (await patchPixels(await readFile(path.join(source, 'atlas.png')), tiles)).png().toBuffer();
await writeFile(path.join(target, 'atlas.png'), png);
const mobileTiles = await Promise.all(tiles.map(async (tile, index) => {
  const name = Object.keys(gradients)[index].replace('-fill', '');
  const frame = manifest.mobileAtlas.frames[name];
  return { input: await sharp(tile.input).resize(frame.width, frame.height).png().toBuffer(), left: frame.x, top: frame.y };
}));
await (await patchPixels(await readFile(path.join(source, manifest.mobileAtlas.image)), mobileTiles)).webp({ lossless: true }).toFile(path.join(target, manifest.mobileAtlas.image));
if (manifest.weaponAtlas) await copyFile(path.join(source, manifest.weaponAtlas.image), path.join(target, manifest.weaponAtlas.image));
// The new pack owns its assets; keep the original frame coordinates and poses.
delete dark.assetPack;
for (const key of ['atlas', 'mobileAtlas', 'weaponAtlas', 'board', 'pieces', 'teamPieces', 'weapons', 'logo', 'portrait', 'turnPortraits', 'colorTurnPortraits', 'directionalTurnPortraits', 'flagVictoryFrames', 'chatNotice']) {
  if (manifest[key] !== undefined) dark[key] = manifest[key];
}
Object.assign(dark.palette.board, { light: '#44563e', dark: '#27362a', border: '#728866', coordinates: '#b9c9a6', selected: '#d4f18a', accent: '#c2e76b', shadow: '#0a100c' });
await writeFile(path.join(target, 'skin.json'), JSON.stringify(dark, null, 2) + '\n');
console.log('ICQ Retro Dark: own SVG, PNG and mobile WebP atlases generated.');
