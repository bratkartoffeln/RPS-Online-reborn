/** Prepare a local CC0 human scream as a descending, fading fall into a pit.
 * node scripts/build-trap-fall-audio.mjs <aargh4.ogg> [playwright-module]
 * Source archive: https://opengameart.org/sites/default/files/aargh.zip (only item 4 is used).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const input = process.argv[2];
if (!input) throw new Error('Pass the CC0 aargh4.ogg source file.');
const { chromium } = createRequire(import.meta.url)(process.argv[3] || 'playwright');
const source = await readFile(input);
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
let samples;
try {
  const page = await browser.newPage();
  samples = await page.evaluate(async bytes => {
    const rate = 22050, duration = 1.25;
    const context = new OfflineAudioContext(1, Math.round(rate * duration), rate);
    const buffer = await context.decodeAudioData(new Uint8Array(bytes).buffer);
    const voice = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    voice.buffer = buffer;
    voice.playbackRate.setValueAtTime(1.08, 0);
    voice.playbackRate.linearRampToValueAtTime(.68, 1.05);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(6500, 0);
    filter.frequency.exponentialRampToValueAtTime(1400, 1.15);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(.65, .012);
    gain.gain.linearRampToValueAtTime(.45, .3);
    gain.gain.exponentialRampToValueAtTime(.002, 1.15);
    gain.gain.linearRampToValueAtTime(0, duration);
    voice.connect(filter); filter.connect(gain); gain.connect(context.destination);
    for (const [delayTime, volume] of [[.075, .18], [.14, .08]]) {
      const delay = context.createDelay(), echo = context.createGain();
      delay.delayTime.value = delayTime; echo.gain.value = volume;
      gain.connect(delay); delay.connect(echo); echo.connect(context.destination);
    }
    voice.start();
    return Array.from((await context.startRendering()).getChannelData(0));
  }, [...source]);
} finally { await browser.close(); }
const wav = Buffer.alloc(44 + samples.length * 2), rate = 22050;
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
const peak = Math.max(...samples.map(Math.abs)), target = 10 ** (-3 / 20);
samples.forEach((value, index) => wav.writeInt16LE(Math.round(value / peak * target * 32767), 44 + index * 2));
const credits = {
  file: 'trap-fall.wav', author: 'JohnsonBrandEditing (Brian R. Johnson)',
  source: 'https://freesound.org/people/JohnsonBrandEditing/sounds/173944/',
  title: 'human male scream multi', license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  archive: 'https://opengameart.org/sites/default/files/aargh.zip',
  excerpt: 'aargh4.ogg, extracted and normalized by congusbongus; archive attribution assigns items 3–7 to this CC0 recording.',
  processing: 'OfflineAudioContext: mono 22050 Hz, 1.25 s; descending playback rate 1.08–0.68, low-pass sweep, falling volume, two short echoes; PCM16 WAV normalized to -3 dBFS.',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  sha256: createHash('sha256').update(wav).digest('hex'),
};
for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
  const root = new URL(`../public/skins/${id}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('skin.json', root), 'utf8'));
  manifest.audio.trapFall = { file: 'audio/trap-fall.wav', volume: .65, rate: 1 };
  await writeFile(new URL('skin.json', root), JSON.stringify(manifest, null, 2) + '\n');
  await mkdir(new URL('source/trap-fall/', root), { recursive: true });
  await writeFile(new URL('source/trap-fall/aargh4.ogg', root), source);
  await writeFile(new URL('audio/trap-fall.wav', root), wav);
  const sourcesFile = new URL('audio/SOURCES.json', root);
  const sources = JSON.parse(await readFile(sourcesFile, 'utf8'));
  sources.trapFall = credits;
  await writeFile(sourcesFile, JSON.stringify(sources, null, 2) + '\n');
  await writeFile(new URL('audio/LICENSE-trap-fall.txt', root), `${credits.title}\n${credits.author}\n${credits.source}\nLicense: ${credits.license}\n${credits.licenseUrl}\n\n${credits.excerpt}\n${credits.processing}\n`);
}
console.log('Human trap-fall scream prepared for all four designs (1.25 s, CC0).');
