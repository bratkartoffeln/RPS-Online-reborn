import { Client, CloseCode, ErrorCode, MatchMakeError, ServerError, type Room } from '@colyseus/sdk';
import { SERVER_SHUTDOWN_MESSAGE as SHUTDOWN_MESSAGE, type Snapshot, type Problem, type ServerShutdown, type ChatState, type ChatProblem } from '../shared/protocol';
import type { SeriesMode } from '../shared/game';

export type NetworkStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'ended';
export type SessionEnd = { reason: 'server_shutdown' | 'session_expired'; message: string };
type Callbacks = {
  onStatus: (status: NetworkStatus) => void;
  onSnapshot: (snapshot: Snapshot) => void;
  onProblem: (message: string) => void;
  onEnded: (end: SessionEnd) => void;
  onChat?: (state: ChatState) => void;
  onChatProblem?: (problem: ChatProblem) => void;
};

const SESSION_PREFIX = 'rps-arena:reconnect:';
const EXPIRED_MESSAGE = 'Dieser Raum oder deine gespeicherte Sitzung ist nicht mehr verfügbar. Die vorige Partie lässt sich nicht fortsetzen. Du kannst eine neue Partie erstellen oder mit einem neuen Link beitreten.';

export function readSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export function writeSession(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* Play remains possible when browser storage is unavailable. */ }
}

function removeSession(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
}

function isInvalidSession(error: unknown): boolean {
  if (error instanceof MatchMakeError || error instanceof ServerError) {
    // The SDK also wraps fetch/proxy errors. Pair the protocol code with the
    // server's specific reply so e.g. an HTTP 524 proxy timeout keeps the token.
    if (error.code === ErrorCode.MATCHMAKE_EXPIRED) {
      return /^(reconnection token invalid or expired\.|seat reservation expired\.|bad reconnection token|already consumed|failed to reconnect)$/.test(error.message);
    }
    if (error.code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) {
      return /^room "[^"]+" (has been disposed\.|not found)$/.test(error.message);
    }
  }
  return error instanceof Error && error.message.startsWith('Invalid reconnection token format.\n');
}

function isServerShutdown(error: unknown): boolean {
  return (error instanceof MatchMakeError || error instanceof ServerError) && error.code === CloseCode.SERVER_SHUTDOWN;
}

function serverEndpoint(): string {
  if (import.meta.env?.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (import.meta.env?.DEV) {
    const endpoint = new URL(window.location.href);
    endpoint.port = '2567';
    return endpoint.origin;
  }
  return window.location.origin;
}

export function roomCodeFrom(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^[A-Za-z0-9_-]{3,64}$/.test(value)) return value;
  try {
    const url = new URL(value, window.location.origin);
    const room = url.searchParams.get('room')?.trim() ?? '';
    return /^[A-Za-z0-9_-]{3,64}$/.test(room) ? room : '';
  } catch { return ''; }
}

export function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  if (/full|maxClients|locked/i.test(raw)) return 'Dieser Raum ist bereits belegt. Für eine Partie gibt es genau zwei Plätze.';
  if (/not found|not exist|expired|seat reservation|not defined|invalid reconnection/i.test(raw)) return 'Dieser Raum oder die gespeicherte Sitzung ist nicht mehr verfügbar. Prüfe den Raumcode oder erstelle eine neue Partie.';
  if (/fetch|network|websocket|ECONN|failed to connect|connection|timeout|timed out/i.test(raw)) return 'Der Spielserver ist gerade nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.';
  return raw && raw !== '[object Object]' ? raw.slice(0, 240) : 'Die Verbindung konnte nicht hergestellt werden. Bitte versuche es erneut.';
}

export class RpsConnection {
  private client = new Client(serverEndpoint());
  private room: Room | null = null;
  private generation = 0;
  private status: NetworkStatus = 'idle';
  roomCode: string | null = null;

  constructor(private callbacks: Callbacks) {}

  private setStatus(status: NetworkStatus): void {
    this.status = status;
    this.callbacks.onStatus(status);
  }

  async create(name: string, seriesMode: SeriesMode = 'free'): Promise<void> {
    const generation = ++this.generation;
    this.setStatus('connecting');
    try {
      const room = await this.client.create('rps', { name, seriesMode });
      if (generation !== this.generation) { await this.closeRoom(room); return; }
      this.attach(room, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      if (isServerShutdown(error)) {
        this.endSession('server_shutdown');
        throw new Error(SHUTDOWN_MESSAGE);
      }
      this.setStatus('idle');
      throw new Error(friendlyError(error));
    }
  }

  async join(roomCode: string, name: string): Promise<void> {
    const generation = ++this.generation;
    this.setStatus('connecting');
    try {
      const room = await this.client.joinById(roomCode, { name });
      if (generation !== this.generation) { await this.closeRoom(room); return; }
      this.attach(room, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      if (isServerShutdown(error) || isInvalidSession(error)) {
        this.endSession(isServerShutdown(error) ? 'server_shutdown' : 'session_expired');
        throw new Error(isServerShutdown(error) ? SHUTDOWN_MESSAGE : EXPIRED_MESSAGE);
      }
      this.setStatus('idle');
      throw new Error(friendlyError(error));
    }
  }

  hasSavedSession(roomCode: string): boolean {
    return !!readSession(SESSION_PREFIX + roomCode);
  }

  async resume(roomCode: string): Promise<boolean> {
    const token = readSession(SESSION_PREFIX + roomCode);
    if (!token) return false;
    const generation = ++this.generation;
    this.roomCode = roomCode;
    this.setStatus('reconnecting');
    try {
      const room = await this.client.reconnect(token);
      if (generation !== this.generation) { await this.closeRoom(room); return false; }
      this.attach(room, generation);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      if (isServerShutdown(error) || isInvalidSession(error)) {
        this.endSession(isServerShutdown(error) ? 'server_shutdown' : 'session_expired');
        throw new Error(isServerShutdown(error) ? SHUTDOWN_MESSAGE : EXPIRED_MESSAGE);
      }
      this.setStatus(this.room ? 'disconnected' : 'idle');
      throw new Error(friendlyError(error));
    }
  }

  send(message: string, data?: unknown): boolean {
    if (!this.room || this.status !== 'connected') return false;
    this.room.send(message, data);
    return true;
  }

  private saveToken(room: Room): void {
    if (room.reconnectionToken) writeSession(SESSION_PREFIX + room.roomId, room.reconnectionToken);
  }

  private attach(room: Room, generation: number): void {
    room.reconnection.minUptime = 0;
    this.room = room;
    this.roomCode = room.roomId;
    this.saveToken(room);
    const current = () => generation === this.generation && this.room === room;

    room.onMessage<Snapshot>('snapshot', (snapshot) => {
      if (!current()) return;
      this.saveToken(room);
      this.callbacks.onSnapshot(snapshot);
    });
    room.onMessage<Problem>('problem', (problem) => {
      if (current()) this.callbacks.onProblem(problem.message || 'Diese Aktion ist gerade nicht möglich.');
    });
    room.onMessage<ChatState>('chat', (state) => {
      if (current() && state.roomId === room.roomId) this.callbacks.onChat?.(state);
    });
    room.onMessage<ChatProblem>('chat_problem', (problem) => {
      if (current()) this.callbacks.onChatProblem?.(problem);
    });
    room.onMessage<ServerShutdown>('server_shutdown', (shutdown) => {
      if (current()) this.endSession('server_shutdown', shutdown?.message);
    });
    room.onDrop((code) => {
      if (current() && code === CloseCode.SERVER_SHUTDOWN) {
        this.endSession('server_shutdown');
        return;
      }
      if (current()) this.setStatus('reconnecting');
    });
    room.onReconnect(() => {
      if (!current()) return;
      // The server rotates this token after every successful reconnection.
      // SDK 0.18 dispatches onReconnect before assigning the new token.
      queueMicrotask(() => {
        if (!current()) return;
        this.saveToken(room);
        this.setStatus('connected');
        room.send('sync');
      });
    });
    room.onLeave((code) => {
      if (!current()) return;
      if (code === CloseCode.SERVER_SHUTDOWN) {
        this.endSession('server_shutdown');
        return;
      }
      this.room = null;
      this.setStatus('disconnected');
    });
    room.onError((code, message) => {
      if (!current()) return;
      if (code === CloseCode.SERVER_SHUTDOWN) {
        this.endSession('server_shutdown');
        return;
      }
      if (message && isInvalidSession(new ServerError(code, message))) {
        this.endSession('session_expired');
        return;
      }
      if (message) this.callbacks.onProblem(friendlyError(new Error(message)));
    });
    this.setStatus('connected');
    // This also recovers a snapshot sent before handlers could be attached.
    room.send('sync');
  }

  private endSession(reason: SessionEnd['reason'], message?: string): void {
    const room = this.room;
    this.generation += 1;
    this.room = null;
    if (this.roomCode) removeSession(SESSION_PREFIX + this.roomCode);
    this.roomCode = null;
    const fallback = reason === 'server_shutdown' ? SHUTDOWN_MESSAGE : EXPIRED_MESSAGE;
    const detail = typeof message === 'string' && message.trim() ? message.slice(0, 500) : fallback;
    this.callbacks.onEnded({ reason, message: detail });
    this.setStatus('ended');
    if (room) void this.closeRoom(room).catch(() => {});
  }

  async leave(): Promise<void> {
    const room = this.room;
    this.generation += 1;
    this.room = null;
    if (this.roomCode) removeSession(SESSION_PREFIX + this.roomCode);
    this.roomCode = null;
    this.setStatus('idle');
    if (room) await this.closeRoom(room);
  }

  private async closeRoom(room: Room): Promise<void> {
    room.reconnection.enabled = false;
    // A retry may already have been scheduled before reconnect was disabled.
    room.onReconnect.once(() => { void room.leave(true).catch(() => {}); });
    // Waiting for leave() on a socket which is already closed never resolves.
    if (room.connection.isOpen) await room.leave(true);
  }
}
