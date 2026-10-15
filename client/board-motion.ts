import type { GameActionView, GamePhase, GameView } from '../shared/game';
import type { ArtworkVariant, SkinAnimationState, SkinDefinition, SkinPiece, TeamColor } from './skin-types';
import { legacyTeamForColor, teamColorForSeat } from './team-ui';

/** Only identity/positions are retained. Rendering always reads the new public DTO. */
export interface MotionFrame {
  identity: string;
  signature: string;
  revision: number;
  phase: GamePhase;
  paused: boolean;
  connected: boolean;
  actionId: number | null;
  cells: Array<{ id: string; owner: string } | null>;
}

export function captureMotionFrame(view: GameView | null): MotionFrame | null {
  if (!view) return null;
  const roomId = (view as GameView & { roomId?: string }).roomId ?? null;
  const people = view.players.map((p) => [p.id, p.seat]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const identity = JSON.stringify([roomId, view.you, people]);
  const connected = view.players.length === 2 && view.players.every((p) => p.connected);
  const cells = view.board.map((piece) => piece ? { id: piece.id, owner: piece.owner } : null);
  const actionId = view.lastAction?.id ?? null;
  return {
    identity, revision: view.revision, phase: view.phase, paused: view.paused,
    connected, actionId, cells,
    signature: JSON.stringify([identity, view.revision, view.phase, view.paused, connected, actionId, cells]),
  };
}

export function sameMotionFrame(a: MotionFrame | null, b: MotionFrame | null): boolean {
  return a?.signature === b?.signature;
}

export function canContinueEffect(previous: MotionFrame | null, next: MotionFrame | null): boolean {
  return !!previous && !!next && previous.identity === next.identity &&
    previous.connected && next.connected && !previous.paused && !next.paused &&
    previous.phase === next.phase && previous.actionId === next.actionId &&
    next.revision >= previous.revision && next.revision <= previous.revision + 1 &&
    JSON.stringify(previous.cells) === JSON.stringify(next.cells);
}

function adjacent(from: number, to: number): boolean {
  return Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= 0 && from < 42 && to < 42 &&
    Math.abs(from % 7 - to % 7) + Math.abs(Math.floor(from / 7) - Math.floor(to / 7)) === 1;
}

/** One event, exactly once, only across an uninterrupted adjacent snapshot. */
export function freshActionFromFrame(previous: MotionFrame | null, next: GameView | null): GameActionView | null {
  if (!previous || !next) return null;
  const frame = captureMotionFrame(next)!;
  const action = next.lastAction;
  if (!action || previous.identity !== frame.identity || !previous.connected || !frame.connected ||
      previous.paused || frame.paused || next.revision !== previous.revision + 1 ||
      action.id !== next.revision || action.id === previous.actionId ||
      (previous.phase !== 'playing' && previous.phase !== 'duel') ||
      (next.phase !== 'playing' && next.phase !== 'duel' && next.phase !== 'finished') ||
      !adjacent(action.from, action.to)) return null;
  const beforeAttacker = previous.cells[action.from];
  if (beforeAttacker?.id !== action.attacker.id || beforeAttacker.owner !== action.attacker.owner) return null;
  if (action.defender) {
    const beforeDefender = previous.cells[action.to];
    if (beforeDefender?.id !== action.defender.id || beforeDefender.owner !== action.defender.owner) return null;
  }
  if (action.kind !== 'move' && (!action.defender || action.attacker.kind === null || !action.attacker.revealed ||
      action.defender.kind === null || !action.defender.revealed)) return null;
  return action;
}

/** Shared by board effects and optional audio so reconnects never replay either. */
export function freshAction(previous: GameView | null, next: GameView | null): GameActionView | null {
  return freshActionFromFrame(captureMotionFrame(previous), next);
}

export function artworkForPiece(skin: SkinDefinition, own: boolean, kind: SkinPiece | null, revealed = false, color: TeamColor = own ? 'blue' : 'red'): ArtworkVariant | undefined {
  // Never derive a hidden kind from an ID, a former frame or the opposing mapping.
  const piece = kind ?? 'unknown';
  const artwork = skin.teamPieces?.[color]?.[own ? 'own' : 'enemy']?.[piece] ?? skin.pieces?.[legacyTeamForColor(color)]?.[piece];
  return revealed === true && kind !== null && kind !== 'unknown' && artwork?.revealed ? artwork.revealed : artwork;
}

export interface FlagVictory { pieceId: string; ownerId: string; frame: string }

/** Derive the persistent pose from the final public capture, never from a former match or camera direction. */
export function flagVictoryForView(skin: SkinDefinition, view: GameView | null): FlagVictory | null {
  if (!view || view.phase !== 'finished' || view.finishReason !== 'flag') return null;
  const action = view.lastAction;
  if (!action || action.kind !== 'battle' || action.outcome !== 'flag' ||
      !action.attacker.revealed || !['rock', 'paper', 'scissors'].includes(action.attacker.kind ?? '') ||
      action.defender?.kind !== 'flag' || !action.defender.revealed ||
      action.attacker.owner === action.defender.owner || action.winnerId !== action.attacker.id ||
      view.winner !== action.attacker.owner || !action.removedIds.includes(action.defender.id) ||
      action.removedIds.includes(action.attacker.id)) return null;
  const survivor = view.board[action.to];
  const winner = view.players.find((player) => player.id === action.attacker.owner);
  if (!winner || survivor?.id !== action.attacker.id || survivor.owner !== winner.id) return null;
  const frame = skin.flagVictoryFrames?.[teamColorForSeat(winner.seat)];
  return frame && skin.atlas?.frames[frame] ? { pieceId: survivor.id, ownerId: winner.id, frame } : null;
}

export function oneShotState(state: SkinAnimationState): boolean {
  return state === 'move' || state === 'attack' || state === 'win' || state === 'lose';
}

export function artworkFrame(artwork: ArtworkVariant, state: SkinAnimationState, elapsedMs: number, enabled: boolean): string {
  if (!enabled) return artwork.frame;
  const clip = artwork.animations?.[state] ?? (oneShotState(state) ? undefined : artwork.animations?.idle);
  if (!clip?.frames.length || !Number.isFinite(clip.fps) || clip.fps <= 0) return artwork.frame;
  const offset = Math.floor(Math.max(0, elapsedMs) * clip.fps / 1000);
  const index = oneShotState(state) ? Math.min(offset, clip.frames.length - 1) : offset % clip.frames.length;
  return clip.frames[index];
}

export function clipDuration(artwork: ArtworkVariant | undefined, state: SkinAnimationState): number {
  const clip = artwork?.animations?.[state];
  return clip?.frames.length && Number.isFinite(clip.fps) && clip.fps > 0 ? clip.frames.length * 1000 / clip.fps : 0;
}

export function smoothStep(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * (3 - 2 * p);
}

export const NINJA_SPEED_FACTOR = 2;
export const FACEOFF_HOLD_MS = 550;
export function combatFacingFrame(skin: SkinDefinition, color: TeamColor, facing: 'left' | 'right'): string | null {
  // Symbol-based designs keep their normal board symbols in the same staging positions.
  if (skin.presentation !== 'retro') return null;
  const name = `battle-${color}-${facing}`;
  return skin.atlas?.frames[name] ? name : null;
}

/** Screen-space staging also handles vertical attacks and a rotated board. */
export function combatStaging(from: { x: number; y: number }, to: { x: number; y: number }) {
  const attackerLeft = from.x !== to.x ? from.x < to.x : from.y > to.y;
  return {
    attacker: { x: to.x + (attackerLeft ? -25 : 25), y: to.y, facing: attackerLeft ? 'right' as const : 'left' as const },
    defender: { x: to.x + (attackerLeft ? 25 : -25), y: to.y, facing: attackerLeft ? 'left' as const : 'right' as const },
  };
}

const CELEBRATION_HOP_MS = 340;
const CELEBRATION_STAGGER_MS = 24;
const CELEBRATION_GROUPS = 5;
export const CELEBRATION_MS = CELEBRATION_HOP_MS * 2 + CELEBRATION_STAGGER_MS * (CELEBRATION_GROUPS - 1);

/** An absolute world-space offset: two hops, then exactly the original position. */
export function celebrationOffset(elapsedMs: number, ordinal: number): number {
  const local = elapsedMs - (ordinal % CELEBRATION_GROUPS) * CELEBRATION_STAGGER_MS;
  if (!(local > 0 && local < CELEBRATION_HOP_MS * 2)) return 0;
  const progress = (local % CELEBRATION_HOP_MS) / CELEBRATION_HOP_MS;
  const height = local < CELEBRATION_HOP_MS ? 16 : 13;
  return progress === 0 ? 0 : -height * 4 * progress * (1 - progress);
}

const FLAG_CELEBRATION_HOP_MS = 420;
export const FLAG_CELEBRATION_MS = FLAG_CELEBRATION_HOP_MS * 4;

/** Four shared takeoffs/landings; the happy capturer jumps slightly higher with its army. */
export function flagCelebrationOffset(elapsedMs: number, hero = false): number {
  if (!(elapsedMs > 0 && elapsedMs < FLAG_CELEBRATION_MS)) return 0;
  const hop = Math.floor(elapsedMs / FLAG_CELEBRATION_HOP_MS);
  const progress = (elapsedMs % FLAG_CELEBRATION_HOP_MS) / FLAG_CELEBRATION_HOP_MS;
  const height = (hero ? 24 : 16) - hop * (hero ? 2 : 1);
  return progress === 0 ? 0 : -height * 4 * progress * (1 - progress);
}
