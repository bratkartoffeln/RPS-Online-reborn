import type { GameView } from '../shared/game';

/** Independent clocks keep neighbouring figures from moving in lockstep. */
export function nextFidgetDelay(random = Math.random): number { return 10_000 + random() * 30_000; }

export function retroIdleFigure(frame: string): boolean {
  return /^(blue|red)-(front|back)-(rock|paper|scissors|flag|unknown)(-revealed)?$/.test(frame);
}

/** Coordinates on a centred 128px figure; one eyelid texture serves every face. */
export function idleEyes(frame: string): readonly number[] | null {
  const match = /^(?:blue|red)-front-(rock|paper|scissors|flag|unknown)$/.exec(frame);
  if (!match) return null;
  const positions: Record<string, readonly number[]> = { rock: [40, 77], paper: [39, 76], scissors: [37, 73], flag: [35, 71], unknown: [44, 81] };
  return positions[match[1]];
}

export function idleDeformation(elapsed: number, variant: number): { x: number; y: number; angle: number; blink: boolean; active: boolean } {
  const duration = variant === 3 ? 160 : 720;
  if (elapsed < 0 || elapsed >= duration) return { x: 1, y: 1, angle: 0, blink: false, active: false };
  const wave = Math.sin(elapsed / duration * Math.PI * 2);
  return variant === 3 ? { x: 1, y: 1, angle: 0, blink: true, active: true }
    : variant === 2 ? { x: 1 + .015 * wave, y: 1 - .025 * wave, angle: 0, blink: false, active: true }
    : { x: 1 + .008 * wave, y: 1, angle: wave * (variant === 0 ? 1.3 : -1.3), blink: false, active: true };
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
