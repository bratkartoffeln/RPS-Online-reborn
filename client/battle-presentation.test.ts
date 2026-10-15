import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { FighterKind, GameActionView } from '../shared/game';
import { combatWeaponCue, GameSounds } from './sound';
import { combatFacingFrame, combatStaging, NINJA_SPEED_FACTOR } from './board-motion';
import { parseSkinDefinition } from './skins';
import type { SoundCue } from './skin-types';

function encounter(attacker: FighterKind, defender: FighterKind, winner: 'attacker' | 'defender' | null): GameActionView {
  return { id: 4, kind: 'battle', turnNumber: 2, from: 21, to: 14, duelRound: null,
    attacker: { id: 'a', owner: 'blue', kind: attacker, revealed: true },
    defender: { id: 'b', owner: 'red', kind: defender, revealed: true },
    winnerId: winner === 'attacker' ? 'a' : winner === 'defender' ? 'b' : null,
    outcome: winner ?? 'duel', removedIds: winner ? [winner === 'attacker' ? 'b' : 'a'] : [] };
}

test('the victorious weapon is heard regardless of attack role; equal weapons keep their own sound', () => {
  for (const [winner, loser] of [['rock', 'scissors'], ['paper', 'rock'], ['scissors', 'paper']] as const) {
    assert.equal(combatWeaponCue(encounter(winner, loser, 'attacker')), winner);
    assert.equal(combatWeaponCue(encounter(loser, winner, 'defender')), winner);
    assert.equal(combatWeaponCue(encounter(winner, winner, null)), winner);
    assert.equal(combatWeaponCue({ ...encounter(winner, winner, null), kind: 'duel', outcome: 'tie' }), winner);
  }
  const hidden = encounter('paper', 'rock', 'attacker');
  hidden.attacker.kind = null; hidden.attacker.revealed = false;
  assert.equal(combatWeaponCue(hidden), null);
  for (const weapon of ['rock', 'paper', 'scissors'] as const) {
    const flag = encounter(weapon, 'paper', 'attacker');
    flag.outcome = 'flag'; flag.defender!.kind = 'flag';
    assert.equal(combatWeaponCue(flag), 'flag', 'Capturing the flag always uses the flag sound');
  }
});

test('weapon playback has no extra duel cue and the result is announced separately', async (t) => {
  const sounds = new GameSounds(), played: string[] = [];
  t.mock.method(sounds, 'playCue', async (cue: SoundCue) => { played.push(cue); });
  await sounds.playCombatWeapon(encounter('rock', 'paper', 'defender'));
  assert.deepEqual(played, ['paper']);
  sounds.playCombatResult(encounter('rock', 'paper', 'defender'), 'red');
  assert.deepEqual(played, ['paper', 'win']);
  played.length = 0;
  await sounds.playCombatWeapon(encounter('scissors', 'scissors', null));
  sounds.playCombatResult(encounter('scissors', 'scissors', null), 'blue');
  assert.deepEqual(played, ['scissors']);
});

test('side poses face one another for horizontal, vertical and rotated approaches without changing owner colors', () => {
  assert.equal(NINJA_SPEED_FACTOR, 2);
  for (const from of [{ x: 0, y: 84 }, { x: 168, y: 84 }, { x: 84, y: 0 }, { x: 84, y: 168 }]) {
    const positions = combatStaging(from, { x: 84, y: 84 });
    assert.equal(positions.attacker.y, positions.defender.y);
    assert.notEqual(positions.attacker.facing, positions.defender.facing);
    assert.equal(positions.attacker.facing === 'right', positions.attacker.x < positions.defender.x);
  }
  for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    const skin = parseSkinDefinition(JSON.parse(readFileSync(`public/skins/${id}/skin.json`, 'utf8')));
    for (const color of ['blue', 'red'] as const) for (const facing of ['left', 'right'] as const) {
      const frame = combatFacingFrame(skin, color, facing);
      assert.equal(frame, id.startsWith('icq') ? `battle-${color}-${facing}` : null);
      if (frame && skin.mobileAtlas) assert.ok(skin.mobileAtlas.frames[frame]);
    }
  }
});
