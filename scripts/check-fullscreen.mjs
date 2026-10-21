/** Real browser checks for layout, fullscreen APIs and board interaction. Run after build. */
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../dist/server/server/app.js';

const server = await startServer({ host: '127.0.0.1', port: 0, reconnectSeconds: 1 });
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.RPS_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.RPS_CHROMIUM_EXECUTABLE } : process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(() => !document.querySelector('#app').inert);
  assert.equal(await page.locator('#fullscreen-button').isVisible(), false);
  await page.locator('#player-name').fill('Vollbildtest');
  await page.locator('#create-button').click();
  await page.locator('#ready-button').waitFor();

  // Exercise the native browser API and a browser-initiated exit first.
  await page.locator('#fullscreen-button').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.documentElement.classList.contains('game-fullscreen'));
  assert.equal(await page.locator('#fullscreen-button').getAttribute('aria-pressed'), 'false');
  // Also exercise the maximized fallback used when a browser has no Fullscreen API.
  await page.evaluate(() => Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => false }));
  for (const skin of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    await page.locator('#skin-select').selectOption(skin, { force: true });
    await page.waitForFunction(value => document.documentElement.dataset.skin === value, skin);
    await page.locator('#fullscreen-button').click();
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568], [844, 390], [568, 320], [1280, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      const layout = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        return { board: rect('#board'), referee: rect('.score-referee'), button: rect('#fullscreen-button'),
          actions: rect('#phase-controls'), width: innerWidth, height: innerHeight };
      });
      for (const [name, rect] of Object.entries(layout).filter(([, value]) => typeof value === 'object')) {
        assert.ok(rect.left >= -1 && rect.right <= width + 1 && rect.top >= -1 && rect.bottom <= height + 1,
          `${skin} ${width}x${height}: ${name} fits ${JSON.stringify(layout)}`);
      }
      assert.ok(layout.board.height >= 130, 'The board remains usable');
      assert.ok(await page.locator('.score-referee').isVisible());
      assert.ok(await page.locator('#ready-button').isVisible());
      assert.equal(await page.locator('#room-chat').isVisible(), false);
      if (skin === 'icq-retro-dark') await page.screenshot({ path: path.join(tmpdir(), `rps-fullscreen-${width}x${height}.png`) });
      console.log(`${skin}: ${width}x${height} fits board, referee and controls`);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#fullscreen-button').getAttribute('aria-pressed'), 'false');
  }
  // An explicit API rejection must leave an escapable, fully playable fallback.
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { get: () => true });
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('Fullscreen denied by test'));
  });
  await page.locator('#fullscreen-button').click();
  await page.locator('#board').focus();
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.locator('#board-focus').textContent());
  await page.locator('#ready-button').click();
  assert.ok(await page.locator('#phase-controls').innerText().then(text => /bereit|Warte/.test(text)));
  await page.locator('#fullscreen-button').click();
  assert.equal(await page.locator('#fullscreen-button').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
  console.log('Browser fullscreen, external exit, Escape, fallback and board keyboard input passed.');
} finally {
  await browser?.close();
  await server.close();
}
