/** Export portable, self-contained idle/animated SVGs from each design's sources. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../public/skins/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
for (const { id } of catalog.skins) {
  const directory = new URL(id + '/', root);
  const manifest = JSON.parse(await readFile(new URL('skin.json', directory), 'utf8'));
  if (!manifest.artwork?.gong) continue;
  const source = await readFile(new URL('source/gong.svg', directory), 'utf8');
  const css = await readFile(new URL('source/gong.css', directory), 'utf8');
  for (const pose of ['idle', 'strike']) {
    const svg = source.replace('data-animated="false"', `data-animated="${pose === 'strike'}"`).replace('aria-hidden="true">', `aria-hidden="true"><style>${css}</style>`);
    const file = new URL(manifest.artwork.gong[pose], directory);
    await mkdir(new URL('./', file), { recursive: true });
    await writeFile(file, svg);
  }
  console.log(`${id}: gong graphics exported`);
}
