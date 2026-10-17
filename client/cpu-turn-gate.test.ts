import assert from 'node:assert/strict';
import test from 'node:test';
import { CpuTurnGate } from './cpu-turn-gate';

const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test('CPU release waits for presentation and full audio completion and sends only once', async () => {
  const gate = new CpuTurnGate(), audio = deferred(), motion = deferred();
  let sent = 0;
  const settled = async () => { await Promise.all([audio.promise, motion.promise]); };
  const send = () => { sent++; return true; };
  gate.update('match:1', true, settled, send);
  await flush();
  assert.equal(sent, 0);
  gate.update('match:1', false, settled, send);
  motion.resolve(); await flush();
  assert.equal(sent, 0, 'finishing the animation must not bypass a long announcement');
  gate.update('match:1', false, settled, send);
  audio.resolve(); await flush();
  assert.equal(sent, 1);
  gate.update('match:1', false, settled, send);
  await flush();
  assert.equal(sent, 1);
});

test('disconnects, a new match and replacement presentations invalidate pending releases', async () => {
  const gate = new CpuTurnGate(), oldAudio = deferred();
  const sent: string[] = [];
  gate.update('old:1', false, () => oldAudio.promise, () => { sent.push('old'); return true; });
  await flush();
  gate.update(null, false, async () => {}, () => false);
  oldAudio.resolve(); await flush();
  assert.equal(sent.length, 0);
  const replaced = deferred();
  gate.update('new:1', false, () => replaced.promise, () => { sent.push('replaced'); return true; });
  await flush();
  gate.update('new:1', true, async () => {}, () => false);
  replaced.resolve(); await flush();
  assert.equal(sent.length, 0);
  gate.update('new:1', false, async () => {}, () => { sent.push('new'); return true; });
  await flush();
  assert.deepEqual(sent, ['new']);
});

test('muted audio and restored turns release without a new audible announcement', async () => {
  const gate = new CpuTurnGate();
  let sent = 0;
  gate.update('restored:10', false, async () => {}, () => { sent++; return true; });
  await flush();
  assert.equal(sent, 1);
});
