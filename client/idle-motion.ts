import type { GameView } from '../shared/game';

/** Independent clocks keep neighbouring figures from moving in lockstep. */
export function nextFidgetDelay(random = Math.random): number { return 2000 + random() * 6000; }

export function fidgetFrame(base: string, frames: string[], elapsed: number, variant: number): string {
  if (elapsed < 0 || elapsed >= 720 || frames.length < 2) return base;
  const frame = frames[1 + variant % (frames.length - 1)];
  if (frame.endsWith('-fidget-blink')) return elapsed < 160 ? frame : base;
  return Math.floor(elapsed / 180) % 2 === 0 ? frame : base;
}

export const YAWN_AFTER_MS = 10_000;
export const YAWN_DURATION_MS = 2400;

/** A shared snapshot signature observes actions from either seat, ignoring chat/sync. */
export function inactivityKey(view: GameView): string {
  return JSON.stringify([view.series.id, view.series.matchId, view.turnNumber, view.lastAction?.id,
    view.duel?.id, view.duel?.round, view.duel?.choiceLocked]);
}

export class RefereeInactivity {
  private key = '';
  private since = 0;
  private started: number | null = null;
  private used = false;
  yawning = false;

  update(key: string, active: boolean, now: number): boolean {
    const previous = this.yawning;
    if (!active || key !== this.key) {
      this.key = key; this.since = now; this.started = null; this.used = false; this.yawning = false;
    } else if (!this.used && now - this.since >= YAWN_AFTER_MS) {
      this.started = now; this.used = true; this.yawning = true;
    } else if (this.started !== null && now - this.started >= YAWN_DURATION_MS) this.yawning = false;
    return previous !== this.yawning;
  }
}
