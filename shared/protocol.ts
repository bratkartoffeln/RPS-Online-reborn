import type { FighterKind, GameView, MatchIdentity, SeriesMode } from './game.js';
import type { CpuDifficulty } from './cpu.js';

export type Snapshot = GameView & { roomId: string; reconnectSeconds: number; cpuDifficulty?: CpuDifficulty };
export interface Problem { message: string }
/** Room chat is independent of snapshots, game revisions and private choices. */
export interface ChatSendMessage { requestId: string; text: string }
export interface ChatMessage {
  id: number;
  requestId: string;
  playerId: string;
  playerName: string;
  seat: 0 | 1;
  text: string;
  sentAt: number;
}
export interface ChatState { roomId: string; messages: ChatMessage[] }
export interface ChatProblem { requestId?: string; message: string }
/** Terminal event: this server's in-memory match will not be recoverable. */
export interface ServerShutdown { message: string }
export const SERVER_SHUTDOWN_MESSAGE = 'Der Spielserver wird neu gestartet. Diese Partie ist beendet. Sobald der Server wieder erreichbar ist, kannst du einen neuen Raum erstellen.';
export interface MoveMessage { from: number; to: number; revision: number }
export interface DuelMessage { kind: FighterKind; duelId: string; round: number }
export interface CreateRoomOptions { name: string; seriesMode?: SeriesMode; cpuDifficulty?: CpuDifficulty }
/** Used by both restart and new_series; both players may vote from one snapshot. */
export type ContinuationMessage = MatchIdentity;
/** The human client has finished presenting the current CPU turn announcement. */
export type CpuTurnReadyMessage = MatchIdentity & { turnNumber: number };
