import { CloseCode, Room, type Client } from '@colyseus/core';
import { randomInt } from 'node:crypto';
import {
  addPlayer, chooseDuel, createGame, isSeriesMode, movePiece, newSeriesVote, readyPlayer, resign,
  restartVote, setConnected, shuffleSetup, swapSetup, viewFor,
  type ActionResult, type FighterKind, type GameState,
} from '../shared/game.js';
import { SERVER_SHUTDOWN_MESSAGE, type ServerShutdown, type Snapshot } from '../shared/protocol.js';
import { RoomChat } from './chat.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCell = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 42;
const isFighter = (value: unknown): value is FighterKind =>
  value === 'rock' || value === 'paper' || value === 'scissors';

/**
 * Colyseus owns seats and transport; the complete board stays exclusively here.
 * Never assign the private GameState to Room.state or broadcast it.
 * Every outbound snapshot is built by viewFor() for its one recipient.
 */
export class RpsRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 40;
  patchRate = null;
  private game!: GameState;
  private reconnectSeconds = 120;
  private shuttingDown = false;
  private readonly chat = new RoomChat();

  override onBeforeShutdown() {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    const message: ServerShutdown = { message: SERVER_SHUTDOWN_MESSAGE };
    for (const client of this.clients) client.send('server_shutdown', message);
    // Close after the terminal message using Colyseus' non-retrying close code.
    // Pending reconnection seats are also discarded by disconnect().
    void this.disconnect(CloseCode.SERVER_SHUTDOWN).catch((error: unknown) => {
      console.error('Ein Spielraum konnte beim Serverstopp nicht geschlossen werden.', error);
    });
  }

  async onCreate(options: { reconnectSeconds?: number; seriesMode?: unknown }) {
    const seriesMode = options.seriesMode === undefined ? 'free' : options.seriesMode;
    if (!isSeriesMode(seriesMode)) throw new Error('Wähle Freies Spiel, Best-of-3 oder Best-of-5.');
    this.game = createGame({ seriesMode, random: () => randomInt(0, 0x100000000) / 0x100000000 });
    this.reconnectSeconds = options.reconnectSeconds ?? 120;
    await this.setMatchmaking({ private: true, unlisted: true });

    this.onMessage('sync', (client) => {
      this.sendView(client);
      this.sendChat(client);
    });
    this.onMessage('chat_send', (client, data: unknown) => this.receiveChat(client, data));
    this.onMessage('shuffle', (client) => this.run(client, () => shuffleSetup(this.game, client.sessionId)));
    this.onMessage('ready', (client) => this.run(client, () => readyPlayer(this.game, client.sessionId)));
    this.onMessage('swap', (client, data: unknown) => {
      if (!isRecord(data) || !isCell(data.from) || !isCell(data.to)) return this.problem(client, 'Ungültige Felder.');
      const { from, to } = data;
      this.run(client, () => swapSetup(this.game, client.sessionId, from, to));
    });
    this.onMessage('move', (client, data: unknown) => {
      if (!isRecord(data) || !isCell(data.from) || !isCell(data.to)) return this.problem(client, 'Ungültiger Zug.');
      if (data.revision !== this.game.revision) return this.problem(client, 'Der Spielstand wurde aktualisiert. Bitte wähle deinen Zug erneut.');
      const { from, to } = data;
      this.run(client, () => movePiece(this.game, client.sessionId, from, to));
    });
    this.onMessage('duel', (client, data: unknown) => {
      if (!isRecord(data) || !isFighter(data.kind)) return this.problem(client, 'Wähle Stein, Papier oder Schere.');
      // Both players can submit concurrently. A global revision check here would
      // incorrectly reject whichever valid choice happened to arrive second.
      const duel = this.game.duel;
      if (!duel || data.duelId !== duel.id || data.round !== duel.round) {
        return this.problem(client, 'Dieses Duell wurde bereits aktualisiert. Bitte wähle erneut.');
      }
      const kind = data.kind;
      this.run(client, () => chooseDuel(this.game, client.sessionId, kind));
    });
    this.onMessage('resign', (client) => this.run(client, () => resign(this.game, client.sessionId)));
    for (const [message, action] of [['restart', restartVote], ['new_series', newSeriesVote]] as const) {
      this.onMessage(message, (client, data: unknown) => {
        if (!isRecord(data) || typeof data.seriesId !== 'string' || typeof data.matchId !== 'string') {
          return this.problem(client, 'Für diese Abstimmung fehlen die aktuelle Spiel- und Serienkennung. Bitte lade die Seite neu.');
        }
        const identity = { seriesId: data.seriesId, matchId: data.matchId };
        this.run(client, () => action(this.game, client.sessionId, identity));
      });
    }
    this.onMessage('*', (client) => this.problem(client, 'Unbekannte Aktion.'));
  }

  async onJoin(client: Client, options: unknown) {
    if (this.shuttingDown) throw new Error(SERVER_SHUTDOWN_MESSAGE);
    const supplied = isRecord(options) && typeof options.name === 'string' ? options.name : '';
    const name = Array.from(supplied.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 24).join('')
      || `Spieler ${this.game.players.length + 1}`;
    const result = addPlayer(this.game, client.sessionId, name);
    if (!result.ok) throw new Error(result.error);
    // Keep the same two seats even after a permanent leave. An invitation must
    // never let a new person take over a departed player's secret army.
    if (this.game.players.length === 2) await this.lock();
    this.sendViews();
    this.sendChat(client);
  }

  onDrop(client: Client) {
    if (this.shuttingDown) return;
    if (!this.game.players.some((player) => player.id === client.sessionId)) return;
    // Also handle a drop during handshake or shutdown, before a seat exists.
    void this.allowReconnection(client, this.reconnectSeconds).catch(() => {});
    setConnected(this.game, client.sessionId, false);
    this.sendViews();
  }

  onReconnect(client: Client) {
    if (this.shuttingDown) return;
    setConnected(this.game, client.sessionId, true);
    this.sendViews();
    this.sendChat(client);
  }

  onLeave(client: Client) {
    // A server restart is not a resignation and must not award a false winner.
    if (this.shuttingDown) return;
    if (!this.game.players.some((player) => player.id === client.sessionId)) return;
    setConnected(this.game, client.sessionId, false);
    if (this.game.players.length === 2 && this.game.phase !== 'finished') resign(this.game, client.sessionId);
    this.sendViews();
  }

  private run(client: Client, action: () => ActionResult) {
    if (this.shuttingDown) return;
    const result = action();
    if (!result.ok) return this.problem(client, result.error);
    this.sendViews();
  }

  private problem(client: Client, message: string) {
    if (this.shuttingDown) return;
    client.send('problem', { message });
    this.sendView(client);
  }

  private sendView(client: Client) {
    if (this.shuttingDown) return;
    if (!this.game.players.some((player) => player.id === client.sessionId)) return;
    const snapshot: Snapshot = {
      ...viewFor(this.game, client.sessionId),
      roomId: this.roomId,
      reconnectSeconds: this.reconnectSeconds,
    };
    client.send('snapshot', snapshot);
  }

  private sendViews() {
    for (const client of this.clients) this.sendView(client);
  }

  private receiveChat(client: Client, data: unknown) {
    if (this.shuttingDown) return;
    const player = this.game.players.find((entry) => entry.id === client.sessionId && entry.connected);
    if (!player || !this.clients.includes(client)) return;
    const result = this.chat.accept(data, { playerId: player.id, playerName: player.name, seat: player.seat });
    if (!result.ok) {
      client.send('chat_problem', result.problem);
    } else if (result.added) {
      for (const recipient of this.clients) this.sendChat(recipient);
    } else {
      this.sendChat(client);
    }
  }

  private sendChat(client: Client) {
    if (this.shuttingDown) return;
    if (!this.game.players.some((player) => player.id === client.sessionId && player.connected)) return;
    client.send('chat', this.chat.state(this.roomId));
  }
}
