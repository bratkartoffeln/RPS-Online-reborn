import test from 'node:test';
import assert from 'node:assert/strict';
import { fidgetFrame, nextFidgetDelay, RefereeInactivity } from './idle-motion';

test('figures rest between short independent fidgets', () => {
  assert.equal(nextFidgetDelay(() => 0), 2000);
  assert.equal(nextFidgetDelay(() => .5), 5000);
  const frames = ['base', 'sway-left', 'sway-right', 'foot'];
  assert.equal(fidgetFrame('base', frames, -1, 2), 'base');
  assert.equal(fidgetFrame('base', frames, 10, 2), 'foot');
  assert.equal(fidgetFrame('base', frames, 200, 1), 'base');
  assert.equal(fidgetFrame('base', frames, 400, 1), 'sway-right');
  assert.equal(fidgetFrame('base', frames, 720, 1), 'base');
});

test('a random blink briefly closes the eyes once without repeated squinting', () => {
  const frames = ['base', 'sway', 'foot', 'base-fidget-blink'];
  assert.equal(fidgetFrame('base', frames, 0, 2), 'base-fidget-blink');
  assert.equal(fidgetFrame('base', frames, 159, 2), 'base-fidget-blink');
  assert.equal(fidgetFrame('base', frames, 160, 2), 'base');
  assert.equal(fidgetFrame('base', frames, 400, 2), 'base');
});

test('referee yawns once after ten seconds; either player activity or pause resets the clock', () => {
  const idle = new RefereeInactivity();
  idle.update('start', true, 0);
  assert.equal(idle.update('start', true, 9999), false);
  assert.equal(idle.update('start', true, 10000), true);
  assert.equal(idle.yawning, true);
  idle.update('start', true, 12400);
  assert.equal(idle.yawning, false);
  assert.equal(idle.update('start', true, 90000), false);
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
