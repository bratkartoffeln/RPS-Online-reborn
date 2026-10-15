import test from 'node:test';
import assert from 'node:assert/strict';
import { idleDeformation, idleEyes, nextFidgetDelay, RefereeInactivity, retroIdleFigure } from './idle-motion';

test('figures rest between short independent fidgets', () => {
  assert.equal(nextFidgetDelay(() => 0), 10_000);
  assert.equal(nextFidgetDelay(() => .5), 25_000);
  assert.equal(nextFidgetDelay(() => 1), 40_000);
  assert.equal(idleDeformation(-1, 0).active, false);
  assert.equal(idleDeformation(180, 0).angle, 1.3);
  assert.equal(idleDeformation(180, 1).angle, -1.3);
  assert.equal(idleDeformation(180, 2).y, .975);
  assert.deepEqual(idleDeformation(720, 2), { x: 1, y: 1, angle: 0, blink: false, active: false });
});

test('a random blink briefly closes the eyes once without repeated squinting', () => {
  assert.equal(idleDeformation(0, 3).blink, true);
  assert.equal(idleDeformation(159, 3).blink, true);
  assert.equal(idleDeformation(160, 3).blink, false);
  assert.equal(idleDeformation(400, 3).active, false);
});

test('overlays follow public front artwork; visible traps and rear views never receive eyes', () => {
  for (const color of ['blue', 'red']) {
    assert.deepEqual(idleEyes(`${color}-front-rock`), [40, 77]);
    assert.equal(idleEyes(`${color}-back-rock-revealed`), null);
    assert.equal(idleEyes(`${color}-front-trap`), null);
    assert.equal(retroIdleFigure(`${color}-front-trap`), false);
    assert.equal(retroIdleFigure(`${color}-back-trap`), false);
    assert.equal(retroIdleFigure(`${color}-front-unknown`), true);
    assert.equal(retroIdleFigure(`${color}-back-rock-revealed`), true);
    assert.equal(retroIdleFigure(`${color}-front-flag-victory`), false);
  }
});

test('referee starts yawning after ten seconds; either player activity or pause resets the clock', () => {
  const idle = new RefereeInactivity();
  idle.update('start', true, 0);
  assert.equal(idle.update('start', true, 9999), false);
  assert.equal(idle.update('start', true, 10000), true);
  assert.equal(idle.yawning, true);
  idle.update('start', true, 12400);
  assert.equal(idle.yawning, false);
  assert.equal(idle.update('start', true, 90000), true);
  idle.update('blue-move', true, 90001);
  idle.update('red-move', true, 95000);
  assert.equal(idle.update('red-move', true, 100001), false);
  idle.update('red-move', false, 110000);
  idle.update('red-move', true, 110001);
  assert.equal(idle.yawning, false);
  assert.equal(idle.update('red-move', true, 120000), true);
  idle.update('next-move', true, 120100);
  assert.equal(idle.yawning, false);
});

test('continued inactivity repeats yawns after a fresh random five-to-ten-second pause', () => {
  for (const random of [0, .5, 1]) {
    const idle = new RefereeInactivity(() => random);
    idle.update('start', true, 0);
    idle.update('start', true, 10000);
    assert.equal(idle.yawning, true);
    idle.update('start', true, 12400);
    assert.equal(idle.yawning, false);
    const next = 12400 + 5000 + random * 5000;
    assert.equal(idle.update('start', true, next - 1), false);
    assert.equal(idle.update('start', true, next), true);
    assert.equal(idle.yawning, true);
    idle.update('start', true, next + 2400);
    assert.equal(idle.yawning, false);
    assert.equal(idle.update('start', true, next + 2400 + 5000 + random * 5000), true);
  }
});
