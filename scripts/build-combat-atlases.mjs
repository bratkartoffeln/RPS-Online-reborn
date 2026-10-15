/** Append combat scenery to every atlas, retaining all existing frame coordinates.
 * Optional argument: path to an installed sharp module. SVG shapes are the source
 * for the desktop SVG, PNG fallback and the touch device WebP atlas.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const root = new URL('../', import.meta.url);
const names = ['combat-trap-hole', 'combat-flag-blue', 'combat-flag-red', 'combat-puff', 'combat-figure-blue', 'combat-figure-red'];
for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
  const size = id.startsWith('icq') ? 272 : 128;
  const dir = new URL(`public/skins/${id}/`, root);
  const manifest = JSON.parse(await readFile(new URL('skin.json', dir), 'utf8'));
  delete manifest.atlas.frames['combat-trap-decoy'];
  if (manifest.mobileAtlas) delete manifest.mobileAtlas.frames['combat-trap-decoy'];
  const svgPath = new URL(manifest.atlas.image, dir);
  let svg = await readFile(svgPath, 'utf8');
  const metadata = await sharp(Buffer.from(svg)).metadata();
  const oldHeight = manifest.atlas.frames[names[0]]?.y ?? metadata.height;
  const width = Math.max(metadata.width, size * names.length);
  const height = oldHeight + size;
  const source = await readFile(new URL('public/skins/' + id + '/source/combat.svg', root), 'utf8');
  const body = source.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  const scaledBody = '<g transform="scale(' + size / 128 + ')">' + body + '</g>';
  const row = '<g transform="translate(0 ' + oldHeight + ')">' + scaledBody + '</g>';
  svg = svg.replace(/<!-- combat-scenery -->[\s\S]*?<!-- end-combat-scenery -->\s*/g, '');
  svg = svg.replace(/<svg\b[^>]*>/, tag => tag.replace(/\bwidth="[^"]*"/, 'width="' + width + '"').replace(/\bheight="[^"]*"/, 'height="' + height + '"').replace(/\bviewBox="[^"]*"/, 'viewBox="0 0 ' + width + ' ' + height + '"'));
  svg = svg.replace(/<\/svg>\s*$/, '<!-- combat-scenery -->' + row + '<!-- end-combat-scenery --></svg>\n');
  await writeFile(svgPath, svg);
  const rowSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + size + '" viewBox="0 0 ' + width + ' ' + size + '">' + scaledBody + '</svg>';
  async function extendRaster(file, scale) {
    const input = await readFile(new URL(file, dir));
    const baseHeight = Math.round(oldHeight * scale);
    const baseWidth = Math.round(metadata.width * scale);
    const outWidth = Math.round(width * scale), outHeight = Math.round(height * scale);
    const tile = await sharp(Buffer.from(rowSvg)).resize(outWidth, outHeight - baseHeight).png().toBuffer();
    const output = sharp(await sharp(input).extract({ left: 0, top: 0, width: baseWidth, height: baseHeight }).extend({ right: outWidth - baseWidth, bottom: outHeight - baseHeight, background: '#00000000' }).png().toBuffer()).composite([{ input: tile, left: 0, top: baseHeight }]);
    await writeFile(new URL(file, dir), await (file.endsWith('.webp') ? output.webp({ lossless: true }) : output.png()).toBuffer());
  }
  if (manifest.atlas.fallbackImage) await extendRaster(manifest.atlas.fallbackImage, 1);
  const scale = manifest.mobileAtlas ? (await sharp(await readFile(new URL(manifest.mobileAtlas.image, dir))).metadata()).width / metadata.width : 1;
  if (manifest.mobileAtlas) await extendRaster(manifest.mobileAtlas.image, scale);
  names.forEach((name, i) => {
    const frame = { x: i * size, y: oldHeight, width: size, height: size };
    manifest.atlas.frames[name] = frame;
    if (manifest.mobileAtlas) manifest.mobileAtlas.frames[name] = Object.fromEntries(Object.entries(frame).map(([k, v]) => [k, Math.round(v * scale)]));
  });
  await writeFile(new URL('skin.json', dir), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${id}: combat scenery exported to all atlas formats`);
}
