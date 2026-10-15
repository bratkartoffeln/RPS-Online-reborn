/** Browser checks for special encounter artwork and stable compact turn layouts.
 * Optional argument: path to an installed playwright module.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch('http://127.0.0.1:5179/mobile-qa.html')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const touch of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5179/mobile-qa.html');
    await page.evaluate(async () => {
      for (const file of ['styles', 'retro', 'series', 'lobby', 'combat-ui']) await import(`/client/${file}.css`);
      const g = await import('/shared/game.ts');
      const { CombatOverlay } = await import('/client/combat-ui.ts');
      const { loadSkin } = await import('/client/skins.ts');
      const { applyUiPalette, atlasIcon, pieceIcon } = await import('/client/skin-ui.ts');
      const { refereePortrait } = await import('/client/referee-ui.ts');
      const { seriesScoreMarkup } = await import('/client/series-ui.ts');
      document.body.innerHTML = '<div class="app-shell game-mode compact-game" data-phase="playing"><header class="app-header"><div class="header-arena"><section class="series-scoreboard"></section></div><div class="header-right">Design</div></header><div class="phase-top-host"><div class="phase-controls"><section class="card phase-card"><h2></h2><p class="body-copy"></p></section></div></div><div class="board-surface" style="position:relative;width:100%;aspect-ratio:680/616"><div id="combat"></div></div></div>';
      const overlay = new CombatOverlay(document.querySelector('#combat'), { onBusyChange() {}, onCelebrate() {} });
      function game(kind) {
        const state = g.createGame();
        g.addPlayer(state, 'a', 'Ada'); g.addPlayer(state, 'b', 'Ein langer Gegnername');
        g.readyPlayer(state, 'a'); g.readyPlayer(state, 'b');
        state.board.fill(null);
        for (const [cell, owner, piece] of [[24,'a','rock'],[17,'b',kind],[35,'a','paper'],[6,'b','paper'],[41,'a','flag'],[0,'b','flag']]) state.board[cell] = { id: String(cell), owner, kind: piece, revealed: false };
        g.movePiece(state, 'a', 24, 17);
        return { ...g.viewFor(state, 'a'), roomId: 'qa' };
      }
      window.qa = {
        overlay,
        async load(id) {
          this.skin = await loadSkin({ id, name: id, file: id + '/skin.json' });
          applyUiPalette(this.skin);
        },
        turn(own) {
          const view = game('scissors'); view.phase = 'playing'; view.currentTurn = own ? 'a' : 'b';
          const referee = refereePortrait(this.skin.definition, view);
          document.querySelector('.series-scoreboard').innerHTML = seriesScoreMarkup(view, '<div class="score-referee"><span class="referee-portrait">' + (atlasIcon(this.skin, referee.frame, 76) || '') + '</span><span>' + referee.caption + '</span></div>');
          document.querySelector('.phase-card h2').textContent = own ? 'Du bist am Zug.' : 'Ein langer Gegnername ist am Zug.';
          document.querySelector('.body-copy').textContent = own ? 'Wähle eine bewegliche Figur. Die Zielmarkierungen zeigen dir ihre möglichen Ziele.' : 'Behalte die aufgedeckten Figuren im Blick und plane deinen nächsten Zug.';
        },
        encounter(kind, stage, you = 'a') {
          overlay.reset();
          const view = game(kind);
          view.you = you;
          const expected = document.createElement('template');
          expected.innerHTML = pieceIcon(this.skin, 'unknown', 104, you === 'b' ? 'own' : 'enemy', false, 'red');
          this.expectedDoor = expected.innerHTML;
          overlay.update(view, this.skin, { connected: true, pending: false });
          overlay.present(view.lastAction, view);
          overlay.clearTimers();
          overlay.setStage(stage);
        },
      };
    });
    for (const skin of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
      await page.evaluate(id => qa.load(id), skin);
      for (const [width, height] of [[390,844], [320,568], [844,390]]) {
        await page.setViewportSize({ width, height });
        const positions = [];
        for (const own of [true, false]) {
          await page.evaluate(own => qa.turn(own), own);
          positions.push(await page.evaluate(() => ['.app-header','.phase-top-host','.board-surface'].map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [r.y, r.height]; })));
        }
        assert.deepEqual(positions[0], positions[1], `${skin} ${width}x${height}: turn changes preserve header, turn panel and board position`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      for (const kind of ['trap', 'flag']) {
        await page.evaluate(kind => qa.encounter(kind, 'shatter'), kind);
        assert.equal(await page.locator('.combat-shards').count(), 0);
        assert.equal(await page.locator('.weapon-icon').count(), 0);
        assert.equal(await page.locator(kind === 'trap' ? '.combat-trap-hole .atlas-icon' : '.combat-puff .atlas-icon').count(), 1);
        if (kind === 'flag') assert.equal(await page.locator('[data-result="winner"] .combat-capture-flag').evaluate(node => getComputedStyle(node).opacity), '1');
        await page.waitForTimeout(250);
        await page.locator('.board-surface').screenshot({ path: path.join(tmpdir(), `rps-${skin}-${kind}-${touch ? 'mobile' : 'desktop'}.png`) });
        if (kind === 'trap') {
          assert.equal(await page.locator('[data-kind="trap"] .combat-art-main').innerHTML(), await page.evaluate(() => qa.expectedDoor), 'The door is the existing opponent board sprite');
          await page.waitForTimeout(500);
          const centers = await page.locator('.combat-art').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return r.left + r.width / 2; }));
          assert.ok(Math.abs(centers[0] - centers[1]) < 1, 'The victim falls at the center of the pit');
          await page.evaluate(() => qa.encounter('trap', 'shatter', 'b'));
          assert.equal(await page.locator('[data-kind="trap"] .combat-art-main').innerHTML(), await page.evaluate(() => qa.expectedDoor), 'The other viewer gets the matching rear board sprite');
        }
        await page.evaluate(() => qa.overlay.setStage('winner'));
        assert.equal(await page.locator('[data-result="loser"] .combat-art-main').evaluate(node => getComputedStyle(node).opacity), '0');
      }
      console.log(`${skin} / ${touch ? 'mobile atlas' : 'desktop atlas'}: fixed heights, trap fall and flag capture OK`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
