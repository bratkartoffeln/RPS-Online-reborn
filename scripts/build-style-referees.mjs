/** Classic line icons and Arcade tokens for results and turn indicators.
 * Optional argument: installed sharp module. No ICQ artwork is used here.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const root = new URL('../', import.meta.url);
const colors = { classic: { blue: '#75a8ff', red: '#f48b83' }, arcade: { blue: '#73b2ff', red: '#ff8b84' } };
const svg = (body, title, size = 320) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 320 320"><title>${title}</title>${body}</svg>\n`;
const crown = '<path d="m99 66-9-35 43 20 27-32 27 32 43-20-9 35Z"/>';
const star = '<path d="m160 119 14 28 31 4-23 22 6 31-28-15-28 15 6-31-23-22 31-4Z"/>';
const source = await readFile(new URL('public/skins/arcade/master.svg', root), 'utf8');
function arcadeToken(team, mood) {
  const frame = `${team === 'blue' ? 'own' : 'enemy'}-unknown-${mood === 'happy' ? 'win-1' : mood === 'sad' ? 'lose-1' : 'idle-0'}`;
  const opening = new RegExp(`<g id="${frame}"[^>]*>`).exec(source);
  if (!opening) throw new Error('Missing Arcade token: ' + frame);
  const begin = opening.index + opening[0].length;
  const tags = /<\/?g\b[^>]*>/g;
  tags.lastIndex = begin;
  let depth = 1;
  for (let tag; (tag = tags.exec(source));) {
    depth += tag[0].startsWith('</') ? -1 : tag[0].endsWith('/>') ? 0 : 1;
    if (!depth) return `<g transform="translate(47 57) scale(2.35)">${source.slice(begin, tag.index)}</g>`;
  }
  throw new Error('Unclosed Arcade token: ' + frame);
}
function player(style, team, mood) {
  const color = colors[style][team];
  if (style === 'arcade') return arcadeToken(team, mood) + (mood === 'happy' ? `<g fill="#ffcf7e" stroke="#111f27" stroke-width="5" stroke-linejoin="round">${crown}</g>` : '');
  const symbol = mood === 'happy' ? star : mood === 'sad' ? '<path d="m166 107-26 48 30 13-29 57"/>' : '<path d="M133 163h54"/>';
  return `<g fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="m160 83 83 40v53c0 55-83 95-83 95s-83-40-83-95v-53Z"/>${symbol}${mood === 'happy' ? crown : ''}</g>`;
}
function resultReferee(style, team) {
  const ink = style === 'arcade' ? '#111f27' : '#b9c7d1';
  const edge = team ? colors[style][team] : '#b9c7d1';
  if (style === 'classic') return `<g fill="none" stroke="${edge}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${team ? `${crown}<circle cx="152" cy="151" r="61"/><path d="M127 151h124m-30-30 30 30-30 30M119 239h66"/><path d="M152 212v27"/>` : '<circle cx="160" cy="160" r="84"/><path d="M124 144h72m-72 32h72"/>'}</g>`;
  return `<g stroke="${ink}" stroke-width="6" stroke-linejoin="round"><path d="m93 81 67-30 67 30 29 62-29 89-67 36-67-36-29-89Z" fill="#192c35"/><path d="m100 92 60-27 60 27 23 53-25 78-58 31-58-31-25-78Z" fill="none" stroke="${team ? edge : '#ffcf7e'}" stroke-width="5"/>${team ? `<g fill="#ffcf7e">${crown}</g><path d="M104 151h105v-28l46 41-46 41v-28H104Z" fill="${edge}"/>` : '<path d="M116 135h88v18h-88Zm0 39h88v18h-88Z" fill="#ffcf7e"/>'}</g>`;
}
function indicator(style, team, direction) {
  const color = team ? colors[style][team] : '#b9c7d1';
  const arrow = direction === 'top' ? '<path d="m112 150 48-48 48 48m-48-48v118"/>' : '<path d="m112 174 48 48 48-48m-48 48V104"/>';
  if (style === 'classic') return `<g fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="m160 41 94 45v65c0 69-94 118-94 118s-94-49-94-118V86Z"/>${team ? arrow : '<path d="M120 136h80m-80 36h80"/>'}</g>`;
  return `<g stroke-linejoin="round"><path d="m80 49 160 0 37 37v160l-37 37H80l-37-37V86Z" fill="${color}"/><path d="M85 61h150l30 30v150l-30 30H85l-30-30V91Z" fill="#132e40"/><path d="M90 71h140l24 24v70L66 192V95Z" fill="${team === 'red' ? '#b9333e' : team === 'blue' ? '#205dc1' : '#34505b'}"/><g fill="none" stroke="${team ? '#eef9ef' : '#ffcf7e'}" stroke-width="13" stroke-linecap="square">${team ? arrow : '<path d="M117 141h86m-86 40h86"/>'}</g><path d="M102 258h116" stroke="${color}" stroke-width="4"/></g>`;
}
for (const style of ['classic', 'arcade']) {
  const directory = new URL(`public/endgame/${style}/`, root);
  await mkdir(directory, { recursive: true });
  for (const team of ['blue', 'red']) for (const mood of ['happy', 'sad', 'neutral']) {
    await writeFile(new URL(`${team}-${mood}.svg`, directory), svg(player(style, team, mood), `${style}: ${team}, ${mood}`));
  }
  for (const team of ['blue', 'red', null]) await writeFile(new URL(`referee-${team ?? 'neutral'}.svg`, directory), svg(resultReferee(style, team), `${style}: result ${team ?? 'draw'}`));
  const dir = new URL(`public/skins/${style}/`, root);
  const manifest = JSON.parse(await readFile(new URL('skin.json', dir), 'utf8'));
  const atlasPath = new URL(manifest.atlas.image, dir);
  let atlas = await readFile(atlasPath, 'utf8');
  const metadata = await sharp(Buffer.from(atlas)).metadata();
  const height = manifest.atlas.frames['referee-neutral']?.y ?? metadata.height;
  const size = 128, width = Math.max(metadata.width, 5 * size);
  const entries = [[null, null], ['blue', 'top'], ['blue', 'bottom'], ['red', 'top'], ['red', 'bottom']];
  const row = entries.map(([team, direction], index) => {
    const name = team ? `referee-${team}-${direction}` : 'referee-neutral';
    manifest.atlas.frames[name] = { x: index * size, y: height, width: size, height: size };
    return `<g id="${name}" transform="translate(${index * size} 0) scale(.4)">${indicator(style, team, direction)}</g>`;
  }).join('');
  const rowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size}">${row}</svg>`;
  await mkdir(new URL('design/turn-indicators/', root), { recursive: true });
  await writeFile(new URL(`design/turn-indicators/${style}.svg`, root), rowSvg + '\n');
  atlas = atlas.replace(/<!-- style-referees -->[\s\S]*?<!-- end-style-referees -->\s*/g, '');
  atlas = atlas.replace(/<svg\b[^>]*>/, tag => tag.replace(/\bwidth="[^"]*"/, `width="${width}"`).replace(/\bheight="[^"]*"/, `height="${height + size}"`).replace(/\bviewBox="[^"]*"/, `viewBox="0 0 ${width} ${height + size}"`));
  atlas = atlas.replace(/<\/svg>\s*$/, `<!-- style-referees --><g transform="translate(0 ${height})">${row}</g><!-- end-style-referees --></svg>\n`);
  await writeFile(atlasPath, atlas);
  if (manifest.atlas.fallbackImage) {
    const png = new URL(manifest.atlas.fallbackImage, dir);
    const base = await sharp(await readFile(png)).extract({ left: 0, top: 0, width: metadata.width, height }).extend({ right: width - metadata.width, bottom: size, background: '#00000000' }).png().toBuffer();
    const tile = await sharp(Buffer.from(rowSvg)).png().toBuffer();
    await writeFile(png, await sharp(base).composite([{ input: tile, left: 0, top: height }]).png().toBuffer());
  }
  manifest.portrait = 'referee-neutral';
  manifest.directionalTurnPortraits = Object.fromEntries(['blue', 'red'].map(team => [team, { top: `referee-${team}-top`, bottom: `referee-${team}-bottom` }]));
  await writeFile(new URL('skin.json', dir), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${style}: result symbols and five directional turn indicators exported`);
}
