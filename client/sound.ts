import type { GameActionView, GameView } from '../shared/game';
import type { LoadedSkin, SoundCue, TeamColor } from './skin-types';
import { SOUND_CUES } from './skin-types';
import { skinAssetUrl } from './skin-assets';
import { freshMatchStart } from './gong-ui';
import { freshVictory } from './match-victory';
import { captureMotionFrame } from './board-motion';
import { teamColorForPlayer } from './team-ui';

/** Only live, uninterrupted transitions produce speech, never sync/reload/reconnect. */
export function freshRefereeCue(previous: GameView | null, next: GameView): SoundCue | null {
  if (!previous) return null;
  const before = captureMotionFrame(previous)!, after = captureMotionFrame(next)!;
  if (before.identity !== after.identity || !before.connected || !after.connected ||
      before.paused || after.paused || next.revision !== previous.revision + 1 ||
      previous.series.id !== next.series.id || previous.series.matchId !== next.series.matchId) return null;
  const victory = freshVictory(previous, next);
  if (victory) return victory === next.you ? 'youWin' : 'youLose';
  if (next.phase === 'finished' && !next.winner && (previous.phase === 'playing' || previous.phase === 'duel')) return 'draw';
  if (next.phase !== 'playing' || !next.currentTurn ||
      (!freshMatchStart(previous, next) && (previous.phase !== 'playing' && previous.phase !== 'duel' || previous.currentTurn === next.currentTurn))) return null;
  return teamColorForPlayer(next, next.currentTurn) === 'blue' ? 'blueTurn' : 'redTurn';
}

const VOICES = new Set<SoundCue>(['redTurn', 'blueTurn', 'youWin', 'youLose']);
/** Local pack samples decoded once; the browser needs no TTS service or engine. */
export class GameSounds {
  private context: AudioContext | null = null;
  private enabled = false;
  private skin: LoadedSkin | null = null;
  private epoch = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private active = new Set<AudioScheduledSourceNode>();
  private voice: AudioBufferSourceNode | null = null;
  private variants = new Map<SoundCue, number>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
      void this.context?.suspend().catch(() => {});
    }
  }

  setSkin(skin: LoadedSkin): void {
    this.cancel();
    this.skin = skin;
    this.buffers.clear();
    this.variants.clear();
    this.preload();
  }

  cancel(): void {
    this.epoch++;
    for (const source of this.active) {
      try { source.stop(); } catch { /* Already completed. */ }
    }
    this.active.clear();
    this.voice = null;
  }

  /** Only invoked by a pointer/key gesture or the sound switch. */
  async unlock(): Promise<void> {
    if (!this.enabled || typeof window.AudioContext !== 'function') return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      this.preload();
    } catch { /* Unavailable audio never interrupts gameplay. */ }
  }

  private preload(): void {
    if (!this.enabled || !this.context || !this.skin) return;
    for (const cue of SOUND_CUES) {
      const clip = this.skin.definition.audio?.[cue];
      if (clip) for (const file of [clip.file, ...clip.variants ?? []]) void this.load(skinAssetUrl(this.skin, file));
    }
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const existing = this.buffers.get(url);
    if (existing) return existing;
    const context = this.context!;
    const pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, { credentials: 'same-origin', redirect: 'error', signal: controller.signal });
        if (!response.ok || Number(response.headers.get('content-length')) > 1024 * 1024) return null;
        const reader = response.body?.getReader();
        if (!reader) return null;
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1024 * 1024) { await reader.cancel(); return null; }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const data = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
        const buffer = await context.decodeAudioData(data.buffer);
        return buffer.duration <= 10 ? buffer : null;
      } catch { return null; }
      finally { clearTimeout(timeout); }
    })();
    this.buffers.set(url, pending);
    return pending;
  }

  playCue(cue: SoundCue, delayMs = 0): void {
    const context = this.context, skin = this.skin;
    if (!this.enabled || !context || context.state !== 'running' || document.hidden || !skin) return;
    const clip = skin.definition.audio?.[cue];
    const epoch = this.epoch, due = context.currentTime + Math.max(0, delayMs) / 1000;
    if (!clip) { if (!VOICES.has(cue)) this.fallback(cue, due); return; }
    const files = [clip.file, ...clip.variants ?? []];
    const variant = this.variants.get(cue) ?? 0;
    this.variants.set(cue, variant + 1);
    void this.load(skinAssetUrl(skin, files[variant % files.length])).then(buffer => {
      if (epoch !== this.epoch || !this.enabled || context.state !== 'running' || document.hidden || context.currentTime > due + .3) return;
      if (!buffer) { if (!VOICES.has(cue)) this.fallback(cue, due); return; }
      if (VOICES.has(cue)) {
        try { this.voice?.stop(); } catch { /* Previous announcement ended. */ }
      }
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = clip.rate;
      gain.gain.value = clip.volume;
      source.connect(gain); gain.connect(context.destination);
      this.active.add(source);
      if (VOICES.has(cue)) this.voice = source;
      source.onended = () => {
        this.active.delete(source);
        if (this.voice === source) this.voice = null;
        source.disconnect(); gain.disconnect();
      };
      source.start(Math.max(context.currentTime, due));
    });
  }

  playAction(action: GameActionView, you: string, resultAfterMs: number, movingTeam?: TeamColor): void {
    if (action.kind === 'move') {
      const cue = movingTeam === 'blue' ? 'moveBlue' : movingTeam === 'red' ? 'moveRed' : 'move';
      this.playCue(this.skin?.definition.audio?.[cue] ? cue : 'move');
      return;
    }
    const impact: SoundCue = action.outcome === 'trap' ? 'trap' : action.outcome === 'flag' ? 'flag' :
      action.attacker.kind === 'paper' ? 'paper' : action.attacker.kind === 'scissors' ? 'scissors' : 'rock';
    this.playCue(impact, Math.min(resultAfterMs, 600));
    if (action.outcome === 'duel' || action.outcome === 'tie') this.playCue('duel', resultAfterMs);
    else {
      const winner = action.winnerId === action.attacker.id ? action.attacker : action.defender;
      this.playCue(winner?.owner === you ? 'win' : 'lose', resultAfterMs);
    }
  }

  playStartGong(delayMs: number): void { this.playCue('gong', delayMs); }

  private fallback(cue: SoundCue, due: number): void {
    const context = this.context;
    if (!context || this.active.size >= 20) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = Math.max(context.currentTime, due), duration = cue === 'gong' ? 1.3 : .1;
    oscillator.frequency.value = cue === 'gong' ? 145 : cue.startsWith('move') ? 330 : 220;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(.08, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    this.active.add(oscillator);
    oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration);
  }
}
