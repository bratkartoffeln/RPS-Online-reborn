import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomChat } from '../server/chat.js';
import { CHAT_HISTORY_LIMIT, CHAT_MAX_LENGTH, CHAT_MIN_INTERVAL_MS, isChatRequestId, normalizeChatText } from '../shared/chat.js';

const blue = { playerId: 'blue-player', playerName: 'Alice', seat: 0 as const };
const red = { playerId: 'red-player', playerName: 'Bob', seat: 1 as const };

test('chat normalization produces one line without destroying Unicode or emoji sequences', () => {
  assert.equal(normalizeChatText(' \tHallo\r\nWelt\u0000\u007f\u0085😀\u2028👨‍👩‍👧‍👦\u2029  '), 'Hallo Welt 😀 👨‍👩‍👧‍👦');
  assert.equal(normalizeChatText('\u0000\t\n\u001b\u007f\u009f\u2028\u2029'), '');
  assert.equal(normalizeChatText('  Grüße aus Köln – 中文 👩🏽‍💻  '), 'Grüße aus Köln – 中文 👩🏽‍💻');
  assert.equal(normalizeChatText('<b>Hallo</b>'), '<b>Hallo</b>', 'the transport retains text; the UI renders it as text');
});

test('request identifiers accept bounded UUID-style text and reject arbitrary reflected payloads', () => {
  for (const value of ['a', 'A_9-test', 'a'.repeat(64), '5931e8cf-c579-47d2-aa84-fbcf678a1783']) {
    assert.equal(isChatRequestId(value), true);
  }
  for (const value of ['', 'a'.repeat(65), 'has space', 'line\nbreak', '../id', '<b>', 'ä', null, 2, {}, []]) {
    assert.equal(isChatRequestId(value), false);
  }
});

test('malformed and empty requests return only the validated request ID and do not consume history', () => {
  const chat = new RoomChat(() => 1000);
  for (const value of [null, [], 'hello', {}, { requestId: ['bad'], text: 'Hello' }, { requestId: '<bad>', text: 'Hello' }]) {
    const result = chat.accept(value, blue);
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.problem), ['message']);
  }
  for (const text of [undefined, null, false, {}, [], 12, '', '\t\r\n\u0000 ']) {
    const result = chat.accept({ requestId: 'valid-id', text }, blue);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.problem.requestId, 'valid-id');
  }
  assert.deepEqual(chat.state('room'), { roomId: 'room', messages: [] });
  assert.deepEqual(chat.accept({ requestId: 'valid-id', text: 'Jetzt lesbar.' }, blue), { ok: true, added: true });
});

test('the 300-character boundary counts Unicode code points after normalization and never truncates', () => {
  const chat = new RoomChat(() => 1000);
  const boundary = '🪨'.repeat(CHAT_MAX_LENGTH);
  assert.equal(boundary.length, 600);
  assert.deepEqual(chat.accept({ requestId: 'boundary', text: `\n ${boundary}\t ` }, blue), { ok: true, added: true });
  const tooLong = chat.accept({ requestId: 'too-long', text: `${boundary}🪨` }, blue);
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) {
    assert.equal(tooLong.problem.requestId, 'too-long');
    assert.match(tooLong.problem.message, /300/);
  }
  assert.equal(chat.state('room').messages.length, 1);
  assert.equal(chat.state('room').messages[0].text, boundary);
});

test('only the trusted sender and server clock determine authorship, seat, timestamp and message ID', () => {
  const chat = new RoomChat(() => 123456);
  assert.deepEqual(chat.accept({
    requestId: 'mine', text: '  Hallo\nzusammen! ', id: -100, playerId: red.playerId,
    playerName: 'Admin', seat: 1, sentAt: 1, roomId: 'another-room', choices: { secret: 'paper' },
  }, blue), { ok: true, added: true });
  assert.deepEqual(chat.state('room'), { roomId: 'room', messages: [{
    id: 1, requestId: 'mine', playerId: blue.playerId, playerName: 'Alice', seat: 0,
    text: 'Hallo zusammen!', sentAt: 123456,
  }] });
});

test('deduplication belongs to a player and acknowledges retries without rate limiting or overwriting', () => {
  const chat = new RoomChat(() => 1000);
  assert.deepEqual(chat.accept({ requestId: 'same-id', text: 'Original' }, blue), { ok: true, added: true });
  assert.deepEqual(chat.accept({ requestId: 'same-id', text: 'Verändert' }, blue), { ok: true, added: false });
  assert.deepEqual(chat.accept({ requestId: 'same-id' }, blue), { ok: true, added: false });
  assert.deepEqual(chat.accept({ requestId: 'same-id', text: 'Andere Person' }, red), { ok: true, added: true });
  assert.deepEqual(chat.state('room').messages.map(({ id, playerId, text }) => ({ id, playerId, text })), [
    { id: 1, playerId: blue.playerId, text: 'Original' },
    { id: 2, playerId: red.playerId, text: 'Andere Person' },
  ]);
});

test('each player has a 500 ms interval; rejected attempts and retries do not extend it', () => {
  let now = 0;
  const chat = new RoomChat(() => now);
  assert.deepEqual(chat.accept({ requestId: 'first', text: 'Eins' }, blue), { ok: true, added: true });
  assert.deepEqual(chat.accept({ requestId: 'red-first', text: 'Hallo' }, red), { ok: true, added: true });
  now = CHAT_MIN_INTERVAL_MS - 1;
  const rejected = chat.accept({ requestId: 'second', text: 'Zwei' }, blue);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.problem.requestId, 'second');
    assert.match(rejected.problem.message, /warte kurz/);
  }
  assert.deepEqual(chat.accept({ requestId: 'first', text: 'Eins' }, blue), { ok: true, added: false });
  now++;
  assert.deepEqual(chat.accept({ requestId: 'second', text: 'Zwei' }, blue), { ok: true, added: true });
  assert.deepEqual(chat.accept({ requestId: 'red-second', text: 'Auch wieder da' }, red), { ok: true, added: true });
  assert.deepEqual(chat.state('room').messages.map((message) => message.sentAt), [0, 0, 500, 500]);
});

test('the room retains exactly 50 messages with monotonic IDs and deduplicates only retained entries', () => {
  let now = 0;
  const chat = new RoomChat(() => now);
  for (let index = 0; index < CHAT_HISTORY_LIMIT + 2; index++) {
    assert.deepEqual(chat.accept({ requestId: `request-${index}`, text: `Nachricht ${index}` }, blue), { ok: true, added: true });
    now += CHAT_MIN_INTERVAL_MS;
  }
  const history = chat.state('room').messages;
  assert.equal(history.length, CHAT_HISTORY_LIMIT);
  assert.equal(history[0].id, 3);
  assert.equal(history[49].id, 52);
  assert.deepEqual(chat.accept({ requestId: 'request-2', text: 'Wiederholung' }, blue), { ok: true, added: false });
  assert.deepEqual(chat.accept({ requestId: 'request-0', text: 'Nach dem Verwerfen neu' }, blue), { ok: true, added: true });
  assert.equal(chat.state('room').messages.length, CHAT_HISTORY_LIMIT);
  assert.equal(chat.state('room').messages.at(-1)!.id, 53);
  assert.equal(chat.state('room').messages.at(-1)!.text, 'Nach dem Verwerfen neu');
});

test('room histories and returned snapshots are independent', () => {
  const first = new RoomChat(() => 1000);
  const second = new RoomChat(() => 1000);
  first.accept({ requestId: 'same', text: 'Erster Raum' }, blue);
  const output = first.state('first');
  output.messages[0].text = 'Extern verändert';
  output.messages.splice(0);
  assert.equal(first.state('first').messages[0].text, 'Erster Raum');
  assert.deepEqual(second.state('second'), { roomId: 'second', messages: [] });
  assert.deepEqual(second.accept({ requestId: 'same', text: 'Zweiter Raum' }, blue), { ok: true, added: true });
  assert.equal(second.state('second').messages[0].id, 1);
});
