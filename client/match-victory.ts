import type { GameView } from '../shared/game';
import { captureMotionFrame } from './board-motion';

/** Celebrate a newly confirmed match winner, never a restored result or a replayed sync. */
export function freshVictory(previous: GameView | null, next: GameView | null): string | null {
  if (!previous || !next || !next.winner || next.phase !== 'finished' ||
      (previous.phase !== 'playing' && previous.phase !== 'duel') ||
      next.revision !== previous.revision + 1 ||
      previous.series.id !== next.series.id || previous.series.matchId !== next.series.matchId ||
      !next.players.some((player) => player.id === next.winner)) return null;
  const before = captureMotionFrame(previous)!;
  const after = captureMotionFrame(next)!;
  if (before.identity !== after.identity || !before.connected || !after.connected ||
      before.paused || after.paused) return null;
  return next.winner;
}
