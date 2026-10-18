import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { CloseCode, ErrorCode, MatchMakeError, type Room } from '@colyseus/sdk';
import { SERVER_SHUTDOWN_MESSAGE, type ChatProblem, type ChatState, type Snapshot } from '../shared/protocol';
import { RpsConnection, readSession, writeSession, type NetworkStatus, type SessionEnd } from './network';
import type { SeriesMode } from '../shared/game';

function signal<Args extends unknown[]>() {
  const listeners = new Set<(...args: Args) => void>();
  const register = (listener: (...args: Args) => void) => { listeners.add(listener); };
  return Object.assign(register, {
    once(listener: (...args: Args) => void) {
      const wrapper = (...args: Args) => { listeners.delete(wrapper); listener(...args); };
      listeners.add(wrapper);
    },
    invoke(...args: Args) { for (const listener of [...listeners]) listener(...args); },
  });
}

class FakeRoom {
  name = 'rps';
  sessionId = 'test-player';
  reconnectionToken: string;
  reconnection = { enabled: true, minUptime: 5000, isReconnecting: false };
  connection = { isOpen: true, close: (code: number) => { this.connection.isOpen = false; this.closed.push(code); this.onDrop.invoke(code); } };
  closed: number[] = [];
  messages = new Map<string, (payload: unknown) => void>();
  sent: string[] = [];
  leaveCount = 0;
  onDrop = signal<[number, string?]>();
  onLeave = signal<[number, string?]>();
  onError = signal<[number, string?]>();
  onReconnect = signal<[]>();

  constructor(public roomId = 'roomOne01') { this.reconnectionToken = roomId + ':initial-token'; }
  onMessage(type: string, callback: (payload: unknown) => void) { this.messages.set(type, callback); }
  send(type: string) { this.sent.push(type); }
  async leave(): Promise<number> {
    this.leaveCount++;
    this.connection.isOpen = false;
    this.onLeave.invoke(CloseCode.CONSENTED);
    return CloseCode.CONSENTED;
  }
  asRoom(): Room { return this as unknown as Room; }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { href: 'https://arena.example/', origin: 'https://arena.example' } },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  const persistentValues = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => persistentValues.get(key) ?? null,
    setItem: (key: string, value: string) => { persistentValues.set(key, value); },
    removeItem: (key: string) => { persistentValues.delete(key); },
  } });
});

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

function harness(room = new FakeRoom(), options: { native?: boolean; endpoint?: string } = {}) {
  const statuses: NetworkStatus[] = [];
  const ends: SessionEnd[] = [];
  const problems: string[] = [];
  const snapshots: Snapshot[] = [];
  const chats: ChatState[] = [];
  const chatProblems: ChatProblem[] = [];
  const creations: Array<{ roomName: string; options: { name: string; seriesMode: SeriesMode } }> = [];
  const connection = new RpsConnection({
    onStatus: (status) => { statuses.push(status); },
    onSnapshot: (snapshot) => { snapshots.push(snapshot); },
    onProblem: (message) => { problems.push(message); },
    onEnded: (end) => { ends.push(end); },
    onChat: (state) => { chats.push(state); },
    onChatProblem: (problem) => { chatProblems.push(problem); },
  }, options);
  const client = {
    create: async (roomName: string, options: { name: string; seriesMode: SeriesMode }) => {
      creations.push({ roomName, options });
      return room.asRoom();
    },
    joinById: async () => room.asRoom(),
    reconnect: async () => room.asRoom(),
  };
  Object.defineProperty(connection, 'client', { value: client, writable: true });
  return { connection, client, room, statuses, ends, problems, creations, snapshots, chats, chatProblems };
}

test('room chat and chat errors use their own callbacks without changing the game or connection status', async () => {
  const h = harness();
  await h.connection.create('Ada');
  const statusCount = h.statuses.length;
  const state: ChatState = { roomId: h.room.roomId, messages: [{
    id: 1, requestId: 'one', playerId: h.room.sessionId, playerName: 'Ada', seat: 0,
    text: '<b>Gutes Spiel!</b>', sentAt: 1_800_000_000_000,
  }] };
  const problem: ChatProblem = { requestId: 'two', message: 'Bitte warte kurz.' };
  h.room.messages.get('chat')?.(state);
  h.room.messages.get('chat_problem')?.(problem);
  assert.deepEqual(h.chats, [state]);
  assert.deepEqual(h.chatProblems, [problem]);
  assert.deepEqual(h.snapshots, []);
  assert.deepEqual(h.problems, []);
  assert.equal(h.statuses.length, statusCount);
  assert.equal(h.connection.send('chat_send', { requestId: 'three', text: 'Weiter geht’s!' }), true);
});

test('chat from a wrong or former room cannot enter a new room or report a stale error', async () => {
  const h = harness();
  await h.connection.create('Ada');
  h.room.messages.get('chat')?.({ roomId: 'wrong-room', messages: [] });
  assert.deepEqual(h.chats, []);
  await h.connection.leave();
  const nextRoom = new FakeRoom('roomTwo02');
  h.client.create = async () => nextRoom.asRoom();
  await h.connection.create('Ada');
  h.room.messages.get('chat')?.({ roomId: h.room.roomId, messages: [] });
  h.room.messages.get('chat_problem')?.({ requestId: 'old', message: 'Alte Nachricht.' });
  assert.deepEqual(h.chats, []);
  assert.deepEqual(h.chatProblems, []);
  const state: ChatState = { roomId: nextRoom.roomId, messages: [] };
  nextRoom.messages.get('chat')?.(state);
  assert.deepEqual(h.chats, [state]);
  nextRoom.messages.get('server_shutdown')?.({ message: SERVER_SHUTDOWN_MESSAGE });
  nextRoom.messages.get('chat')?.(state);
  nextRoom.messages.get('chat_problem')?.({ message: 'Zu spät.' });
  assert.deepEqual(h.chats, [state]);
  assert.deepEqual(h.chatProblems, []);
  assert.equal(h.connection.send('chat_send', { requestId: 'late', text: 'Hallo' }), false);
});

test('room creation sends the selected series mode and defaults to a free series', async () => {
  for (const mode of [undefined, 'best-of-3', 'best-of-5'] as const) {
    const h = harness();
    await h.connection.create('Ada', mode);
    assert.deepEqual(h.creations, [{ roomName: 'rps', options: { name: 'Ada', seriesMode: mode ?? 'free' } }]);
    assert.equal(h.statuses.at(-1), 'connected');
  }
});

test('server_shutdown ends the room, invalidates its token and closes the socket', async () => {
  const h = harness();
  await h.connection.create('Ada');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), true);
  h.room.messages.get('server_shutdown')?.({ message: SERVER_SHUTDOWN_MESSAGE });
  assert.deepEqual(h.ends, [{ reason: 'server_shutdown', message: SERVER_SHUTDOWN_MESSAGE }]);
  assert.equal(h.statuses.at(-1), 'ended');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), false);
  assert.equal(h.connection.roomCode, null);
  assert.equal(h.room.reconnection.enabled, false);
  assert.equal(h.room.leaveCount, 1);
  assert.equal(h.connection.send('move', { from: 1, to: 2 }), false);
});

test('4001 closes a session even when the shutdown message was not received', async () => {
  const h = harness();
  await h.connection.create('Ada');
  h.room.connection.isOpen = false;
  h.room.onLeave.invoke(CloseCode.SERVER_SHUTDOWN);
  assert.equal(h.statuses.at(-1), 'ended');
  assert.equal(h.ends[0]?.reason, 'server_shutdown');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), false);
  assert.equal(h.room.reconnection.enabled, false);
  assert.equal(h.room.leaveCount, 0, 'a closed socket must not await another leave event');
});

test('a short network drop preserves the session and saves the rotated reconnect token', async () => {
  const h = harness();
  await h.connection.create('Ada');
  h.room.connection.isOpen = false;
  h.room.onDrop.invoke(CloseCode.ABNORMAL_CLOSURE);
  assert.equal(h.statuses.at(-1), 'reconnecting');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), true);
  assert.equal(h.room.reconnection.enabled, true);
  h.room.connection.isOpen = true;
  h.room.onReconnect.invoke();
  h.room.reconnectionToken = h.room.roomId + ':rotated-token';
  await Promise.resolve();
  assert.equal(h.statuses.at(-1), 'connected');
  assert.equal(readSession('rps-arena:reconnect:' + h.room.roomId), h.room.reconnectionToken);
  assert.equal(h.ends.length, 0);
  assert.deepEqual(h.room.sent, ['sync', 'sync']);
});

test('an expired reservation during automatic reconnect becomes terminal', async () => {
  const h = harness();
  await h.connection.create('Ada');
  h.room.onDrop.invoke(CloseCode.ABNORMAL_CLOSURE);
  h.room.onError.invoke(ErrorCode.MATCHMAKE_EXPIRED, 'seat reservation expired.');
  assert.equal(h.statuses.at(-1), 'ended');
  assert.equal(h.ends[0]?.reason, 'session_expired');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), false);
  assert.equal(h.room.reconnection.enabled, false);
});

test('manual resume of an expired session clears its token and reports a terminal reason', async () => {
  const h = harness();
  writeSession('rps-arena:reconnect:' + h.room.roomId, h.room.reconnectionToken);
  h.client.reconnect = async () => { throw new MatchMakeError('reconnection token invalid or expired.', ErrorCode.MATCHMAKE_EXPIRED); };
  await assert.rejects(h.connection.resume(h.room.roomId), /vorige Partie/);
  assert.equal(h.statuses.at(-1), 'ended');
  assert.equal(h.ends[0]?.reason, 'session_expired');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), false);
});

test('transport failures and proxy 524 errors retain a resumable token', async () => {
  for (const error of [new Error('Failed to fetch'), new MatchMakeError('A timeout occurred', 524), new MatchMakeError('Service Unavailable', 503)]) {
    const h = harness();
    writeSession('rps-arena:reconnect:' + h.room.roomId, h.room.reconnectionToken);
    h.client.reconnect = async () => { throw error; };
    await assert.rejects(h.connection.resume(h.room.roomId));
    assert.equal(h.connection.hasSavedSession(h.room.roomId), true);
    assert.equal(h.ends.length, 0);
    assert.notEqual(h.statuses.at(-1), 'reconnecting');
  }
});

test('joining a disposed room reports its expiry without entering a reconnect loop', async () => {
  const h = harness();
  h.client.joinById = async () => { throw new MatchMakeError('room "roomOne01" has been disposed.', ErrorCode.MATCHMAKE_INVALID_ROOM_ID); };
  await assert.rejects(h.connection.join('roomOne01', 'Ada'), /neue Partie/);
  assert.equal(h.statuses.at(-1), 'ended');
  assert.equal(h.ends[0]?.reason, 'session_expired');
});

test('late terminal messages from a former room cannot end the new room', async () => {
  const h = harness();
  await h.connection.create('Ada');
  await h.connection.leave();
  const nextRoom = new FakeRoom('roomTwo02');
  h.client.create = async () => nextRoom.asRoom();
  await h.connection.create('Ada');
  h.room.messages.get('server_shutdown')?.({ message: SERVER_SHUTDOWN_MESSAGE });
  h.room.onLeave.invoke(CloseCode.SERVER_SHUTDOWN);
  assert.equal(h.statuses.at(-1), 'connected');
  assert.equal(h.connection.roomCode, nextRoom.roomId);
  assert.equal(h.connection.hasSavedSession(nextRoom.roomId), true);
  assert.equal(h.ends.length, 0);
});

test('an expired result from a cancelled resume cannot invalidate a newer connection', async () => {
  const h = harness();
  writeSession('rps-arena:reconnect:' + h.room.roomId, h.room.reconnectionToken);
  let rejectResume!: (reason: unknown) => void;
  h.client.reconnect = () => new Promise<Room>((_resolve, reject) => { rejectResume = reject; });
  const resuming = h.connection.resume(h.room.roomId);
  await h.connection.leave();
  const nextRoom = new FakeRoom('roomTwo02');
  h.client.create = async () => nextRoom.asRoom();
  await h.connection.create('Ada');
  rejectResume(new MatchMakeError('reconnection token invalid or expired.', ErrorCode.MATCHMAKE_EXPIRED));
  assert.equal(await resuming, false);
  assert.equal(h.statuses.at(-1), 'connected');
  assert.equal(h.connection.roomCode, nextRoom.roomId);
  assert.equal(h.ends.length, 0);
});

test('native foreground sync uses the live socket, never a second reconnect, and is suppressed in the background', async () => {
  const h = harness(new FakeRoom(), { native: true, endpoint: 'https://native.example' });
  let resumes = 0;
  h.client.reconnect = async () => { resumes++; return h.room.asRoom(); };
  await h.connection.create('Ada');
  h.connection.setSuspended(true);
  assert.equal(await h.connection.refresh(), false);
  assert.deepEqual(h.room.sent, ['sync']);
  h.connection.setSuspended(false);
  assert.equal(await h.connection.refresh(), true);
  assert.deepEqual(h.room.sent, ['sync', 'sync']);
  assert.equal(resumes, 0);
  h.room.messages.get('snapshot')?.({ roomId: h.room.roomId });
  await h.connection.leave();
});

test('foreground and retry clicks do not compete with automatic SDK reconnection', async () => {
  const h = harness(new FakeRoom(), { native: true, endpoint: 'https://native.example' });
  let resumes = 0;
  h.client.reconnect = async () => { resumes++; return h.room.asRoom(); };
  await h.connection.create('Ada');
  h.room.connection.isOpen = false;
  h.room.reconnection.isReconnecting = true;
  h.room.onDrop.invoke(CloseCode.ABNORMAL_CLOSURE);
  await Promise.all([h.connection.refresh(), h.connection.refresh(), h.connection.resume(h.room.roomId)]);
  assert.equal(resumes, 0);
  assert.equal(h.statuses.at(-1), 'reconnecting');
  await h.connection.leave();
});

test('a dead foreground socket is handed to the SDK after a bounded sync check', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(new FakeRoom(), { native: true, endpoint: 'https://native.example' });
  await h.connection.create('Ada');
  await h.connection.refresh();
  t.mock.timers.tick(7999);
  assert.deepEqual(h.room.closed, []);
  t.mock.timers.tick(1);
  assert.deepEqual(h.room.closed, [CloseCode.MAY_TRY_RECONNECT]);
  assert.equal(h.statuses.at(-1), 'reconnecting');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), true);
  assert.equal(h.room.reconnection.enabled, true);
  await h.connection.leave();
});

test('native process recreation resumes a server-scoped seat once and cannot silently create a room', async () => {
  const options = { native: true, endpoint: 'https://native.example' };
  const old = harness(new FakeRoom(), options);
  await old.connection.create('Ada');
  old.room.connection.isOpen = false;
  old.room.onLeave.invoke(CloseCode.FAILED_TO_RECONNECT);
  const h = harness(new FakeRoom(), options);
  let resumes = 0, complete!: (room: Room) => void;
  h.client.reconnect = () => { resumes++; return new Promise(resolve => { complete = resolve; }); };
  const first = h.connection.refresh();
  await h.connection.refresh();
  await h.connection.resume(h.room.roomId);
  assert.equal(resumes, 1);
  assert.equal(h.connection.savedRoomCode(), h.room.roomId);
  assert.equal(h.creations.length, 0);
  complete(h.room.asRoom());
  assert.equal(await first, true);
  assert.equal(h.statuses.at(-1), 'connected');
  await h.connection.leave();
  assert.equal(h.connection.savedRoomCode(), null);
});

test('server switching requires a left room and uses only the new server session store', async () => {
  const h = harness(new FakeRoom(), { native: true, endpoint: 'https://first.example' });
  await h.connection.create('Ada');
  assert.throws(() => h.connection.changeServer('https://second.example'), /zuerst verlassen/);
  // The interrupted seat remains resumable only on its original server.
  h.room.connection.isOpen = false;
  h.room.onLeave.invoke(CloseCode.FAILED_TO_RECONNECT);
  h.connection.changeServer('https://second.example');
  assert.equal(h.connection.endpoint, 'https://second.example');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), false);
  assert.equal(await h.connection.refresh(), false);
  h.connection.changeServer('https://first.example');
  assert.equal(h.connection.hasSavedSession(h.room.roomId), true);
  assert.equal(h.connection.savedRoomCode(), h.room.roomId);
});

test('a user-confirmed leave finishes even when an apparently open socket never acknowledges it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(new FakeRoom(), { native: true, endpoint: 'https://native.example' });
  await h.connection.create('Ada');
  h.room.leave = () => new Promise<number>(() => {});
  let completed = false;
  const leaving = h.connection.leave().then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(h.room.reconnection.enabled, false);
  assert.equal(h.connection.savedRoomCode(), null);
  t.mock.timers.tick(2000);
  await leaving;
  assert.equal(completed, true);
  assert.deepEqual(h.room.closed, [CloseCode.CONSENTED]);
  const next = new FakeRoom('nextRoom');
  h.client.create = async () => next.asRoom();
  await h.connection.create('Ada');
  assert.equal(h.connection.roomCode, 'nextRoom');
  assert.equal(h.statuses.at(-1), 'connected');
  await h.connection.leave();
});
