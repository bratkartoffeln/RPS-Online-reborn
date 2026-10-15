/** Reproduce the user-requested ICQ video excerpts from a local source file.
 * node scripts/extract-retro-audio.mjs <source-audio-or-video> <ffmpeg-executable>
 * Does not download a video or infer a free license from a YouTube URL.
 */
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const [input, ffmpeg] = process.argv.slice(2);
if (!input || !ffmpeg) throw new Error('Pass a local source audio/video file and FFmpeg executable.');
const root = new URL('../public/skins/', import.meta.url);
const recipeUrl = new URL('icq-retro/source/video-audio-cuts.json', root);
const recipe = JSON.parse(await readFile(recipeUrl, 'utf8'));
const sourceSha256 = createHash('sha256').update(await readFile(input)).digest('hex');
for (const id of ['icq-retro', 'icq-retro-dark']) {
  const directory = new URL(id + '/', root);
  const manifest = JSON.parse(await readFile(new URL('skin.json', directory), 'utf8'));
  const creditsUrl = new URL('audio/SOURCES.json', directory);
  const credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
  credits.video = { ...recipe, sourceSha256, imported: '2026-10-15', processing: 'FFmpeg; mono PCM WAV 22050 Hz, high-pass 55 Hz, peak normalization to -2 dBFS, 6 ms fade-in / 35 ms fade-out. No pitch change. Gong only: 2.1 s feedback-reverb tail with staggered delays, decaying to silence without importing the following voice.' };
  credits.video.files = {};
  for (const [name, cut] of Object.entries(recipe.clips)) {
    const cue = cut.cue ?? name;
    const duration = cut.end - cut.start;
    if (!(duration > 0 && duration <= 10)) throw new Error('Invalid cut: ' + cue);
    const relative = `audio/original-${name}.wav`, file = fileURLToPath(new URL(relative, directory));
    const args = ['-v', 'error', '-y', '-ss', String(cut.start), '-t', String(duration), '-i', path.resolve(input),
      '-vn', '-ac', '1', '-ar', '22050', '-af', `highpass=f=55,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, duration - .035)}:d=0.035`,
      '-map_metadata', '-1', '-fflags', '+bitexact', '-c:a', 'pcm_s16le', file];
    const result = spawnSync(path.resolve(ffmpeg), args, { windowsHide: true, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || String(result.error));
    // Normalize the PCM samples without introducing clipping or a second lossy encoding.
    let wav = await readFile(file);
    let dataOffset = -1, dataLength = 0;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const size = wav.readUInt32LE(offset + 4);
      if (wav.toString('ascii', offset, offset + 4) === 'data') { dataOffset = offset + 8; dataLength = size; break; }
      offset += 8 + size + size % 2;
    }
    if (dataOffset < 0) throw new Error('Missing PCM data: ' + cue);
    if (cue === 'gong') {
      // Continue the isolated ringing through a short feedback reverb. The following
      // spoken turn cue is never imported. Staggered delays avoid a repeated strike.
      const sampleRate = wav.readUInt32LE(24), originalLength = dataLength / 2;
      const extension = Math.round(sampleRate * 2.1), output = new Float64Array(originalLength + extension);
      const dry = new Float64Array(originalLength);
      for (let i = 0; i < originalLength; i++) dry[i] = wav.readInt16LE(dataOffset + i * 2);
      for (const delayMs of [43, 59, 71, 89]) {
        const delay = Math.round(sampleRate * delayMs / 1000), decay = Math.pow(.001, delay / (sampleRate * 1.65));
        const ring = new Float64Array(output.length);
        for (let i = 0; i < output.length; i++) {
          ring[i] = (i < originalLength ? dry[i] : 0) + (i >= delay ? ring[i - delay] * decay : 0);
          output[i] += ring[i] / 4;
        }
      }
      let maximum = 1;
      for (const value of output) maximum = Math.max(maximum, Math.abs(value));
      const extended = Buffer.alloc(44 + output.length * 2);
      wav.copy(extended, 0, 0, 44);
      extended.writeUInt32LE(extended.length - 8, 4); extended.writeUInt32LE(output.length * 2, 40);
      for (let i = 0; i < output.length; i++) {
        const fade = Math.min(1, (output.length - i) / (sampleRate * .25));
        extended.writeInt16LE(Math.round(output[i] / maximum * 26028 * fade), 44 + i * 2);
      }
      wav = extended; dataOffset = 44; dataLength = output.length * 2;
    }
    let peak = 0;
    for (let i = dataOffset; i < dataOffset + dataLength; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    if (!peak) throw new Error('Silent clip: ' + cue);
    const scale = 26028 / peak;
    for (let i = dataOffset; i < dataOffset + dataLength; i += 2) wav.writeInt16LE(Math.round(wav.readInt16LE(i) * scale), i);
    await writeFile(file, wav);
    if (cut.variant) (manifest.audio[cue].variants ??= []).push(relative);
    else manifest.audio[cue] = { file: relative, volume: cue.startsWith('move') ? .35 : cue === 'gong' ? .8 : .72, rate: 1 };
    credits.video.files[path.basename(file)] = { cue, start: cut.start, end: cut.end, sha256: createHash('sha256').update(wav).digest('hex') };
    console.log(`${id}: ${cue} ${cut.start}-${cut.end}s`);
  }
  credits.speech.note = 'Locally generated Mandarin-profile WAVs remain as optional alternatives. Active retro speech is extracted from the user-specified video; see video.files and skin.json. The video excerpts are NOT CC0.';
  await writeFile(new URL('skin.json', directory), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(creditsUrl, JSON.stringify(credits, null, 2) + '\n');
  await writeFile(new URL('audio/LICENSE.txt', directory), 'MIXED AUDIO SOURCES - NOT ALL FILES ARE CC0\n\noriginal-*.wav: excerpts from the user-specified video https://www.youtube.com/watch?v=Q2sDtTbzHiI (shachar700).\nNo free reuse license was declared in the retrieved video metadata. Rights remain with the respective game/audio owners. These excerpts are NOT relicensed as CC0.\n\nOther .ogg effects: CC0-1.0 (Kenney Vleugels, rubberduck).\nOther .wav speech: locally generated with eSpeak NG, dedicated to CC0-1.0.\nExact source times, source/clip hashes and processing: SOURCES.json and ../source/video-audio-cuts.json.\n');
  await mkdir(new URL('source/', directory), { recursive: true });
  if (id !== 'icq-retro') await copyFile(recipeUrl, new URL('source/video-audio-cuts.json', directory));
}
