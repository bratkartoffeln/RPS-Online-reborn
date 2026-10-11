import type { FighterKind, GameView } from './game.js';

export type Snapshot = GameView & { roomId: string; reconnectSeconds: number };
export interface Problem { message: string }
export interface MoveMessage { from: number; to: number; revision: number }
export interface DuelMessage { kind: FighterKind; duelId: string; round: number }
