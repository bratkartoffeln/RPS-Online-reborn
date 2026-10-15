/** Append public, weapon-neutral side poses to each desktop and mobile atlas.
 * Run after the other atlas exporters; optional argument: installed Playwright module.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { deflateSync, inflateSync } from 'node:zlib';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const root = new URL('../public/skins/', import.meta.url);
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const retroProfile = (await readFile(new URL('icq-retro/source/side-profile.svg', root), 'utf8'))
  .replace(/<svg\b[^>]*>|<\/svg>|<title>[\s\S]*?<\/title>/g, '').trim();

function profile(style, team) {
  if (style.startsWith('icq')) {
    return team === 'blue' ? retroProfile : retroProfile.replaceAll('#306ac5', '#c73d2e')
      .replaceAll('#538de0', '#ec5941').replaceAll('#22529b', '#9e2a22')
      .replaceAll('#204786', '#962b24').replaceAll('#659be5', '#ff8a60');
  }
  const retro = style.startsWith('icq');
  const color = team === 'blue' ? (retro ? '#306ac5' : '#75a8ff') : (retro ? '#cc423a' : '#f48b83');
  const ink = style === 'classic' ? color : '#171b22';
  const face = retro ? '#fac58f' : style === 'classic' ? 'none' : '#eef9ef';
  const head = retro
    ? `<path d="M47 49C32 30 41 15 60 13C79 12 88 24 84 35L96 40 87 46C87 61 71 68 55 60Z" fill="${face}"/>
      <path d="M41 31Q35 15 56 12Q75 8 83 25L64 23Z" fill="${color}"/>
      <path d="M54 13Q47 6 54 2Q61-2 68 3L66 12Z" fill="${color}"/>
      <path d="M65 34 83 32 79 44 67 42Z" fill="#fffef3"/><path d="m76 36 1 5" stroke-width="4"/><path d="m79 52 6-1" fill="none"/>`
    : `<path d="M47 49 39 33 43 16 61 10 78 17 81 32 92 39 82 44 80 57 60 62Z" fill="${face}"/>
      <path d="M40 34 43 16 61 10 78 17 81 29 62 25Z" fill="${style === 'classic' ? 'none' : color}"/>
      <path d="m42 29-17-5 6 12 12 1m-1-5-17 11 6 7 16-13" fill="${style === 'classic' ? 'none' : color}"/>
      <path d="m65 34 13-1" stroke-width="4"/><ellipse cx="74" cy="39" rx="2.2" ry="3" fill="${ink}" stroke="none"/>
      <path d="m78 49 5-1" fill="none"/>`;
  return `<g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <path d="m53 79-13 29 23 5 10-22 10 19 19-5-27-31Z" fill="${style === 'classic' ? 'none' : color}"/>
    <path d="m39 108-5 9h29l2-8m18 0 4 8h22l-7-12" fill="${style === 'classic' ? 'none' : '#20272b'}"/>
    <path d="m49 52-9 28 14 13 25-8-3-30Z" fill="${style === 'classic' ? 'none' : color}"/>
    <path d="m61 59 17 13 16-9 6 10-23 14-23-13" fill="${style === 'classic' ? 'none' : color}"/>
    <path d="m91 63 10-1 6 5-4 8-9-1Z" fill="${face}"/>
    ${head}<path d="M46 82l31-6" fill="none"/>
  </g>`;
}

function compactPng(png) {
  const chunks = [], data = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    chunks.push({ type, chunk: png.subarray(offset, offset + length + 12) });
    if (type === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const compressed = deflateSync(inflateSync(Buffer.concat(data)), { level: 9 });
  const chunk = Buffer.alloc(compressed.length + 12);
  chunk.writeUInt32BE(compressed.length); chunk.write('IDAT', 4); compressed.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  let inserted = false;
  return Buffer.concat([png.subarray(0, 8), ...chunks.flatMap(entry => {
    if (entry.type !== 'IDAT') return [entry.chunk];
    if (inserted) return [];
    inserted = true; return [chunk];
  })]);
}

try {
  const page = await browser.newPage();
  for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    const dir = new URL(id + '/', root);
    const skin = JSON.parse(await readFile(new URL('skin.json', dir), 'utf8'));
    let atlas = await readFile(new URL(skin.atlas.image, dir), 'utf8');
    const opening = /<svg\b[^>]*>/.exec(atlas)[0];
    const width = Number(/\bwidth="(\d+)"/.exec(opening)[1]);
    const y = skin.atlas.frames['battle-blue-right']?.y ?? Number(/\bheight="(\d+)"/.exec(opening)[1]);
    const height = y + 128;
    if (width < 512 || height > 4096) throw new Error('Battle poses exceed atlas bounds: ' + id);
    const entries = ['blue', 'red'].flatMap(team => ['right', 'left'].map(facing => ({ team, facing })));
    const poses = entries.map(({ team, facing }, index) => {
      const name = `battle-${team}-${facing}`;
      skin.atlas.frames[name] = { x: index * 128, y, width: 128, height: 128 };
      return `<g id="${name}" transform="translate(${index * 128} 0)"><g${facing === 'left' ? ' transform="translate(128 0) scale(-1 1)"' : ''}>${profile(id, team)}</g></g>`;
    }).join('');
    const row = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="128">${poses}</svg>`;
    await writeFile(new URL('source/battle-poses.svg', dir), row + '\n');
    atlas = atlas.replace(/<!-- battle-poses -->[\s\S]*?<!-- end-battle-poses -->\s*/g, '');
    atlas = atlas.replace(/<svg\b[^>]*>/, tag => tag.replace(/\bheight="[^"]*"/, `height="${height}"`).replace(/\bviewBox="[^"]*"/, `viewBox="0 0 ${width} ${height}"`));
    atlas = atlas.replace(/<\/svg>\s*$/, `<!-- battle-poses --><g transform="translate(0 ${y})">${poses}</g><!-- end-battle-poses --></svg>\n`);
    await writeFile(new URL(skin.atlas.image, dir), atlas);
    let scale = 1;
    if (skin.mobileAtlas) {
      const key = skin.mobileAtlas.frames['gong-idle'] ? 'gong-idle' : Object.keys(skin.mobileAtlas.frames).find(name => !name.startsWith('battle-') && skin.atlas.frames[name]);
      scale = skin.mobileAtlas.frames[key].width / skin.atlas.frames[key].width;
      for (const { team, facing } of entries) {
        const name = `battle-${team}-${facing}`;
        skin.mobileAtlas.frames[name] = Object.fromEntries(Object.entries(skin.atlas.frames[name]).map(([key, value]) => [key, Math.round(value * scale)]));
      }
    }
    if (skin.atlas.fallbackImage || skin.mobileAtlas) {
      const rendered = await page.evaluate(async ({ atlas, width, height, scale }) => {
        const image = new Image(); image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(atlas)));
        await image.decode();
        function render(w, h, type) {
          const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(image, 0, 0, w, h);
          return canvas.toDataURL(type, 1).split(',')[1];
        }
        return { png: render(width, height, 'image/png'), webp: render(Math.round(width * scale), Math.round(height * scale), 'image/webp') };
      }, { atlas, width, height, scale });
      if (skin.atlas.fallbackImage) await writeFile(new URL(skin.atlas.fallbackImage, dir), compactPng(Buffer.from(rendered.png, 'base64')));
      if (skin.mobileAtlas) await writeFile(new URL(skin.mobileAtlas.image, dir), Buffer.from(rendered.webp, 'base64'));
    }
    await writeFile(new URL('skin.json', dir), JSON.stringify(skin, null, 2) + '\n');
    console.log(`${id}: four facing poses, ${width}×${height}, mobile scale ${scale}`);
  }
} finally { await browser.close(); }
