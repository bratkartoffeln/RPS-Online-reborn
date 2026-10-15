/** Real ready/start/reload lifecycle, directional symbols and scheduled audio. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = await startServer({ host: '127.0.0.1', port: 0, reconnectSeconds: 5 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const skin of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark'].filter(id => !process.env.RPS_QA_SKIN || id === process.env.RPS_QA_SKIN)) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', isMobile: viewport.width === 390, hasTouch: viewport.width === 390 });
    await context.addInitScript(skin => {
      localStorage.setItem('rps-arena:skin', skin);
      // Fresh browsers hear the gong without first opening settings.
      localStorage.removeItem('rps-arena:sounds');
      localStorage.setItem('rps-arena:animations', 'on');
      window.gongSamples = [];
      const original = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const oscillator = original.call(this);
        const start = oscillator.start.bind(oscillator);
        oscillator.start = when => {
          const sample = { duration: oscillator.buffer?.duration, delay: when - this.currentTime, started: performance.now(), ended: null };
          window.gongSamples.push(sample);
          oscillator.addEventListener('ended', () => { sample.ended = performance.now(); }, { once: true });
          start(when);
        };
        return oscillator;
      };
    }, skin);
    const [blue, red] = await Promise.all([context.newPage(), context.newPage()]);
    const errors = [];
    for (const page of [blue, red]) page.on('pageerror', e => errors.push(e.message));
    await Promise.all([blue.goto(server.url), red.goto(server.url)]);
    await Promise.all([blue, red].map(page => page.waitForFunction(() => !document.querySelector('#app').inert)));
    await blue.locator('#player-name').fill('Blau');
    await blue.bringToFront();
    await blue.locator('#create-button').click();
    await blue.locator('.room-code').waitFor({ state: 'visible' });
    const room = await blue.locator('.room-code').innerText();
    await blue.waitForFunction(() => window.gongSamples.length === 1);
    await blue.waitForFunction(() => window.gongSamples[0].ended !== null);
    await red.locator('#player-name').fill('Rot');
    await red.locator('#room-input').fill(room);
    await red.bringToFront();
    await red.locator('#join-button').click();
    await red.locator('#ready-button').waitFor({ state: 'visible' });
    await red.waitForFunction(() => window.gongSamples.length === 1);
    await red.waitForFunction(() => window.gongSamples[0].ended !== null);
    await red.locator('#shuffle-button').click();
    await red.waitForFunction(() => window.gongSamples.length === 2);
    await red.waitForFunction(() => window.gongSamples[1].ended !== null);
    await red.reload();
    await red.waitForFunction(() => !document.querySelector('#app').inert && document.querySelector('#ready-button'));
    assert.equal(await red.evaluate(() => window.gongSamples.length), 0, 'Restoring setup does not replay the shuffle');
    console.log(`${skin} ${viewport.width}px: initial setup and shuffle play once; setup reload stays silent`);
    await blue.evaluate(() => { window.gongSamples = []; });
    await red.evaluate(() => { window.gongSamples = []; });
    assert.ok(await blue.locator('.gong-scene:visible').isVisible(), 'The resting gong is visible throughout setup');
    await blue.locator('#ready-button').click();
    assert.equal(await blue.locator('.gong-scene[data-animated="true"]').count(), 0, 'One ready player does not start a gong');
    await red.bringToFront();
    await red.locator('#ready-button').click();
    await red.waitForFunction(() => document.querySelector('.score-referee .gong-scene[data-animated="true"]'));
    assert.ok(await red.locator('.gong-scene[data-animated="true"]:visible').isVisible(), 'The actual visible referee position animates');
    assert.equal(await red.locator('#board').getAttribute('aria-busy'), 'true');
    await red.waitForFunction(() => window.gongSamples.length > 0);
    const tones = await red.evaluate(() => window.gongSamples);
    assert.equal(tones.length, 1, 'Exactly one local gong sample is scheduled');
    assert.ok(tones[0].duration > .5, 'The decoded gong has actual audio frames');
    assert.ok(tones[0].delay >= .2 && tones[0].delay <= .4, 'The sound is scheduled at the mallet impact');
    await red.waitForTimeout(230);
    await red.locator('.gong-scene:visible').screenshot({ path: path.join(tmpdir(), `rps-start-${skin}-${viewport.width}.png`) });
    await red.waitForFunction(() => {
      const sample = window.gongSamples[0];
      return sample.ended !== null || performance.now() >= sample.started + (sample.delay + sample.duration) * 1000 - 100;
    });
    if (await red.evaluate(() => window.gongSamples[0].ended === null)) {
      assert.ok(await red.locator('.gong-scene[data-animated="true"]:visible').isVisible(), 'The gong still vibrates near the end of its actual sample');
    }
    await red.waitForFunction(() => !document.querySelector('.score-referee .gong-scene'));
    await red.waitForFunction(() => window.gongSamples.length === 2);
    const portrait = red.locator('.score-referee .referee-portrait');
    assert.equal(await portrait.getAttribute('data-turn-team'), 'blue');
    assert.equal(await portrait.getAttribute('data-turn-direction'), 'top');
    await blue.bringToFront();
    await blue.locator('.score-referee .referee-portrait[data-turn-direction="bottom"]').waitFor({ state: 'attached' });
    assert.equal(await blue.locator('.score-referee .referee-portrait').getAttribute('data-turn-direction'), 'bottom');
    if (viewport.width === 1280) {
      await blue.waitForFunction(() => document.querySelector('#board').getAttribute('aria-busy') === 'false');
      await blue.waitForTimeout(1800);
      await blue.evaluate(() => { window.gongSamples = []; });
      const board = blue.locator('#board');
      await board.focus();
      await board.press('ArrowUp');
      for (let step = 0; step < 3; step++) await board.press('ArrowLeft');
      let column = -1;
      for (let candidate = 0; candidate < 7; candidate++) {
        await board.press('Enter');
        if ((await blue.locator('#board-hint').textContent()).includes('markiertes Ziel')) { column = candidate; break; }
        await board.press('ArrowRight');
      }
      assert.ok(column >= 0, 'A front-row piece can move into the empty middle');
      await board.press('ArrowUp');
      await board.press('Enter');
      await blue.waitForFunction(() => window.gongSamples.length > 0);
      assert.equal(await blue.locator('.score-referee .referee-portrait').getAttribute('data-turn-team'), 'neutral');
      assert.equal(await blue.locator('#board').getAttribute('aria-busy'), 'true');
      await blue.waitForFunction(() => window.gongSamples[0].ended !== null);
      await blue.waitForTimeout(800);
      assert.equal(await blue.locator('.score-referee .referee-portrait').getAttribute('data-turn-team'), 'neutral');
      await blue.waitForFunction(() => window.gongSamples.length === 2);
      const samples = await blue.evaluate(() => window.gongSamples);
      assert.ok(samples[1].started - samples[0].ended >= 990, 'The next turn is announced after a full quiet second');
      assert.equal(await blue.locator('.score-referee .referee-portrait').getAttribute('data-turn-team'), 'red');
      console.log(`${skin}: move sound completes, then one quiet second before the red indicator and announcement`);
    }
    await red.reload();
    await red.waitForFunction(() => !document.querySelector('#app').inert && document.querySelector('#shell').dataset.phase === 'playing');
    assert.equal(await red.locator('.gong-scene').count(), 0, 'Reloading never replays the start');
    assert.equal(await red.evaluate(() => window.gongSamples.length), 0);
    assert.deepEqual(errors, []);
    console.log(`${skin} ${viewport.width}px: visible setup/start gong, synchronized audio, both directions and reload OK`);
    await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
