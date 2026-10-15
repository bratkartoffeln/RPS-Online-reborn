import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { addPlayer, createGame, leavePlayer, readyPlayer, setConnected, viewFor } from '../shared/game';
import { builtInSkin, parseSkinDefinition } from './skins';
import { GameSounds, freshRefereeCue } from './sound';
import { SOUND_CUES } from './skin-types';

function match() {
  const game = createGame();
  addPlayer(game, 'a', 'Ada'); addPlayer(game, 'b', 'Ben');
  readyPlayer(game, 'a');
  const before = viewFor(game, 'a');
  readyPlayer(game, 'b');
  return { before, after: viewFor(game, 'a') };
}

test('referee speaks absolute turn colors and viewer-relative match results exactly once per live transition', () => {
  const { before, after } = match();
  assert.equal(freshRefereeCue(before, after), 'blueTurn');
  const red = { ...after, revision: after.revision + 1, currentTurn: 'b' };
  assert.equal(freshRefereeCue(after, red), 'redTurn');
  assert.equal(freshRefereeCue({ ...after, you: 'b' }, { ...red, you: 'b' }), 'redTurn');
  const result = { ...after, revision: after.revision + 1, phase: 'finished' as const, currentTurn: null, winner: 'a' };
  assert.equal(freshRefereeCue(after, result), 'youWin');
  assert.equal(freshRefereeCue({ ...after, you: 'b' }, { ...result, you: 'b' }), 'youLose');
  assert.equal(freshRefereeCue(after, { ...result, winner: null }), 'draw');
  for (const [previous, next] of [
    [null, after], [after, after], [result, result], [after, { ...red, revision: red.revision + 1 }],
    [after, { ...red, paused: true }], [after, { ...red, players: red.players.map(p => ({ ...p, connected: false })) }],
    [after, { ...red, series: { ...red.series, matchId: 'other' } }], [after, { ...red, you: 'b' }],
  ] as const) assert.equal(freshRefereeCue(previous, next), null);
});

test('an opponent leaving immediately or after reconnect expiry announces the winner once', () => {
  for (const waitingForReconnect of [false, true]) for (const you of ['a', 'b']) {
    const game = createGame();
    addPlayer(game, 'a', 'Ada'); addPlayer(game, 'b', 'Ben');
    readyPlayer(game, 'a'); readyPlayer(game, 'b');
    const opponent = you === 'a' ? 'b' : 'a';
    const playing = viewFor(game, you);
    if (waitingForReconnect) {
      setConnected(game, opponent, false);
      assert.equal(freshRefereeCue(playing, viewFor(game, you)), null, 'no win during the reconnect window');
    }
    const before = viewFor(game, you);
    leavePlayer(game, opponent);
    const finished = viewFor(game, you);
    assert.equal(freshRefereeCue(before, finished), 'youWin');
    assert.equal(freshRefereeCue(finished, viewFor(game, you)), null, 'sync does not repeat the sound');
    assert.equal(freshRefereeCue(null, finished), null, 'reload does not repeat the sound');
    assert.equal(freshRefereeCue({ ...before, you: opponent }, finished), null);
    assert.equal(freshRefereeCue(before, { ...finished, series: { ...finished.series, matchId: 'other' } }), null);
    assert.equal(freshRefereeCue({ ...before, players: before.players.map(player => ({ ...player, connected: false })) }, finished), null, 'own reconnection does not replay the result');
  }
});

test('every shipped design owns complete audio, licenses, artwork and correctly attributed non-silent speech', () => {
  for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    const directory = `public/skins/${id}/`;
    const skin = parseSkinDefinition(JSON.parse(readFileSync(directory + 'skin.json', 'utf8')));
    const expected = SOUND_CUES.filter(cue => id.startsWith('icq') ? !['duel', 'draw', 'trap'].includes(cue) : cue !== 'yawn');
    assert.deepEqual(Object.keys(skin.audio!).sort(), expected.sort());
    for (const clip of Object.values(skin.audio!)) for (const file of [clip.file, ...clip.variants ?? []]) {
      assert.ok(existsSync(directory + file), `${id}/${file}`);
      assert.ok(readFileSync(directory + file).length < 1024 * 1024);
    }
    assert.notEqual(skin.audio!.moveBlue!.file, skin.audio!.moveRed!.file);
    assert.ok(skin.audio!.moveBlue!.variants!.length >= 1);
    assert.ok(skin.audio!.moveRed!.variants!.length >= 1);
    for (const cue of ['blueTurn', 'redTurn', 'youWin', 'youLose'] as const) {
      const wav = readFileSync(directory + skin.audio![cue]!.file);
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
      assert.equal(wav.readUInt32LE(4), wav.length - 8);
      let peak = 0;
      for (let i = 44; i < wav.length - 1; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
      assert.ok(peak > 1000, `${id}: ${cue} contains audible PCM`);
    }
    const credits = JSON.parse(readFileSync(directory + 'audio/SOURCES.json', 'utf8'));
    assert.equal(skin.audio!.shuffle!.file, id.startsWith('icq') ? 'audio/original-bling.wav' : 'audio/shuffle.wav');
    assert.equal(credits.shuffle.file, skin.audio!.shuffle!.file.replace('audio/', ''));
    assert.match(credits.speech.voice, /^cmn/);
    if (id.startsWith('icq')) {
      assert.equal(skin.audio!.yawn!.file, 'audio/original-yawn.wav');
      assert.ok(Object.values(skin.audio!).every(clip => !clip.file.endsWith('.ogg')));
      const yawn = readFileSync(directory + 'yawn.svg', 'utf8');
      assert.match(yawn, /class="yawn-arm"/);
      assert.match(yawn, /class="yawn-hand"/);
      assert.doesNotMatch(yawn, /M91\.7 69\.8|M107\.7 68\.2|M121\.7 71\.3|M107\.2 71 137\.9/);
      assert.equal(skin.audio!.win!.file, skin.audio!.youWin!.file);
      assert.equal(skin.audio!.lose!.file, skin.audio!.youLose!.file);
      for (const cue of ['move', 'moveBlue', 'moveRed', 'rock', 'paper', 'scissors', 'flag', 'gong', 'win', 'lose', 'youWin', 'youLose', 'blueTurn', 'redTurn'] as const) {
        const clip = skin.audio![cue]!;
        for (const file of [clip.file, ...clip.variants ?? []]) {
          assert.ok(credits.video.files[file.replace('audio/', '')], `${id}: ${cue} uses extracted originals exclusively`);
        }
      }
      assert.equal(credits.video.source, 'https://www.youtube.com/watch?v=Q2sDtTbzHiI');
      assert.match(readFileSync(directory + 'audio/LICENSE.txt', 'utf8'), /NOT ALL FILES ARE CC0/);
      for (const cue of ['blueTurn', 'redTurn', 'youWin', 'youLose', 'gong', 'rock', 'paper', 'scissors'] as const) {
        assert.equal(skin.audio![cue]!.file, `audio/original-${cue}.wav`);
        assert.ok(credits.video.files[`original-${cue}.wav`].end > credits.video.files[`original-${cue}.wav`].start);
      }
    } else assert.equal(credits.video, undefined);
    assert.ok(existsSync(directory + 'audio/LICENSE.txt'));
    assert.ok(existsSync(directory + skin.artwork!.gong!.strike));
    for (const team of ['red', 'blue']) for (const mood of ['happy', 'sad', 'neutral']) {
      assert.ok(existsSync(directory + skin.artwork!.endgame + `/${team}-${mood}.svg`));
    }
  }
});

test('pack parser rejects unsafe or unsupported sound paths, values and unknown events', () => {
  const base = { version: 1, name: 'Custom' };
  for (const file of ['../secret.wav', 'audio/../secret.wav', '/x.wav', 'https://example.com/a.wav', 'a%2fw.wav', 'a.js', 'a.wav?x']) {
    assert.throws(() => parseSkinDefinition({ ...base, audio: { gong: { file } } }));
  }
  for (const volume of [-1, 2, NaN]) assert.throws(() => parseSkinDefinition({ ...base, audio: { gong: { file: 'audio/gong.ogg', volume } } }));
  assert.throws(() => parseSkinDefinition({ ...base, audio: { unknown: { file: 'a.wav' } } }));
  assert.throws(() => parseSkinDefinition({ ...base, audio: { moveBlue: { file: 'a.wav', variants: ['../b.wav'] } } }));
  assert.throws(() => parseSkinDefinition({ ...base, audio: { moveBlue: { file: 'a.wav', variants: Array(6).fill('a.wav') } } }));
  assert.throws(() => parseSkinDefinition({ ...base, artwork: { endgame: '../other' } }));
  assert.throws(() => parseSkinDefinition({ ...base, artwork: { gong: { idle: 'a.svg', strike: 'b.svg', durationMs: 100, strikeMs: 200 } } }));
  const custom = parseSkinDefinition({ ...base, audio: { blueTurn: { file: 'audio/turn.wav' } }, artwork: { endgame: 'results' } });
  assert.equal(custom.audio!.blueTurn!.rate, 1);
  assert.equal(custom.artwork!.endgame, 'results');
});

test('sample playback caches decoded buffers, respects mute, cancels pending loads and switches packs without stale audio', async t => {
  const starts: Array<{ when: number; rate: number }> = [], stops: object[] = [], requests: string[] = [], playedIds: number[] = [];
  const sources: Array<{ onended: (() => void) | null }> = [];
  let finishFetch: (() => void) | undefined;
  class FakeContext {
    state = 'running'; currentTime = 1; destination = {};
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    decodeAudioData(data: ArrayBuffer) { return Promise.resolve({ duration: 1, id: new Uint8Array(data)[0] }); }
    createBufferSource() {
      const source = { buffer: null, playbackRate: { value: 1 }, connect() {}, disconnect() {}, onended: null,
        start(when: number) { starts.push({ when, rate: source.playbackRate.value }); playedIds.push((source.buffer as unknown as { id: number }).id); }, stop() { stops.push(source); } };
      sources.push(source);
      return source;
    }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
  }
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    requests.push(String(url));
    if (String(url).includes('/custom/audio/late')) await new Promise<void>(resolve => { finishFetch = resolve; });
    return new Response(new Uint8Array([String(url).includes('blue1') ? 10 : String(url).includes('blue2') ? 11 : String(url).includes('red1') ? 20 : 1]));
  });
  for (const [key, value] of Object.entries({ window: { AudioContext: FakeContext }, AudioContext: FakeContext, document: { hidden: false } })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const skin = { ...builtInSkin(), id: 'custom', definition: parseSkinDefinition({ version: 1, name: 'Custom', audio: {
    gong: { file: 'audio/gong.ogg', rate: 1.2 }, blueTurn: { file: 'audio/late.wav' },
    moveBlue: { file: 'audio/blue1.ogg', variants: ['audio/blue2.ogg'] }, moveRed: { file: 'audio/red1.ogg' },
  } }) };
  const sounds = new GameSounds();
  sounds.setSkin(skin); await sounds.unlock();
  assert.equal(requests.length, 0, 'Muted packs do not preload audio');
  sounds.setEnabled(true); await sounds.unlock(); await flush();
  let gongEnded = false;
  void sounds.playStartGong(380).then(() => { gongEnded = true; }); await flush();
  assert.deepEqual(starts, [{ when: 1.38, rate: 1.2 }]);
  assert.equal(gongEnded, false, 'The gong animation must keep running while its source is playing');
  sounds.playStartGong(0); await flush();
  assert.equal(requests.filter(url => url.endsWith('/gong.ogg')).length, 1);
  sounds.playCue('moveBlue'); await flush();
  sounds.playCue('moveRed'); await flush();
  sounds.playCue('moveBlue'); await flush();
  sounds.playCue('moveBlue'); await flush();
  assert.deepEqual(playedIds.slice(-4), [10, 20, 11, 10], 'Each absolute team keeps its own rotating sound bank');
  let idle = false;
  void sounds.whenIdle().then(() => { idle = true; });
  await flush();
  assert.equal(idle, false, 'Playback remains busy until the audio engine signals completion');
  for (const source of sources.slice(0, -1)) source.onended?.();
  await flush();
  assert.equal(gongEnded, true, 'The gong completion follows its own audio source');
  assert.equal(idle, false, 'The last active sample also has to finish');
  sources.at(-1)!.onended?.();
  await flush();
  assert.equal(idle, true);
  sounds.playStartGong(0); await flush();
  sounds.playCue('blueTurn'); sounds.setSkin({ ...skin, id: 'replacement' });
  finishFetch?.(); await flush();
  assert.equal(starts.length, 7, 'Old speech cannot play after changing skin');
  sounds.setEnabled(false); sounds.playStartGong(0); await flush();
  assert.equal(starts.length, 7);
  assert.ok(stops.length >= 1, 'Mute/skin changes stop scheduled sources');
});
