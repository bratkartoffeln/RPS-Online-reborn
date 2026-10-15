/** Add the editable speech bubbles to each existing atlas without moving frames.
 * Optional artwork dependency: sharp. Pass its installed module path as argv[2]
 * when it is provided by a graphics runtime rather than this project.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const name = 'chat-notice';
const configurations = [
  { id: 'classic', image: 'atlas.svg', frame: { x: 0, y: 0, width: 96, height: 96 } },
  { id: 'arcade', image: 'master.svg', frame: { x: 288, y: 1152, width: 96, height: 96 } },
  { id: 'icq-retro', image: 'atlas.svg', frame: { x: 1736, y: 296, width: 272, height: 272 } },
];

for (const { id, image, frame } of configurations) {
  const directory = path.join(root, 'public/skins', id);
  const source = await readFile(path.join(directory, 'source/chat-notice.svg'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(directory, 'skin.json'), 'utf8'));
  const body = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '').trim();
  if (id === 'classic') {
    await writeFile(path.join(directory, image), source);
    manifest.atlas = { image, frames: {} };
  } else {
    const original = await readFile(path.join(directory, image), 'utf8');
    const withoutOld = original.replace(/<g id="chat-notice-artwork"[\s\S]*?<!-- end-chat-notice -->\s*/g, '');
    const group = `<g id="chat-notice-artwork" transform="translate(${frame.x} ${frame.y}) scale(${frame.width / 96})">${body}</g><!-- end-chat-notice -->\n`;
    await writeFile(path.join(directory, image), withoutOld.replace(/<\/svg>\s*$/, group + '</svg>\n'));
    // Render only the new tile; all existing fallback artwork is retained.
    const tile = await sharp(Buffer.from(source)).resize(frame.width, frame.height).png().toBuffer();
    const originalPng = await readFile(path.join(directory, 'atlas.png'));
    // Clear the tile first so repeated exports remain identical at translucent edges.
    const cleared = await sharp(originalPng).composite([{ input: { create: { width: frame.width, height: frame.height, channels: 4, background: '#000000ff' } }, left: frame.x, top: frame.y, blend: 'dest-out' }]).png().toBuffer();
    const updated = await sharp(cleared).composite([{ input: tile, left: frame.x, top: frame.y }]).png().toBuffer();
    await writeFile(path.join(directory, 'atlas.png'), updated);
    if (manifest.mobileAtlas) {
      const mobilePath = path.join(directory, manifest.mobileAtlas.image);
      const originalMobile = await readFile(mobilePath);
      const mobile = await sharp(originalMobile).metadata();
      const desktop = await sharp(updated).metadata();
      const scale = mobile.width / desktop.width;
      const mobileFrame = Object.fromEntries(Object.entries(frame).map(([key, value]) => [key, Math.round(value * scale)]));
      manifest.mobileAtlas.frames[name] = mobileFrame;
      const mobileTile = await sharp(Buffer.from(source)).resize(mobileFrame.width, mobileFrame.height).png().toBuffer();
      const mobileCleared = await sharp(originalMobile).composite([{ input: { create: { width: mobileFrame.width, height: mobileFrame.height, channels: 4, background: '#000000ff' } }, left: mobileFrame.x, top: mobileFrame.y, blend: 'dest-out' }]).png().toBuffer();
      await writeFile(mobilePath, await sharp(mobileCleared).composite([{ input: mobileTile, left: mobileFrame.x, top: mobileFrame.y }]).webp({ lossless: true }).toBuffer());
    }
  }
  manifest.atlas.frames[name] = frame;
  manifest.chatNotice = name;
  await writeFile(path.join(directory, 'skin.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${id}: ${name} in ${image}${manifest.mobileAtlas ? ', PNG und mobilem WebP' : id === 'classic' ? '' : ' und PNG'}`);
}
