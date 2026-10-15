/** Export the live gong artwork to every desktop and mobile graphics pack.
 * node --import tsx scripts/build-gong-atlases.mjs [installed sharp module]
 * Run after the combat and style-referee atlas exporters.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gongMarkup } from '../client/gong-ui.ts';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const root = new URL('../', import.meta.url);
const original = await readFile(new URL('public/gong/icq-original-cutout.png', root));
const embedded = 'data:image/png;base64,' + (await sharp(original).resize(320, 232, { fit: 'contain', background: '#00000000' }).png().toBuffer()).toString('base64');
for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
  const dir = new URL(`public/skins/${id}/`, root);
  const definition = JSON.parse(await readFile(new URL('skin.json', dir), 'utf8'));
  const file = new URL(definition.atlas.image, dir);
  let atlas = await readFile(file, 'utf8');
  const previous = await sharp(Buffer.from(atlas)).metadata();
  const y = definition.atlas.frames['gong-idle']?.y ?? previous.height;
  const width = id.startsWith('icq') ? 272 : 128, height = width * .75;
  const variants = ['idle', 'strike'].map((pose, index) => {
    let art = gongMarkup({ id, definition }, 320).replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    art = art.replaceAll(`gong-${id.startsWith('icq') ? 'retro' : id}-320`, `atlas-gong-${pose}`);
    art = art.replaceAll('/gong/icq-original-cutout.png', embedded);
    if (pose === 'strike') art = art.replace(/(class="gong-mallet" style=")/, '$1transform:rotate(-73deg);');
    const frame = { x: index * width, y, width, height };
    definition.atlas.frames[`gong-${pose}`] = frame;
    return `<g id="gong-${pose}" transform="translate(${index * width} 0) scale(${width / 320})">${art}</g>`;
  }).join('');
  const row = `<svg xmlns="http://www.w3.org/2000/svg" width="${previous.width}" height="${height}">${variants}</svg>`;
  await mkdir(new URL('design/gong/', root), { recursive: true });
  await writeFile(new URL(`design/gong/${id}.svg`, root), row + '\n');
  atlas = atlas.replace(/<!-- gong-artwork -->[\s\S]*?<!-- end-gong-artwork -->\s*/g, '');
  atlas = atlas.replace(/<svg\b[^>]*>/, tag => tag.replace(/\bheight="[^"]*"/, `height="${y + height}"`).replace(/\bviewBox="[^"]*"/, `viewBox="0 0 ${previous.width} ${y + height}"`));
  atlas = atlas.replace(/<\/svg>\s*$/, `<!-- gong-artwork --><g transform="translate(0 ${y})">${variants}</g><!-- end-gong-artwork --></svg>\n`);
  await writeFile(file, atlas);
  async function updateRaster(name, scale) {
    const path = new URL(name, dir);
    const input = await readFile(path);
    const rowY = Math.round(y * scale), rowHeight = Math.round(height * scale), rowWidth = Math.round(previous.width * scale);
    const base = await sharp(input).extract({ left: 0, top: 0, width: rowWidth, height: rowY }).extend({ bottom: rowHeight, background: '#00000000' }).png().toBuffer();
    const tile = await sharp(Buffer.from(row)).resize(rowWidth, rowHeight).png().toBuffer();
    const image = sharp(base).composite([{ input: tile, left: 0, top: rowY }]);
    await writeFile(path, await (name.endsWith('.webp') ? image.webp({ lossless: true }) : image.png()).toBuffer());
  }
  if (definition.atlas.fallbackImage) await updateRaster(definition.atlas.fallbackImage, 1);
  if (definition.mobileAtlas) {
    const mobile = await sharp(await readFile(new URL(definition.mobileAtlas.image, dir))).metadata();
    const scale = mobile.width / previous.width;
    for (const pose of ['idle', 'strike']) definition.mobileAtlas.frames[`gong-${pose}`] = Object.fromEntries(Object.entries(definition.atlas.frames[`gong-${pose}`]).map(([key, value]) => [key, Math.round(value * scale)]));
    await updateRaster(definition.mobileAtlas.image, scale);
  }
  await writeFile(new URL('skin.json', dir), JSON.stringify(definition, null, 2) + '\n');
  console.log(`${id}: resting gong and strike pose in every atlas format`);
}
