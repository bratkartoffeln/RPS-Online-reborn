import assert from 'node:assert/strict';
import test from 'node:test';
import { matchMaker } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { startServer } from '../server/app.js';
import type { RoomChat } from '../server/chat.js';
import { CHAT_MIN_INTERVAL_MS } from '../shared/chat.js';
import type { GameState } from '../shared/game.js';
import type { ChatProblem, ChatState, ContinuationMessage, Snapshot } from '../shared/protocol.js';
import { stageRock } from './helpers/rock-setup.js';

async function until(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timeout: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function observe(room: Room) {
  const observer = {
    room,
    snapshot: undefined as Snapshot | undefined,
    chat: undefined as ChatState | undefined,
    snapshotUpdates: 0,
    chatUpdates: 0,
    problems: [] as string[],
    chatProblems: [] as ChatProblem[],
    shutdowns: [] as string[],
    sendDuringShutdown: false,
    async wait(predicate: (view: Snapshot) => boolean): Promise<Snapshot> {
      await until(() => !!observer.snapshot && predicate(observer.snapshot), 'Spielstand erhalten');
      return observer.snapshot!;
    },
    async waitChat(predicate: (state: ChatState) => boolean): Promise<ChatState> {
      await until(() => !!observer.chat && predicate(observer.chat), 'Chatverlauf erhalten');
      return observer.chat!;
    },
  };
  room.onMessage('snapshot', (value: Snapshot) => { observer.snapshot = value; observer.snapshotUpdates++; });
  room.onMessage('chat', (value: ChatState) => { observer.chat = value; observer.chatUpdates++; });
  room.onMessage('chat_problem', (value: ChatProblem) => observer.chatProblems.push(value));
  room.onMessage('problem', (value: { message: string }) => observer.problems.push(value.message));
  room.onMessage('server_shutdown', (value: { message: string }) => {
    observer.shutdowns.push(value.message);
    if (observer.sendDuringShutdown && room.connection.isOpen) {
      room.send('chat_send', { requestId: 'after-shutdown', text: 'Darf nicht mehr angenommen werden.' });
    }
  });
  room.onError(() => {});
  // Deliberately no sync here: joins and reconnects must supply chat themselves.
  return observer;
}

type Observer = ReturnType<typeof observe>;
const identity = (observer: Observer): ContinuationMessage => ({
  seriesId: observer.snapshot!.series.id,
  matchId: observer.snapshot!.series.matchId,
});

async function waitInterval(observer: Observer): Promise<void> {
  const last = [...observer.chat!.messages].reverse().find((message) => message.playerId === observer.room.sessionId);
  if (last) await until(() => Date.now() - last.sentAt >= CHAT_MIN_INTERVAL_MS, 'Chat-Mindestabstand');
}

async function sendChat(sender: Observer, recipients: Observer[], requestId: string, text: string): Promise<void> {
  await waitInterval(sender);
  sender.room.send('chat_send', { requestId, text });
  await Promise.all(recipients.map((observer) => observer.waitChat((state) =>
    state.messages.some((message) => message.playerId === sender.room.sessionId && message.requestId === requestId))));
}

async function sync(observer: Observer): Promise<void> {
  const snapshots = observer.snapshotUpdates;
  const chats = observer.chatUpdates;
  observer.room.send('sync');
  await until(() => observer.snapshotUpdates > snapshots && observer.chatUpdates > chats, 'Getrennte Spiel- und Chat-Synchronisierung');
}

test('real room chat authenticates senders, stays separate from gameplay and survives room continuations', { timeout: 25000 }, async (context) => {
  const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 4 });
  const client = new Client(server.url);
  const rooms: Room[] = [];
  try {
    let a = observe(await client.create('rps', { name: ' Alice\u0000 ' }));
    rooms.push(a.room);
    await Promise.all([a.wait((view) => view.phase === 'waiting'), a.waitChat((chat) => chat.messages.length === 0)]);
    const localRoom = matchMaker.getLocalRoomById(a.room.roomId) as unknown as { game: GameState; chat: RoomChat };
    const aId = a.room.sessionId;

    await context.test('the server supplies all authorship fields and never revises the game for chat', async () => {
      const game = structuredClone(localRoom.game);
      const snapshots = a.snapshotUpdates;
      const earliest = Date.now();
      a.room.send('chat_send', {
        requestId: 'greeting', text: '  Hallo\nzusammen!\u0000 ', playerId: 'intruder', playerName: 'Admin',
        seat: 1, id: 9000, sentAt: 1, roomId: 'other-room', revision: -1, choices: { hidden: 'rock' },
      });
      const state = await a.waitChat((chat) => chat.messages.length === 1);
      const message = state.messages[0];
      assert.equal(state.roomId, a.room.roomId);
      assert.deepEqual(Object.keys(state).sort(), ['messages', 'roomId']);
      assert.deepEqual(Object.keys(message).sort(), ['id', 'playerId', 'playerName', 'requestId', 'seat', 'sentAt', 'text']);
      assert.deepEqual({ ...message, sentAt: 0 }, {
        id: 1, requestId: 'greeting', playerId: aId, playerName: 'Alice', seat: 0, text: 'Hallo zusammen!', sentAt: 0,
      });
      assert.ok(message.sentAt >= earliest && message.sentAt <= Date.now());
      assert.deepEqual(structuredClone(localRoom.game), game);
      assert.equal(a.snapshotUpdates, snapshots);
      assert.equal('chat' in a.snapshot!, false);
      assert.equal('messages' in a.snapshot!, false);
    });

    const b = observe(await client.joinById(a.room.roomId, { name: 'Bob' }));
    rooms.push(b.room);
    await Promise.all([a, b].map((observer) => observer.wait((view) => view.players.length === 2)));
    const bId = b.room.sessionId;
    const separate = observe(await client.create('rps', { name: 'Other room' }));
    rooms.push(separate.room);

    await context.test('a joining player receives prior messages and another room starts with independent history', async () => {
      await b.waitChat((state) => state.messages.length === 1);
      assert.deepEqual(a.chat, b.chat);
      await separate.waitChat((state) => state.messages.length === 0);
      assert.notEqual(separate.chat!.roomId, a.chat!.roomId);
      await sendChat(separate, [separate], 'greeting', 'Nur im anderen Raum.');
      assert.equal(separate.chat!.messages[0].id, 1);
      assert.equal(a.chat!.messages.length, 1);
      assert.equal(b.chat!.messages.length, 1);
    });

    await context.test('invalid or oversized input produces chat-only errors and leaves both views and histories unchanged', async () => {
      const game = structuredClone(localRoom.game);
      const histories = [structuredClone(a.chat), structuredClone(b.chat)];
      const snapshots = [a.snapshotUpdates, b.snapshotUpdates];
      for (const payload of [
        null, [], { requestId: '<bad>', text: 'Text' }, { requestId: 'x'.repeat(65), text: 'Text' },
        { requestId: 'bad-type', text: 15 }, { requestId: 'empty', text: '\t\r\n\u0000' },
        { requestId: 'long', text: '🪨'.repeat(301) },
      ]) {
        const errors = a.chatProblems.length;
        a.room.send('chat_send', payload);
        await until(() => a.chatProblems.length > errors, 'Ungültige Chatnachricht abgelehnt');
      }
      assert.ok(a.chatProblems.slice(0, 4).every((problem) => !('requestId' in problem)));
      assert.equal(a.chatProblems.at(-1)!.requestId, 'long');
      assert.match(a.chatProblems.at(-1)!.message, /300/);
      assert.deepEqual([a.chat, b.chat], histories);
      assert.deepEqual([a.snapshotUpdates, b.snapshotUpdates], snapshots);
      assert.deepEqual(structuredClone(localRoom.game), game);
      assert.deepEqual([a.problems, b.problems, b.chatProblems], [[], [], []]);
    });

    await context.test('300 emoji are accepted, rapid messages are rejected, and retained request IDs deduplicate per player', async () => {
      const text = '🪨'.repeat(300);
      await sendChat(b, [a, b], 'shared-id', text);
      assert.equal(b.chat!.messages.at(-1)!.text, text);
      assert.equal(b.chat!.messages.at(-1)!.seat, 1);
      assert.equal(b.chat!.messages.at(-1)!.playerId, bId);
      const errors = b.chatProblems.length;
      b.room.send('chat_send', { requestId: 'retry-later', text: 'Zu schnell.' });
      await until(() => b.chatProblems.length > errors, 'Chat-Mindestabstand erzwungen');
      assert.equal(b.chatProblems.at(-1)!.requestId, 'retry-later');
      assert.match(b.chatProblems.at(-1)!.message, /warte kurz/);
      const chats = [a.chatUpdates, b.chatUpdates];
      const history = structuredClone(b.chat);
      b.room.send('chat_send', { requestId: 'shared-id', text: 'Die Wiederholung darf nichts überschreiben.' });
      await until(() => b.chatUpdates > chats[1], 'Wiederholung bestätigt');
      assert.equal(a.chatUpdates, chats[0], 'deduplication acknowledges only the retrying sender');
      assert.deepEqual(b.chat, history);
      assert.equal(b.chatProblems.length, errors + 1, 'a retry is acknowledged before the minimum interval');
      await sendChat(a, [a, b], 'shared-id', 'Gleiche Kennung, anderer Spieler.');
      assert.equal(a.chat!.messages.filter((message) => message.requestId === 'shared-id').length, 2);
      await sendChat(b, [a, b], 'retry-later', 'Nach kurzer Pause.');
      assert.equal(a.chat!.messages.at(-1)!.text, 'Nach kurzer Pause.');
      const bChats = b.chatUpdates;
      const before = structuredClone(a.chat);
      const game = structuredClone(localRoom.game);
      await sync(a);
      assert.deepEqual(a.chat, before);
      assert.equal(b.chatUpdates, bChats, 'sync supplies only its requesting client');
      assert.deepEqual(structuredClone(localRoom.game), game);
    });

    await context.test('chat cannot alter a pending private duel choice, revision or last action', async () => {
      for (const [observer, target] of [[a, 30], [b, 9]] as const) {
        await stageRock(observer, target);
      }
      a.room.send('ready');
      b.room.send('ready');
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.phase === 'playing')));
      for (const [sender, from, to, turn] of [[a, 30, 23, 1], [b, 9, 16, 2]] as const) {
        sender.room.send('move', { from, to, revision: sender.snapshot!.revision });
        await Promise.all([a, b].map((observer) => observer.wait((view) => view.turnNumber === turn)));
      }
      a.room.send('move', { from: 23, to: 16, revision: a.snapshot!.revision });
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.phase === 'duel')));
      const duel = a.snapshot!.duel!;
      a.room.send('duel', { kind: 'paper', duelId: duel.id, round: duel.round });
      await Promise.all([a, b].map((observer) => observer.wait((view) => !!view.duel?.choiceLocked[aId])));
      const game = structuredClone(localRoom.game);
      const views = [structuredClone(a.snapshot), structuredClone(b.snapshot)];
      const snapshots = [a.snapshotUpdates, b.snapshotUpdates];
      await sendChat(b, [a, b], 'during-duel', 'Eine Nachricht während der Wahl.');
      assert.deepEqual(structuredClone(localRoom.game), game);
      assert.deepEqual([a.snapshot, b.snapshot], views);
      assert.deepEqual([a.snapshotUpdates, b.snapshotUpdates], snapshots);
      assert.equal(a.snapshot!.duel!.yourChoice, 'paper');
      assert.equal(b.snapshot!.duel!.yourChoice, null);
      assert.equal('choices' in b.snapshot!.duel!, false);
      assert.equal('duel' in b.chat!, false);
      assert.ok(b.chat!.messages.every((message) => !('choices' in message)));
    });

    await context.test('a connected opponent can chat during a pause and reconnect supplies all history without repeating accepted messages', async () => {
      const token = a.room.reconnectionToken;
      a.room.reconnection.enabled = false;
      a.room.connection.close(4010, 'chat reload test');
      await b.wait((view) => view.paused);
      await sendChat(b, [b], 'during-pause', 'Ich warte auf dich.');
      const history = structuredClone(b.chat);
      a = observe(await client.reconnect(token));
      rooms.push(a.room);
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.players.every((player) => player.connected))));
      await a.waitChat((state) => state.messages.length === history!.messages.length);
      assert.equal(a.room.sessionId, aId);
      assert.deepEqual(a.chat, history);
      assert.equal(a.snapshot!.duel!.yourChoice, 'paper');
      assert.equal(b.snapshot!.duel!.yourChoice, null);
      const chats = [a.chatUpdates, b.chatUpdates];
      a.room.send('chat_send', { requestId: 'shared-id', text: 'Nach dem Neuladen erneut übertragen.' });
      await until(() => a.chatUpdates > chats[0], 'Erneut verbundene Nachricht bestätigt');
      assert.equal(b.chatUpdates, chats[1]);
      assert.deepEqual(a.chat, history);
    });

    await context.test('finished games, rematches and new series preserve the room chat', async () => {
      b.room.send('resign');
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.phase === 'finished')));
      const game = structuredClone(localRoom.game);
      await sendChat(a, [a, b], 'after-match', 'Gutes Spiel!');
      assert.deepEqual(structuredClone(localRoom.game), game);
      const history = structuredClone(a.chat);
      const previous = identity(a);
      a.room.send('restart', previous);
      b.room.send('restart', previous);
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.phase === 'setup' && view.series.gameNumber === 2)));
      await sync(a);
      assert.deepEqual(a.chat, history);
      a.room.send('resign');
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.phase === 'finished')));
      const next = identity(a);
      a.room.send('new_series', next);
      b.room.send('new_series', next);
      await Promise.all([a, b].map((observer) => observer.wait((view) => view.phase === 'setup' && view.series.number === 2)));
      await sync(b);
      assert.deepEqual(b.chat, history);
      assert.notEqual(b.snapshot!.series.id, previous.seriesId);
      assert.ok(b.chat!.messages.every((message, index) => message.id === index + 1));
      b.room.reconnection.enabled = false;
      await b.room.leave();
      await a.wait((view) => view.phase === 'finished' && !view.players.find((player) => player.id === bId)!.connected);
      await sendChat(a, [a], 'after-leave', 'Auch nach dem Verlassen noch im Raum.');
      assert.equal(a.chat!.messages.at(-1)!.requestId, 'after-leave');
    });

    await context.test('the terminal server shutdown does not accept a final chat send', async () => {
      const history = localRoom.chat.state(a.room.roomId);
      a.sendDuringShutdown = true;
      await server.close();
      await until(() => a.shutdowns.length === 1 && !a.room.connection.isOpen, 'Raum mit Neustartnachricht geschlossen');
      assert.deepEqual(localRoom.chat.state(a.room.roomId), history);
      assert.equal(a.chat!.messages.some((message) => message.requestId === 'after-shutdown'), false);
    });
  } finally {
    for (const room of rooms) {
      room.reconnection.enabled = false;
      try { if (room.connection.isOpen) await room.leave(); } catch { /* Already closed. */ }
    }
    await server.close();
  }
});
