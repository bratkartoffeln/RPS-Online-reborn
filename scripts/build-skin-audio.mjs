/** Offline asset preparation; no speech engine or network dependency in the game.
 * node scripts/build-skin-audio.mjs <extracted-library-root> <espeak-ng-package/dist>
 * Library directories: impact/, digital/, gong/. See each pack's audio/SOURCES.json.
 */
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const [libraries, speechDir] = process.argv.slice(2).map(value => path.resolve(value));
if (!libraries || !speechDir) throw new Error('Pass extracted CC0 library root and espeak-ng dist directory.');
const root = fileURLToPath(new URL('../public/skins/', import.meta.url));
const { default: synthesize } = await import(pathToFileURL(path.join(speechDir, 'espeak-ng.js')));
const wasmBinary = await readFile(path.join(speechDir, 'espeak-ng.wasm'));
const sources = {
  impact: { author: 'Kenney Vleugels', url: 'https://kenney.nl/assets/impact-sounds', license: 'CC0-1.0' },
  digital: { author: 'Kenney Vleugels', url: 'https://kenney.nl/assets/digital-audio', license: 'CC0-1.0' },
  gong: { author: 'rubberduck', url: 'https://opengameart.org/content/100-cc0-sfx', license: 'CC0-1.0' },
};
async function find(directory, name) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === name) return file;
    if (entry.isDirectory()) { const result = await find(file, name); if (result) return result; }
  }
}
const common = { duel: ['digital', 'twoTone1.ogg'], draw: ['digital', 'twoTone2.ogg'] };
const themes = {
  classic: { voice: 'cmn', speed: 145, pitch: 43, clips: {
    move: ['impact', 'footstep_wood_000.ogg'], rock: ['impact', 'impactWood_medium_000.ogg'],
    paper: ['impact', 'impactSoft_medium_000.ogg'], scissors: ['impact', 'impactMetal_light_000.ogg'],
    trap: ['impact', 'impactPlank_medium_000.ogg'], flag: ['impact', 'impactBell_heavy_000.ogg'],
    win: ['impact', 'impactBell_heavy_001.ogg'], lose: ['impact', 'impactGeneric_light_000.ogg'], gong: ['gong', 'gong_02.ogg'],
  } },
  retro: { voice: 'cmn+m3', speed: 155, pitch: 38, clips: {
    move: ['impact', 'footstep_wood_001.ogg'], rock: ['impact', 'impactPunch_heavy_000.ogg'],
    paper: ['impact', 'impactSoft_heavy_000.ogg'], scissors: ['impact', 'impactTin_medium_000.ogg'],
    trap: ['digital', 'lowDown.ogg'], flag: ['digital', 'powerUp2.ogg'],
    win: ['digital', 'powerUp5.ogg'], lose: ['digital', 'phaserDown1.ogg'], gong: ['gong', 'gong_01.ogg'],
  } },
  arcade: { voice: 'cmn+croak', speed: 165, pitch: 46, clips: {
    move: ['digital', 'pepSound1.ogg'], rock: ['digital', 'zap1.ogg'], paper: ['digital', 'phaserUp1.ogg'],
    scissors: ['digital', 'laser1.ogg'], trap: ['digital', 'spaceTrash1.ogg'], flag: ['digital', 'powerUp6.ogg'],
    win: ['digital', 'threeTone1.ogg'], lose: ['digital', 'phaserDown3.ogg'], gong: ['gong', 'gong_02.ogg'],
  } },
};
const phrases = { redTurn: 'Red turn', blueTurn: 'Blue turn', youWin: 'You win', youLose: 'You lose' };
const moveBanks = {
  classic: { blue: ['impact', 'footstep_wood_000.ogg', 'footstep_wood_001.ogg'], red: ['impact', 'footstep_concrete_000.ogg', 'footstep_concrete_001.ogg'] },
  retro: { blue: ['digital', 'phaseJump1.ogg', 'phaseJump2.ogg'], red: ['digital', 'pepSound4.ogg', 'pepSound5.ogg'] },
  arcade: { blue: ['digital', 'pepSound1.ogg', 'pepSound2.ogg'], red: ['digital', 'phaseJump4.ogg', 'phaseJump5.ogg'] },
};
for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
  const style = id.startsWith('icq') ? 'retro' : id;
  const theme = themes[style], directory = path.join(root, id, 'audio');
  await mkdir(directory, { recursive: true });
  const manifestFile = path.join(root, id, 'skin.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const originalAudio = Object.fromEntries(Object.entries(manifest.audio ?? {}).filter(([, clip]) => clip.file.startsWith('audio/original-')));
  let previousCredits;
  try { previousCredits = JSON.parse(await readFile(path.join(directory, 'SOURCES.json'), 'utf8')); } catch { /* First export. */ }
  manifest.audio = {};
  const credits = { retrieved: '2026-10-15', effects: {}, speech: {
    engine: 'eSpeak NG (espeak-ng npm 1.0.2), offline formant synthesis',
    engineSource: 'https://github.com/espeak-ng/espeak-ng', engineLicense: 'GPL-3.0-or-later (tool only; not shipped)',
    voice: theme.voice, speed: theme.speed, pitch: theme.pitch, language: 'English phrases spoken using the Mandarin voice',
    note: 'Synthetic voice, no human recording or voice imitation. Generated WAV assets dedicated to CC0-1.0.', phrases,
  } };
  for (const [cue, [pack, name]] of Object.entries({ ...common, ...theme.clips })) {
    const input = await find(path.join(libraries, pack), name);
    if (!input) throw new Error(`Missing ${pack}/${name}`);
    const file = cue + '.ogg';
    await copyFile(input, path.join(directory, file));
    manifest.audio[cue] = { file: 'audio/' + file, volume: cue === 'move' ? .32 : cue === 'gong' ? .8 : .55, rate: style === 'arcade' && cue === 'gong' ? 1.35 : 1 };
    credits.effects[file] = { ...sources[pack], original: path.relative(path.join(libraries, pack), input).replaceAll('\\', '/'), sha256: createHash('sha256').update(await readFile(input)).digest('hex') };
  }
  for (const [cue, text] of Object.entries(phrases)) {
    const engine = await synthesize({ wasmBinary, print() {}, printErr() {}, arguments: ['-v', theme.voice, '-s', String(theme.speed), '-p', String(theme.pitch), '-w', 'voice.wav', text] });
    const file = cue + '.wav';
    await writeFile(path.join(directory, file), engine.FS.readFile('voice.wav'));
    manifest.audio[cue] = { file: 'audio/' + file, volume: .85, rate: 1 };
  }
  for (const color of ['blue', 'red']) {
    const cue = color === 'blue' ? 'moveBlue' : 'moveRed';
    const [pack, ...names] = moveBanks[style][color];
    const files = [];
    for (const [index, name] of names.entries()) {
      const input = await find(path.join(libraries, pack), name);
      if (!input) throw new Error(`Missing ${pack}/${name}`);
      const file = `${cue}-${index + 1}.ogg`;
      await copyFile(input, path.join(directory, file));
      files.push('audio/' + file);
      credits.effects[file] = { ...sources[pack], original: path.relative(path.join(libraries, pack), input).replaceAll('\\', '/'), sha256: createHash('sha256').update(await readFile(input)).digest('hex') };
    }
    manifest.audio[cue] = { file: files[0], variants: files.slice(1), volume: .32, rate: 1 };
  }
  if (previousCredits?.video) {
    credits.video = previousCredits.video;
    credits.speech.note = previousCredits.speech.note;
    Object.assign(manifest.audio, originalAudio);
  }
  await writeFile(path.join(directory, 'SOURCES.json'), JSON.stringify(credits, null, 2) + '\n');
  if (!previousCredits?.video) await writeFile(path.join(directory, 'LICENSE.txt'), 'Sound effects: Creative Commons Zero 1.0 Universal (CC0-1.0).\nhttps://creativecommons.org/publicdomain/zero/1.0/\nKenney Vleugels (kenney.nl) and rubberduck (OpenGameArt.org).\nGenerated speech WAVs: CC0-1.0. No human voice samples used.\nPer-file provenance, original filenames and hashes: SOURCES.json.\n');
  for (const pack of ['impact', 'digital']) {
    const license = await find(path.join(libraries, pack), 'License.txt');
    await copyFile(license, path.join(directory, `LICENSE-${pack}.txt`));
  }
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${id}: themed CC0 effects, team movement variations and four local speech alternatives`);
}
await import('./build-shuffle-audio.mjs');
