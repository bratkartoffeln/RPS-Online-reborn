/** Needs a local Vite preview; checks real CSS stages and decoded audio playback. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto((process.argv[3] || 'http://localhost:5173') + '/mobile-qa.html');
  const results = await page.evaluate(async () => {
    await import('/client/styles.css');
    await import('/client/combat-ui.css');
    const { CombatOverlay } = await import('/client/combat-ui.ts');
    const { GameSounds } = await import('/client/sound.ts');
    const { loadSkin } = await import('/client/skins.ts');
    const g = await import('/shared/game.ts');
    document.body.innerHTML = '<div class="board-surface" style="position:relative;width:680px;height:616px"><div id="combat"></div></div>';
    const root = document.querySelector('#combat');
    const sources = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this), start = source.start.bind(source);
      source.start = (...args) => {
        const record = { duration: source.buffer.duration, started: performance.now(), ended: null, stage: root.dataset.stage };
        sources.push(record);
        source.addEventListener('ended', () => { record.ended = performance.now(); });
        start(...args);
      };
      return source;
    };
    const sounds = new GameSounds(), checks = [];
    for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
      const skin = await loadSkin({ id, name: id, file: id + '/skin.json' });
      sounds.setSkin(skin); sounds.setEnabled(true); await sounds.unlock();
      for (const reduced of [false, true]) {
        sources.length = 0;
        const callbacks = [];
        const overlay = new CombatOverlay(root, {
          onBusyChange() {}, onCelebrate() {},
          onBattleEffect: action => sounds.playCombatWeapon(action),
          onBattleFall: () => { callbacks.push({ cue: 'fall', time: performance.now() }); return sounds.playCue('trapFall'); },
          onBattleResult: action => { callbacks.push({ cue: 'result', time: performance.now() }); sounds.playCombatResult(action, 'a'); },
        });
        overlay.setAnimationsEnabled(!reduced);
        const game = g.createGame();
        g.addPlayer(game, 'a', 'Angreifer'); g.addPlayer(game, 'b', 'Falle');
        g.readyPlayer(game, 'a'); g.readyPlayer(game, 'b'); game.board.fill(null);
        for (const [cell, owner, kind] of [[24, 'a', 'rock'], [17, 'b', 'trap'], [41, 'a', 'flag'], [0, 'b', 'flag'], [35, 'a', 'paper'], [6, 'b', 'paper']]) {
          game.board[cell] = { id: String(cell), owner, kind, revealed: false };
        }
        g.movePiece(game, 'a', 24, 17);
        const view = { ...g.viewFor(game, 'a'), roomId: 'trap-audio-qa' };
        overlay.update(view, skin, { connected: true, pending: false });
        overlay.present(view.lastAction, view);
        const deadline = performance.now() + 12000;
        while (callbacks.length < 2 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        await sounds.whenIdle();
        await new Promise(resolve => setTimeout(resolve, 20)); // Let all native ended listeners run.
        const falls = sources.filter(source => Math.abs(source.duration - 1.25) < .003);
        checks.push({ id, reduced, callbacks: [...callbacks], falls: [...falls] });
        overlay.reset();
      }
    }
    sounds.setEnabled(false);
    const count = sources.length;
    await sounds.playCue('trapFall');
    checks.push({ muted: sources.length === count });
    return checks;
  });
  for (const result of results) {
    if ('muted' in result) { assert.equal(result.muted, true); continue; }
    assert.deepEqual(result.callbacks.map(item => item.cue), ['fall', 'result'], result.id);
    assert.equal(result.falls.length, 1, result.id);
    assert.equal(result.falls[0].stage, result.reduced ? 'result' : 'shatter', result.id);
    assert.ok(result.falls[0].ended !== null && result.callbacks[1].time >= result.falls[0].ended - 20, JSON.stringify(result));
    console.log(`${result.id}, ${result.reduced ? 'reduced' : 'animated'}: one human scream at fall-in, result after audio ends`);
  }
  console.log('Muted playback stays silent.');
} finally { await browser.close(); }
