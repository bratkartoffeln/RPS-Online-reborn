import type { FighterKind, GameView, MatchIdentity, SeriesMode } from './game.js';

export type Snapshot = GameView & { roomId: string; reconnectSeconds: number };
export interface Problem { message: string }
/** Terminal event: this server's in-memory match will not be recoverable. */
export interface ServerShutdown { message: string }
export const SERVER_SHUTDOWN_MESSAGE = 'Der Spielserver wird neu gestartet. Diese Partie ist beendet. Sobald der Server wieder erreichbar ist, kannst du einen neuen Raum erstellen.';
export interface MoveMessage { from: number; to: number; revision: number }
export interface DuelMessage { kind: FighterKind; duelId: string; round: number }
export interface CreateRoomOptions { name: string; seriesMode?: SeriesMode }
/** Used by both restart and new_series; both players may vote from one snapshot. */
export type ContinuationMessage = MatchIdentity;
