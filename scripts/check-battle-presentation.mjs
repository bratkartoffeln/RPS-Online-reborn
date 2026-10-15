/** Side poses, slower jumps, public weapon reveal and synchronized battle effects.
 * Optional argument: installed Playwright module.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch('http://127.0.0.1:5181/mobile-qa.html')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1100, height: 900 }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5181/mobile-qa.html');
    await page.evaluate(async () => {
      await import('/client/styles.css'); await import('/client/combat-ui.css');
      const { ArenaBoard } = await import('/client/board.ts');
      const { CombatOverlay } = await import('/client/combat-ui.ts');
      const { combatStaging } = await import('/client/board-motion.ts');
      const { loadSkin } = await import('/client/skins.ts');
      const { applyUiPalette } = await import('/client/skin-ui.ts');
      const g = await import('/shared/game.ts');
      document.body.innerHTML = '<div class="board-surface" style="position:relative;width:min(100%,680px);aspect-ratio:680/616"><div id="board" style="width:100%;height:100%"></div><div id="combat"></div></div>';
      const board = new ArenaBoard(document.querySelector('#board'), { onCell() {}, onCancel() {}, onFocus() {} });
      await board.whenReady();
      const qa = window.qa = { board, effects: [], view: null };
      const overlay = qa.overlay = new CombatOverlay(document.querySelector('#combat'), {
        onBusyChange(busy) { board.setCombatOverlayBusy(busy); board.update(qa.view, null, false); }, onCelebrate() {},
        beforeBattle: () => board.whenEffectsComplete(),
        onBattleEffect: action => { qa.effects.push({ action, stage: document.querySelector('.combat-stage').dataset.stage }); return Promise.resolve(); },
      });
      qa.load = async id => {
        overlay.reset(); qa.skin = await loadSkin({ id, name: id, file: id + '/skin.json' });
        applyUiPalette(qa.skin); board.setSkin(qa.skin);
      };
      qa.attack = (from = 21, to = 14, attacker = 'rock', defender = 'paper') => {
        overlay.reset(); qa.effects.length = 0;
        const game = g.createGame();
        g.addPlayer(game, 'a', 'Blue'); g.addPlayer(game, 'b', 'Red'); g.readyPlayer(game, 'a'); g.readyPlayer(game, 'b');
        game.board.fill(null);
        for (const [cell, owner, kind] of [[from,'a',attacker],[to,'b',defender],[35,'a','paper'],[6,'b','paper'],[41,'a','flag'],[0,'b','flag']]) game.board[cell] = { id: String(cell), owner, kind, revealed: false };
        qa.view = { ...g.viewFor(game, 'a'), roomId: 'qa' };
        board.update(qa.view, null, true); overlay.update(qa.view, qa.skin, { connected: true, pending: false });
        if (!g.movePiece(game, 'a', from, to).ok) throw new Error('QA attack rejected');
        qa.view = { ...g.viewFor(game, 'a'), roomId: 'qa' };
        qa.action = qa.view.lastAction;
        overlay.present(qa.action, qa.view);
        overlay.update(qa.view, qa.skin, { connected: true, pending: false });
      };
      qa.stance = () => {
        const scene = board.scene, effect = scene.effect;
        if (!effect) return null;
        const action = effect.action, staging = combatStaging(scene.position(action.from), scene.position(action.to));
        return { elapsed: effect.elapsed, moveMs: effect.attackMs, hold: effect.resultMs,
          expectedMs: qa.skin.definition.motion.moveMs * 2,
          attacker: scene.visuals.get(action.attacker.id).shownFrame,
          defender: scene.visuals.get(action.defender.id).shownFrame, staging,
          hidden: document.querySelector('#combat').hidden };
      };
      qa.choose = () => {
        overlay.reset();
        qa.view = { ...qa.view, phase: 'duel', lastAction: null, duel: { id: 'duel', attacker: 'a', defender: 'b', from: 21, to: 14, round: 1, choiceLocked: { a: false, b: false }, yourChoice: null } };
        overlay.update(qa.view, qa.skin, { connected: true, pending: false });
        overlay.previewChoice('scissors'); overlay.update(qa.view, qa.skin, { connected: true, pending: true });
      };
      qa.resolve = () => {
        const action = { ...qa.action, kind: 'duel', duelRound: 1, attacker: { ...qa.action.attacker, kind: 'scissors' }, defender: { ...qa.action.defender, kind: 'paper' }, outcome: 'attacker', winnerId: qa.action.attacker.id, removedIds: [qa.action.defender.id] };
        qa.view = { ...qa.view, phase: 'playing', duel: null, lastAction: action };
        overlay.present(action, qa.view); overlay.update(qa.view, qa.skin, { connected: true, pending: false });
      };
    });
    for (const skin of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark'].filter(id => !process.env.RPS_QA_SKIN || id === process.env.RPS_QA_SKIN)) {
      await page.evaluate(id => qa.load(id), skin);
      for (const [from, to] of [[21,14], [14,21], [21,22], [22,21]]) {
        await page.evaluate(({ from, to }) => qa.attack(from, to), { from, to });
        await page.waitForFunction(() => { const stance = qa.stance(); return stance && stance.elapsed >= stance.moveMs + 30; });
        const stance = await page.evaluate(() => qa.stance());
        assert.ok(stance?.hidden, 'The faceoff is visible before the battle overlay');
        assert.equal(stance.moveMs, stance.expectedMs);
        if (skin.startsWith('icq')) {
          assert.equal(stance.attacker, `battle-blue-${stance.staging.attacker.facing}`);
          assert.equal(stance.defender, `battle-red-${stance.staging.defender.facing}`);
        } else {
          assert.ok(!stance.attacker?.startsWith('battle-') && !stance.defender?.startsWith('battle-'), 'Classic and Arcade stage their existing symbols without human figures');
        }
        if (from === 21 && to === 14) await page.locator('.board-surface').screenshot({ path: path.join(tmpdir(), `rps-faceoff-${skin}-${touch ? 'mobile' : 'desktop'}.png`) });
      }
      await page.waitForFunction(() => document.querySelector('#combat').dataset.mode === 'battle');
      await page.waitForFunction(() => qa.effects.length === 1);
      assert.equal(await page.evaluate(() => qa.effects[0].stage), 'impact');
      await page.waitForFunction(() => document.querySelector('.combat-stage')?.dataset.stage === 'winner');
      const held = await page.evaluate(() => qa.stance());
      assert.ok(held, 'Both opponents remain staged until the fight overlay closes');
      if (skin.startsWith('icq')) assert.ok(held.attacker.startsWith('battle-') && held.defender.startsWith('battle-'));
      await page.waitForFunction(() => !qa.overlay.busy);
      assert.equal(await page.evaluate(() => qa.stance()), null, 'Side poses release after the overlay disappears');
      await page.evaluate(() => qa.choose());
      assert.equal(await page.locator('#combat').getAttribute('data-mode'), 'waiting');
      assert.equal(await page.locator('.combat-choice').count(), 0);
      assert.equal(await page.locator('#combat [data-kind="paper"]').count(), 0, 'Opponent weapon stays concealed while waiting');
      await page.evaluate(() => qa.resolve());
      assert.equal(await page.locator('#combat').getAttribute('data-mode'), 'battle');
      assert.equal(await page.locator('.combat-choice').count(), 0);
      if (skin.startsWith('icq')) assert.equal(await page.locator('[data-kind="scissors"] .combat-art-main > svg').evaluate(node => getComputedStyle(node).rotate), '-90deg');
      if (skin.startsWith('icq')) {
        await page.waitForFunction(() => document.querySelector('.combat-stage')?.dataset.stage === 'shatter');
        await page.locator('.board-surface').screenshot({ path: path.join(tmpdir(), `rps-sideways-cut-${skin}-${touch ? 'mobile' : 'desktop'}.png`) });
      }
      console.log(`${skin} ${touch ? 'mobile' : 'desktop'}: four attack directions, slow leap, facing atlas poses, effect timing and immediate choice reveal OK`);
    }
    assert.deepEqual(errors, []);
    await page.evaluate(() => { qa.overlay.reset(); qa.board.destroy(); });
    await context.close();
  }
} finally { await browser?.close(); server.kill(); }
