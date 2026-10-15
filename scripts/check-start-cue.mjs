/** Real ready/start/reload lifecycle, directional symbols and scheduled audio. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = await startServer({ host: '127.0.0.1', port: 0 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const skin of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', isMobile: viewport.width === 390, hasTouch: viewport.width === 390 });
    await context.addInitScript(skin => {
      localStorage.setItem('rps-arena:skin', skin);
      localStorage.setItem('rps-arena:sounds', 'on');
      localStorage.setItem('rps-arena:animations', 'on');
      window.gongTones = [];
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        const oscillator = original.call(this);
        const start = oscillator.start.bind(oscillator);
        oscillator.start = when => { window.gongTones.push({ frequency: oscillator.frequency.value, delay: when - this.currentTime }); start(when); };
        return oscillator;
      };
    }, skin);
    const [blue, red] = await Promise.all([context.newPage(), context.newPage()]);
    const errors = [];
    for (const page of [blue, red]) page.on('pageerror', e => errors.push(e.message));
    await Promise.all([blue.goto(server.url), red.goto(server.url)]);
    await Promise.all([blue, red].map(page => page.waitForFunction(() => !document.querySelector('#app').inert)));
    await blue.locator('#player-name').fill('Blau');
    await blue.locator('#create-button').click();
    await blue.locator('.room-code').waitFor({ state: 'visible' });
    const room = await blue.locator('.room-code').innerText();
    await red.locator('#player-name').fill('Rot');
    await red.locator('#room-input').fill(room);
    await red.locator('#join-button').click();
    await red.locator('#ready-button').waitFor({ state: 'visible' });
    assert.ok(await blue.locator('.gong-scene:visible').isVisible(), 'The resting gong is visible throughout setup');
    await blue.locator('#ready-button').click();
    assert.equal(await blue.locator('.gong-scene[data-animated="true"]').count(), 0, 'One ready player does not start a gong');
    await red.bringToFront();
    await red.locator('#ready-button').click();
    await red.waitForFunction(() => document.querySelector('.score-referee .gong-scene[data-animated="true"]'));
    assert.ok(await red.locator('.gong-scene[data-animated="true"]:visible').isVisible(), 'The actual visible referee position animates');
    assert.equal(await red.locator('#board').getAttribute('aria-busy'), 'true');
    const tones = await red.evaluate(() => window.gongTones);
    assert.equal(tones.length, skin === 'arcade' ? 4 : 6, 'Exactly one start chime is synthesized');
    assert.ok(tones[0].delay >= .3 && tones[0].delay <= .4, 'The sound is scheduled at the mallet impact');
    await red.waitForTimeout(230);
    await red.locator('.gong-scene:visible').screenshot({ path: path.join(tmpdir(), `rps-start-${skin}-${viewport.width}.png`) });
    await red.waitForFunction(() => !document.querySelector('.score-referee .gong-scene'));
    const portrait = red.locator('.score-referee .referee-portrait');
    assert.equal(await portrait.getAttribute('data-turn-team'), 'blue');
    assert.equal(await portrait.getAttribute('data-turn-direction'), 'top');
    await blue.bringToFront();
    await blue.locator('.score-referee .referee-portrait[data-turn-direction="bottom"]').waitFor({ state: 'attached' });
    assert.equal(await blue.locator('.score-referee .referee-portrait').getAttribute('data-turn-direction'), 'bottom');
    await red.reload();
    await red.waitForFunction(() => !document.querySelector('#app').inert && document.querySelector('#shell').dataset.phase === 'playing');
    assert.equal(await red.locator('.gong-scene').count(), 0, 'Reloading never replays the start');
    assert.equal(await red.evaluate(() => window.gongTones.length), 0);
    assert.deepEqual(errors, []);
    console.log(`${skin} ${viewport.width}px: visible setup/start gong, synchronized audio, both directions and reload OK`);
    await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
