/** Append fidget poses to both retro atlases and render matching PNG/WebP assets.
 * Run after the base/combat/gong exporters:
 * node scripts/build-retro-idle.mjs [installed playwright module]
 */
import { readFile, writeFile as write, rename } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage();
const root = new URL('../public/skins/', import.meta.url);
async function writeFile(file, content) {
  const temporary = new URL(file.href + '.idle-tmp');
  await write(temporary, content);
  await rename(temporary, file);
}

function group(source, id) {
  const opening = new RegExp(`<g\\b[^>]*\\bid="${id}"[^>]*>`).exec(source);
  if (!opening) throw new Error('Missing group: ' + id);
  const tags = /<\/?g\b[^>]*>/g;
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1;
  for (let tag; (tag = tags.exec(source));) {
    depth += tag[0].startsWith('</') ? -1 : tag[0].endsWith('/>') ? 0 : 1;
    if (!depth) return source.slice(opening.index, tags.lastIndex);
  }
  throw new Error('Unclosed group: ' + id);
}

try {
  for (const id of ['icq-retro', 'icq-retro-dark']) {
    const dir = new URL(id + '/', root);
    const manifest = JSON.parse(await readFile(new URL('skin.json', dir), 'utf8'));
    let svg = await readFile(new URL(manifest.atlas.image, dir), 'utf8');
    const appendedY = /id="referee-yawn" transform="translate\(0 (\d+)\)"/.exec(svg)?.[1];
    svg = svg.replace(/<!-- idle-poses -->[\s\S]*?<!-- end-idle-poses -->/g, '');
    const width = Number(/<svg\b[^>]*\bwidth="(\d+)"/.exec(svg)[1]);
    const oldHeight = Number(/<svg\b[^>]*\bheight="(\d+)"/.exec(svg)[1]);
    const baseY = Number(appendedY ?? manifest.atlas.frames['referee-yawn']?.y ?? oldHeight);
    // Yawn is always the first appended frame, so repeated exports replace the same rows.
    for (const atlas of [manifest.atlas, manifest.mobileAtlas].filter(Boolean)) {
      for (const name of Object.keys(atlas.frames)) if (name.includes('-fidget-') || name === 'referee-yawn') delete atlas.frames[name];
    }
    const source = await readFile(new URL('icq-retro/source/referees.svg', root), 'utf8');
    const defs = /<defs>([\s\S]*?)<\/defs>/.exec(source)[1];
    let referee = group(source, 'referee-neutral').replace('id="referee-neutral"', 'id="yawning-referee"');
    // Replace the entire right arm, including its flag, pole and hand. A mouth
    // overlay alone would leave the referee with three hands.
    referee = referee.replace(/<path d="M(?:91\.7 69\.8|121\.7 71\.3|124 72\.5|107\.7 68\.2)[^"]*"[^>]*\/>/g, '');
    referee = referee.replace(/M97\.1 71\.6 102 70\.9/g, '').replace(/M107\.2 71 137\.9 66\.5/g, '').replace(/M108\.3 70 106\.5 71\.7/g, '');
    referee = referee.replace(/<path d="M76\.6 74\.8[^>]*\/>/, '<ellipse class="yawn-mouth" cx="80.5" cy="74.8" rx="3.8" ry="4.5" fill="#582b22" stroke="#966b30" stroke-width=".7"/><g class="yawn-arm"><path d="M92 70Q101 73 98 81Q96 86 88 82L85 78L90 76L93 78L88 73Z" fill="url(#ref-gold)"/><path d="M93 78L86 74L82 76L88 82L93 82Z" fill="url(#ref-skin)" stroke-width="1.1"/><path class="yawn-hand" d="M88 80Q80 81 78 77Q77 73 79 73L83 76L85 74L89 77Z" fill="url(#ref-skin)" stroke-width="1.1"/></g>');
    referee = referee.replace(/[\t ]+$/gm, '');
    const animation = '<style>@keyframes yawn-mouth{0%,100%{transform:scaleY(.15)}30%,70%{transform:scaleY(1)}}@keyframes yawn-body{0%,100%{transform:rotate(0deg)}35%,65%{transform:rotate(-3deg)}}.yawn-mouth{transform-box:fill-box;transform-origin:center;animation:yawn-mouth 2.4s ease-in-out both}.yawn-hand{transform-box:fill-box;transform-origin:bottom;animation:yawn-body 2.4s ease-in-out both}#yawning-referee{transform-box:fill-box;transform-origin:50% 90%;animation:yawn-body 2.4s ease-in-out both}</style>';
    await writeFile(new URL('yawn.svg', dir), `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><title>Gähnender Schiedsrichter</title><defs>${defs}</defs>${animation}${referee}</svg>\n`);
    const poses = [{ name: 'referee-yawn', body: `<svg width="128" height="128" viewBox="0 0 320 240"><defs>${defs}</defs>${referee}</svg>` }];
    const artworks = new Map();
    function collect(value) {
      if (!value || typeof value !== 'object') return;
      if (typeof value.frame === 'string') artworks.set(value.frame, [...artworks.get(value.frame) ?? [], value]);
      for (const [key, child] of Object.entries(value)) if (key !== 'animations') collect(child);
    }
    collect(manifest.teamPieces); collect(manifest.pieces);
    for (const [name, items] of artworks) {
      const frame = manifest.atlas.frames[name];
      const scale = 128 / Math.max(frame.width, frame.height);
      const art = `<g transform="translate(${(128 - frame.width * scale) / 2} ${(128 - frame.height * scale) / 2}) scale(${scale})"><g transform="translate(${-frame.x} ${-frame.y})"><use href="#${name}"/></g></g>`;
      const names = [];
      for (let variant = 0; variant < 3; variant++) {
        const pose = `${name}-fidget-${variant}`;
        const top = variant === 0 ? 'translate(-3 0) skewX(2)' : variant === 1 ? 'translate(3 0) skewX(-2)' : '';
        const foot = variant === 2 ? 'translate(0 -4) rotate(3 90 102)' : '';
        poses.push({ name: pose, body: `<defs><clipPath id="${pose}-top"><rect width="128" height="94"/></clipPath><clipPath id="${pose}-feet"><rect y="94" width="128" height="34"/></clipPath></defs><g clip-path="url(#${pose}-top)"><g transform="${top}">${art}</g></g><g clip-path="url(#${pose}-feet)"><g transform="${foot}">${art}</g></g>` });
        names.push(pose);
      }
      // Front views have visible eyes. Rear views deliberately keep their blank
      // face area; drawing eyelids there would reveal a face through the hat.
      if (name.includes('-front-') && !name.endsWith('-trap')) {
        const kind = name.split('-').at(-1);
        const eyes = { rock: [40, 77], paper: [39, 76], scissors: [37, 73], flag: [35, 71], unknown: [44, 81] }[kind];
        if (!eyes) throw new Error('Missing eye positions: ' + name);
        const pose = `${name}-fidget-blink`;
        const lids = eyes.map(x => `<rect x="${x - 15}" y="51" width="30" height="19" rx="3" fill="url(#${pose}-skin)"/><path d="M${x - 11} 60Q${x} 65 ${x + 11} 60" fill="none" stroke="#171b22" stroke-width="1.8" stroke-linecap="round"/>`).join('');
        poses.push({ name: pose, body: `${art}<defs><linearGradient id="${pose}-skin" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fcc995"/><stop offset="1" stop-color="#f7c594"/></linearGradient></defs><g class="closed-eyelids">${lids}</g>` });
        names.push(pose);
      }
      for (const item of items) {
        if (name.endsWith('-trap')) {
          if (item.animations) {
            delete item.animations.idle;
            if (!Object.keys(item.animations).length) delete item.animations;
          }
        } else item.animations = { ...item.animations, idle: { frames: [name, ...names], fps: 6 } };
      }
    }
    const columns = Math.floor(width / 128);
    const height = baseY + Math.ceil(poses.length / columns) * 128;
    const additions = poses.map(({ name, body }, index) => {
      const x = index % columns * 128, y = baseY + Math.floor(index / columns) * 128;
      manifest.atlas.frames[name] = { x, y, width: 128, height: 128 };
      return `<g id="${name}" transform="translate(${x} ${y})">${body}</g>`;
    }).join('');
    svg = svg.replace(/<svg\b[^>]*>/, tag => tag.replace(/\bheight="[^"]*"/, `height="${height}"`).replace(/\bviewBox="[^"]*"/, `viewBox="0 0 ${width} ${height}"`));
    svg = svg.replace(/<\/svg>\s*$/, `<!-- idle-poses -->${additions}<!-- end-idle-poses --></svg>\n`);
    await writeFile(new URL(manifest.atlas.image, dir), svg);
    const mobileWidth = Math.round(width * manifest.mobileAtlas.frames['gong-idle'].width / manifest.atlas.frames['gong-idle'].width);
    const mobileScale = mobileWidth / width;
    for (const { name } of poses) manifest.mobileAtlas.frames[name] = Object.fromEntries(Object.entries(manifest.atlas.frames[name]).map(([key, value]) => [key, Math.round(value * mobileScale)]));
    const rasters = await page.evaluate(async ({ svg, width, height, mobileWidth }) => {
      const image = new Image(); image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await image.decode();
      function render(w, h, type) {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(image, 0, 0, w, h);
        return canvas.toDataURL(type, 1).split(',')[1];
      }
      return { png: render(width, height, 'image/png'), webp: render(mobileWidth, Math.round(height * mobileWidth / width), 'image/webp') };
    }, { svg, width, height, mobileWidth });
    await writeFile(new URL(manifest.atlas.fallbackImage, dir), Buffer.from(rasters.png, 'base64'));
    await writeFile(new URL(manifest.mobileAtlas.image, dir), Buffer.from(rasters.webp, 'base64'));
    manifest.audio.yawn = { file: 'audio/original-yawn.wav', volume: .72, rate: 1 };
    const creditsUrl = new URL('audio/SOURCES.json', dir), credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
    credits.yawn = { file: 'original-yawn.wav', source: 'User-supplied original-yawn.wav; used unchanged.', license: 'Original game recording; no additional reuse license supplied.', sha256: createHash('sha256').update(await readFile(new URL('audio/original-yawn.wav', dir))).digest('hex') };
    await writeFile(creditsUrl, JSON.stringify(credits, null, 2) + '\n');
    await writeFile(new URL('skin.json', dir), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`${id}: ${artworks.size} figures, ${poses.length} poses, ${width}×${height}`);
  }
} finally { await browser.close(); }
