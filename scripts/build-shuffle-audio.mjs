/** Deterministic offline shuffle effects; retains the supplied retro recording. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../public/skins/', import.meta.url);
const sampleRate = 22050;

function synthesize(style) {
  const duration = style === 'classic' ? .62 : .58;
  const samples = Math.ceil(duration * sampleRate);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  let seed = 20420, previousNoise = 0;
  for (let i = 0; i < samples; i++) {
    const time = i / sampleRate;
    let value = 0;
    if (style === 'classic') {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 0x80000000 - 1;
      for (const start of [0, .075, .145, .21, .28, .35, .43]) {
        const t = time - start;
        if (t >= 0 && t < .15) {
          const envelope = Math.min(1, t / .004) * Math.exp(-t * 38);
          value += envelope * ((noise - previousNoise) * .16 + Math.sin(2 * Math.PI * 780 * t) * .1);
        }
      }
      previousNoise = noise;
    } else {
      const notes = [523.25, 783.99, 659.25, 1046.5, 1318.51, 1567.98];
      for (let note = 0; note < notes.length; note++) {
        const t = time - note * .065;
        if (t >= 0 && t < .18) {
          const envelope = Math.min(1, t / .003) * Math.exp(-t * 25);
          value += Math.sign(Math.sin(2 * Math.PI * notes[note] * t)) * envelope * .18;
        }
      }
    }
    const fade = Math.min(1, (duration - time) / .03);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * fade)) * 24000), 44 + i * 2);
  }
  return wav;
}

for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
  const directory = new URL(id + '/', root);
  const retro = id.startsWith('icq');
  const file = retro ? 'original-bling.wav' : 'shuffle.wav';
  const audio = retro ? await readFile(new URL('audio/' + file, directory)) : synthesize(id);
  if (!retro) await writeFile(new URL('audio/' + file, directory), audio);
  const manifestUrl = new URL('skin.json', directory);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  manifest.audio.shuffle = { file: 'audio/' + file, volume: retro ? .65 : .75, rate: 1 };
  await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
  const creditsUrl = new URL('audio/SOURCES.json', directory);
  const credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
  credits.shuffle = {
    file, sha256: createHash('sha256').update(audio).digest('hex'),
    source: retro ? 'User-supplied extracted original-bling.wav; used unchanged.' : 'Generated offline by scripts/build-shuffle-audio.mjs (deterministic PCM synthesis).',
    license: retro ? 'Original game recording; no additional reuse license supplied.' : 'CC0-1.0',
  };
  await writeFile(creditsUrl, JSON.stringify(credits, null, 2) + '\n');
  console.log(`${id}: shuffle uses ${file}`);
}
