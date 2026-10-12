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

  private tone(frequency: number, duration: number, delay: number, type: OscillatorType): void {
    const context = this.context;
    if (!context || this.active.size >= 20) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.035, start + .008);
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
