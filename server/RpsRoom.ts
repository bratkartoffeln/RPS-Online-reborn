
import { CloseCode, Room, type Client } from '@colyseus/core';
import { randomInt, randomUUID } from 'node:crypto';
import { CPU_OPPONENTS, isCpuDifficulty, type CpuDifficulty } from '../shared/cpu.js';
import { CpuBrain } from './cpu.js';
import {
  addPlayer, chooseDuel, createGame, isSeriesMode, leavePlayer, movePiece,
  newSeriesVote, readyPlayer, resign, restartVote, setConnected,
  shuffleSetup, swapSetup, viewFor,
  type ActionResult, type FighterKind, type GameState,
} from '../shared/game.js';
import {
  SERVER_SHUTDOWN_MESSAGE,
  type ServerShutdown,
  type Snapshot,
} from '../shared/protocol.js';
import { RoomChat } from './chat.js';
import {
  beginRoomCreation,
  endRoomCreation,
} from './deployGate.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCell = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < 42;

const isFighter = (value: unknown): value is FighterKind =>
  value === 'rock' || value === 'paper' || value === 'scissors';

/**
 * Colyseus owns seats and transport; the complete board stays
 * exclusively here.
 * Never assign the private GameState to Room.state or broadcast it.
 * Every outbound snapshot is built by viewFor() for its one recipient.
 */
export class RpsRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 40;
  patchRate = null;

  private game!: GameState;
  private reconnectSeconds = 20;
  private shuttingDown = false;
  private deployGateRegistered = false;
  private readonly chat = new RoomChat();
  private cpuDifficulty?: CpuDifficulty;
  private cpu?: CpuBrain;
  private cpuId = `cpu-${randomUUID()}`;
  private cpuTimer?: { clear(): void };
  private cpuTask = '';

  private cancelCpu(): void {
    this.cpuTimer?.clear();
    this.cpuTimer = undefined;
    this.cpuTask = '';
  }

  private scheduleCpu(): void {
    if (!this.cpu || this.shuttingDown) return;
    const view = viewFor(this.game, this.cpuId);
    this.cpu.observe(view);
    const player = view.players.find(entry => entry.id === this.cpuId);
    const human = view.players.find(entry => entry.id !== this.cpuId);
    let action: (() => ActionResult) | undefined;
    let task = '';
    if (player && human && view.players.every(entry => entry.connected)) {
      if (view.phase === 'setup' && !player.ready) {
        task = 'ready';
        action = () => readyPlayer(this.game, this.cpuId);
      } else if (view.phase === 'playing' && view.currentTurn === this.cpuId) {
        task = `move:${view.turnNumber}`;
        action = () => {
          const move = this.cpu!.chooseMove(viewFor(this.game, this.cpuId));
          return move ? movePiece(this.game, this.cpuId, move.from, move.to) : { ok: false, error: 'Kein CPU-Zug.' };
        };
      } else if (view.phase === 'duel' && view.duel && !view.duel.choiceLocked[this.cpuId]) {
        task = `duel:${view.duel.id}:${view.duel.round}`;
        action = () => chooseDuel(this.game, this.cpuId, this.cpu!.chooseDuel());
      } else if (view.phase === 'finished' && (human.restartRequested || human.newSeriesRequested)) {
        task = human.newSeriesRequested ? 'new_series' : 'restart';
        const identity = { seriesId: view.series.id, matchId: view.series.matchId };
        action = () => (human.newSeriesRequested ? newSeriesVote : restartVote)(this.game, this.cpuId, identity);
      }
    }
    const key = task ? `${view.series.matchId}:${task}` : '';
    if (key === this.cpuTask) return;
    this.cancelCpu();
    if (!action) return;
    this.cpuTask = key;
    this.cpuTimer = this.clock.setTimeout(() => {
      this.cpuTimer = undefined;
      this.cpuTask = '';
      if (this.shuttingDown) return;
      const result = action!();
      if (result.ok) this.sendViews();
    }, this.cpu.delay(view.phase));
  }

  override onBeforeShutdown() {
    if (this.shuttingDown) return;

    this.shuttingDown = true;
    this.cancelCpu();

    const message: ServerShutdown = {
      message: SERVER_SHUTDOWN_MESSAGE,
    };

    for (const client of this.clients) {
      client.send('server_shutdown', message);
    }

    // Close after the terminal message using Colyseus'
    // non-retrying close code.
    // Pending reconnection seats are also discarded by disconnect().
    void this.disconnect(CloseCode.SERVER_SHUTDOWN).catch(
      (error: unknown) => {
        console.error(
          'Ein Spielraum konnte beim Serverstopp nicht geschlossen werden.',
          error,
        );
      },
    );
  }

  async onCreate(options: {
    reconnectSeconds?: number;
    seriesMode?: unknown;
    cpuDifficulty?: unknown;
  }) {
    const seriesMode =
      options.seriesMode === undefined
        ? 'free'
        : options.seriesMode;

    if (!isSeriesMode(seriesMode)) {
      throw new Error(
        'Wähle Freies Spiel, Best-of-3 oder Best-of-5.',
      );
    }

    if (options.cpuDifficulty !== undefined) {
      if (!isCpuDifficulty(options.cpuDifficulty)) throw new Error('Wähle Einfach, Mittel oder Schwer.');
      this.cpuDifficulty = options.cpuDifficulty;
      this.cpu = new CpuBrain(options.cpuDifficulty);
      this.maxClients = 1;
    }

    // Neue Räume nur außerhalb eines Deployments zulassen.
    // Die Registrierung bleibt bis zur Raumauflösung aktiv.
    beginRoomCreation();
    this.deployGateRegistered = true;

    try {
      this.game = createGame({
        seriesMode,
        random: () => randomInt(0, 0x100000000) / 0x100000000,
      });

      this.reconnectSeconds = options.reconnectSeconds ?? 20;

      await this.setMatchmaking({
        private: true,
        unlisted: true,
      });

      this.onMessage('sync', (client) => {
        this.sendView(client);
        this.sendChat(client);
      });

      this.onMessage('chat_send', (client, data: unknown) =>
        this.receiveChat(client, data),
      );

      this.onMessage('shuffle', (client) =>
        this.run(client, () =>
          shuffleSetup(this.game, client.sessionId),
        ),
      );

      this.onMessage('ready', (client) =>
        this.run(client, () =>
          readyPlayer(this.game, client.sessionId),
        ),
      );

      this.onMessage('swap', (client, data: unknown) => {
        if (
          !isRecord(data) ||
          !isCell(data.from) ||
          !isCell(data.to)
        ) {
          return this.problem(client, 'Ungültige Felder.');
        }

        const { from, to } = data;

        this.run(client, () =>
          swapSetup(this.game, client.sessionId, from, to),
        );
      });

      this.onMessage('move', (client, data: unknown) => {
        if (
          !isRecord(data) ||
          !isCell(data.from) ||
          !isCell(data.to)
        ) {
          return this.problem(client, 'Ungültiger Zug.');
        }

        if (data.revision !== this.game.revision) {
          return this.problem(
            client,
            'Der Spielstand wurde aktualisiert. Bitte wähle deinen Zug erneut.',
          );
        }

        const { from, to } = data;

        this.run(client, () =>
          movePiece(this.game, client.sessionId, from, to),
        );
      });

      this.onMessage('duel', (client, data: unknown) => {
        if (!isRecord(data) || !isFighter(data.kind)) {
          return this.problem(
            client,
            'Wähle Stein, Papier oder Schere.',
          );
        }

        // Both players can submit concurrently. A global revision
        // check here would incorrectly reject whichever valid choice
        // happened to arrive second.
        const duel = this.game.duel;

        if (
          !duel ||
          data.duelId !== duel.id ||
          data.round !== duel.round
        ) {
          return this.problem(
            client,
            'Dieses Duell wurde bereits aktualisiert. Bitte wähle erneut.',
          );
        }

        const kind = data.kind;

        this.run(client, () =>
          chooseDuel(this.game, client.sessionId, kind),
        );
      });

      this.onMessage('resign', (client) =>
        this.run(client, () =>
          resign(this.game, client.sessionId),
        ),
      );

      for (const [message, action] of [
        ['restart', restartVote],
        ['new_series', newSeriesVote],
      ] as const) {
        this.onMessage(message, (client, data: unknown) => {
          if (
            !isRecord(data) ||
            typeof data.seriesId !== 'string' ||
            typeof data.matchId !== 'string'
          ) {
            return this.problem(
              client,
              'Für diese Abstimmung fehlen die aktuelle Spiel- und Serienkennung. Bitte lade die Seite neu.',
            );
          }

          const identity = {
            seriesId: data.seriesId,
            matchId: data.matchId,
          };

          this.run(client, () =>
            action(this.game, client.sessionId, identity),
          );
        });
      }

      this.onMessage('*', (client) =>
        this.problem(client, 'Unbekannte Aktion.'),
      );
    } catch (error) {
      // Registrierung bei fehlgeschlagener Initialisierung aufheben.
      this.releaseDeployGate();
      throw error;
    }
  }

  /**
   * Wird aufgerufen, wenn Colyseus den Raum auflöst.
   * Auch Wiederverbindungsfristen sind damit berücksichtigt.
   */
  onDispose() {
    this.cancelCpu();
    this.releaseDeployGate();
  }

  /**
   * Raumregistrierung genau einmal freigeben.
   */
  private releaseDeployGate(): void {
    if (!this.deployGateRegistered) return;

    this.deployGateRegistered = false;
    endRoomCreation();
  }

  async onJoin(client: Client, options: unknown) {
    if (this.shuttingDown) {
      throw new Error(SERVER_SHUTDOWN_MESSAGE);
    }

    const supplied =
      isRecord(options) && typeof options.name === 'string'
        ? options.name
        : '';

    const name =
      Array.from(
        supplied.replace(/[\u0000-\u001f\u007f]/g, '').trim(),
      ).slice(0, 24).join('') ||
      `Spieler ${this.game.players.length + 1}`;

    const result = addPlayer(
      this.game,
      client.sessionId,
      name,
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    if (this.cpuDifficulty && this.game.players.length === 1) {
      addPlayer(this.game, this.cpuId, CPU_OPPONENTS[this.cpuDifficulty].name);
    }

    // Keep the same two seats even after a permanent leave.
    // An invitation must never let a new person take over
    // a departed player's secret army.
    if (this.game.players.length === 2) {
      await this.lock();
    }

    this.sendViews();
    this.sendChat(client);
  }

  onDrop(client: Client) {
    if (this.shuttingDown) return;

    if (
      !this.game.players.some(
        (player) => player.id === client.sessionId,
      )
    ) {
      return;
    }

    // Also handle a drop during handshake or shutdown,
    // before a seat exists.
    void this.allowReconnection(
      client,
      this.reconnectSeconds,
    ).catch(() => {});

    setConnected(
      this.game,
      client.sessionId,
      false,
    );

    this.sendViews();
  }

  onReconnect(client: Client) {
    if (this.shuttingDown) return;

    setConnected(
      this.game,
      client.sessionId,
      true,
    );

    this.sendViews();
    this.sendChat(client);
  }

  onLeave(client: Client) {
    // A server restart is not a resignation
    // and must not award a false winner.
    if (this.shuttingDown) return;

    if (
      !this.game.players.some(
        (player) => player.id === client.sessionId,
      )
    ) {
      return;
    }

    leavePlayer(this.game, client.sessionId);

    this.sendViews();
  }

  private run(
    client: Client,
    action: () => ActionResult,
  ) {
    if (this.shuttingDown) return;

    const result = action();

    if (!result.ok) {
      return this.problem(client, result.error);
    }

    this.sendViews();
  }

  private problem(client: Client, message: string) {
    if (this.shuttingDown) return;

    client.send('problem', { message });
    this.sendView(client);
  }

  private sendView(client: Client) {
    if (this.shuttingDown) return;

    if (
      !this.game.players.some(
        (player) => player.id === client.sessionId,
      )
    ) {
      return;
    }

    const snapshot: Snapshot = {
      ...viewFor(this.game, client.sessionId),
      roomId: this.roomId,
      reconnectSeconds: this.reconnectSeconds,
      ...(this.cpuDifficulty ? { cpuDifficulty: this.cpuDifficulty } : {}),
    };

    client.send('snapshot', snapshot);
  }

  private sendViews() {
    for (const client of this.clients) {
      this.sendView(client);
    }
    this.scheduleCpu();
  }

  private receiveChat(client: Client, data: unknown) {
    if (this.shuttingDown) return;

    const player = this.game.players.find(
      (entry) =>
        entry.id === client.sessionId &&
        entry.connected,
    );

    if (!player || !this.clients.includes(client)) {
      return;
    }

    const result = this.chat.accept(data, {
      playerId: player.id,
      playerName: player.name,
      seat: player.seat,
    });

    if (!result.ok) {
      client.send('chat_problem', result.problem);
    } else if (result.added) {
      for (const recipient of this.clients) {
        this.sendChat(recipient);
      }
    } else {
      this.sendChat(client);
    }
  }

  private sendChat(client: Client) {
    if (this.shuttingDown) return;

    if (
      !this.game.players.some(
        (player) =>
          player.id === client.sessionId &&
          player.connected,
      )
    ) {
      return;
    }

    client.send('chat', this.chat.state(this.roomId));
  }
}
