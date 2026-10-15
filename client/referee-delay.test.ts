import assert from 'node:assert/strict';
import test from 'node:test';
import { RefereeDelay } from './referee-delay';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('turn indication and speech wait for both animation and audio, then a full quiet second', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishMove!: () => void, finishSound!: () => void;
  const motion = new Promise<void>(resolve => { finishMove = resolve; });
  const sound = new Promise<void>(resolve => { finishSound = resolve; });
  const delay = new RefereeDelay();
  let announcements = 0;
  delay.schedule(() => Promise.all([motion, sound]).then(() => {}), () => { announcements++; });
  await flush();
  t.mock.timers.tick(5000);
  assert.equal(announcements, 0);
  finishMove(); await flush();
  t.mock.timers.tick(2000);
  assert.equal(announcements, 0, 'A completed move does not bypass a longer sound');
  finishSound(); await flush();
  t.mock.timers.tick(999);
  assert.equal(delay.waiting, true);
  assert.equal(announcements, 0);
  t.mock.timers.tick(1);
  assert.equal(delay.waiting, false);
  assert.equal(announcements, 1);
});

test('cancel and replacement discard stale announcements while settling or during the quiet second', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const delay = new RefereeDelay();
  let settle!: () => void;
  const old = new Promise<void>(resolve => { settle = resolve; });
  const announced: string[] = [];
  delay.schedule(() => old, () => announced.push('old'));
  await flush();
  delay.schedule(() => Promise.resolve(), () => announced.push('new'));
  settle(); await flush();
  t.mock.timers.tick(1000);
  assert.deepEqual(announced, ['new']);
  delay.schedule(() => Promise.resolve(), () => announced.push('cancelled'));
  await flush();
  t.mock.timers.tick(999);
  delay.cancel();
  t.mock.timers.tick(5000);
  assert.equal(delay.waiting, false);
  assert.deepEqual(announced, ['new']);
});
