import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { CloseCode, ErrorCode, MatchMakeError, type Room } from '@colyseus/sdk';
import { SERVER_SHUTDOWN_MESSAGE } from '../shared/protocol';
import { RpsConnection, readSession, writeSession, type NetworkStatus, type SessionEnd } from './network';

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
  reconnection = { enabled: true, minUptime: 5000 };
  connection = { isOpen: true };
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
  async leave() {
    this.leaveCount++;
    this.connection.isOpen = false;
    this.onLeave.invoke(CloseCode.CONSENTED);
    return CloseCode.CONSENTED;
  }
  asRoom(): Room { return this as unknown as Room; }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

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
});

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
});

function harness(room = new FakeRoom()) {
  const statuses: NetworkStatus[] = [];
  const ends: SessionEnd[] = [];
  const problems: string[] = [];
  const connection = new RpsConnection({
    onStatus: (status) => { statuses.push(status); },
    onSnapshot() {},
    onProblem: (message) => { problems.push(message); },
    onEnded: (end) => { ends.push(end); },
  });
  const client = {
    create: async () => room.asRoom(),
    joinById: async () => room.asRoom(),
    reconnect: async () => room.asRoom(),
  };
  Object.defineProperty(connection, 'client', { value: client, writable: true });
  return { connection, client, room, statuses, ends, problems };
}

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
