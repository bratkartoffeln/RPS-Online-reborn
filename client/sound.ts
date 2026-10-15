import type { GameActionView } from '../shared/game';

/** Optional, locally synthesized effects. No downloads, music or autoplay. */
export class GameSounds {
  private context: AudioContext | null = null;
  private enabled = false;
  private active = new Set<OscillatorNode>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const oscillator of this.active) {
        try { oscillator.stop(); } catch { /* A completed effect may already be stopped. */ }
      }
      this.active.clear();
      void this.context?.suspend().catch(() => {});
    }
  }

  /** Called only from pointer/key gestures or from the user's sound switch. */
  async unlock(): Promise<void> {
    if (!this.enabled || typeof window.AudioContext !== 'function') return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* Muted or unavailable audio must never interrupt a move. */ }
  }

  playAction(action: GameActionView, you: string, resultAfterMs: number): void {
    if (!this.enabled || this.context?.state !== 'running' || document.hidden) return;
    if (action.kind === 'move') {
      this.tone(330, .065, 0, 'triangle');
      this.tone(440, .065, .055, 'triangle');
      return;
    }
    this.tone(160, .075, 0, 'triangle');
    const delay = Math.max(0, resultAfterMs) / 1000;
    if (action.outcome === 'duel' || action.outcome === 'tie') {
      [392, 392].forEach((note, index) => this.tone(note, .1, delay + index * .13, 'sine'));
    } else {
      const winner = action.winnerId === action.attacker.id ? action.attacker : action.defender;
      const notes = winner?.owner === you ? [440, 554, 659] : [330, 262, 196];
      notes.forEach((note, index) => this.tone(note, .11, delay + index * .09, 'triangle'));
    }
  }

  playStartGong(style: 'retro' | 'classic' | 'arcade', delayMs: number): void {
    if (!this.enabled || this.context?.state !== 'running' || document.hidden) return;
    const delay = Math.max(0, delayMs) / 1000;
    if (style === 'arcade') {
      [220, 440, 880].forEach((frequency, index) => this.tone(frequency, .24, delay + index * .07, 'triangle', .025));
      this.tone(110, .8, delay, 'sine', .025);
      return;
    }
    const base = style === 'classic' ? 520 : 145;
    [1, 1.47, 1.99, 2.73, 3.81, 5.1].forEach((ratio, index) => {
      this.tone(base * ratio, 2.4 - index * .27, delay, 'sine', .022 / (1 + index * .65));
    });
  }

  private tone(frequency: number, duration: number, delay: number, type: OscillatorType, volume = .035): void {
    const context = this.context;
    if (!context || this.active.size >= 20) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.active.add(oscillator);
    oscillator.onended = () => {
      this.active.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + .015);
  }
}
