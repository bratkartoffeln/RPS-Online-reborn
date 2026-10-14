/** Check primary actions and board at desktop, tablet and phone sizes after npm run build. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../dist/server/server/app.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 1 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const [page, opponent] = await Promise.all([context.newPage(), context.newPage()]);
  const errors = [];
  for (const tab of [page, opponent]) tab.on('pageerror', error => errors.push(error.message));
  await Promise.all([page.goto(server.url), opponent.goto(server.url)]);
  await page.waitForFunction(() => !document.querySelector('#app').inert && !document.querySelector('#design-icq-retro-dark').disabled);
  await page.locator('#design-icq-retro-dark').click();
  await page.waitForFunction(() => document.documentElement.dataset.skin === 'icq-retro-dark');
  await page.locator('#player-name').fill('Spielerin mit langem Namen');
  await page.locator('#create-button').click();
  await page.locator('.room-code').waitFor({ state: 'visible' });
  const room = await page.locator('.room-code').innerText();
  await opponent.locator('#player-name').fill('Gegner mit langem Namen');
  await opponent.locator('#room-input').fill(room);
  await opponent.locator('#join-button').click();
  await opponent.locator('#ready-button').waitFor({ state: 'visible' });
  await page.bringToFront();
  const viewports = [[1280, 900], [1280, 850], [1024, 768], [900, 700], [768, 1024], [390, 844], [320, 568], [844, 390], [1280, 900]];
  async function check(phase) {
    let initialBoardWidth;
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(500);
      const compact = width <= 1000 || height <= 800;
      const rects = await page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        return { board: rect(document.querySelector('#board')), actions: [...document.querySelectorAll('#phase-controls button')].map(rect), overflow: document.documentElement.scrollWidth > innerWidth, shell: document.querySelector('#shell').className, media: matchMedia('(max-width: 1000px), (max-height: 800px)').matches, referee: getComputedStyle(document.querySelector('.score-referee')).display };
      });
      assert.equal(rects.overflow, false, `${width}x${height}: no horizontal overflow`);
      if ((await page.locator('.score-referee').isVisible()) !== compact) console.log(JSON.stringify({ width, height, rects, errors }));
      assert.equal(await page.locator('.score-referee').isVisible(), compact);
      assert.equal(await page.locator('#phase-top-host').isVisible(), compact);
      if (width === 1280 && height === 900) {
        if (initialBoardWidth === undefined) initialBoardWidth = rects.board.width;
        else assert.ok(Math.abs(initialBoardWidth - rects.board.width) < 2, 'Board grows back after returning from a small viewport');
      }
      assert.ok(rects.board.bottom <= height + 1, `${phase} ${width}x${height}: board fits: ${JSON.stringify(rects)}`);
      if (compact) {
        assert.ok(rects.board.height >= 119, JSON.stringify(rects));
        assert.ok(rects.board.bottom <= height + 1, `${phase} ${width}x${height}: board fits: ${JSON.stringify(rects)}`);
        assert.ok(rects.actions.every(button => button.top >= 0 && button.bottom <= rects.board.top), `${phase}: all primary actions above board`);
        assert.ok(await page.locator('.phase-referee').isHidden());
      } else {
        assert.ok(await page.locator('.phase-sidebar-host .phase-card').isVisible());
      }
      assert.equal(await page.locator(phase === 'setup' ? '#ready-button' : '#restart-button').count(), 1, 'No duplicated action IDs after resize');
      if (width === 390 || width === 900) await page.screenshot({ path: path.join(tmpdir(), `rps-layout-${phase}-${width}.png`), fullPage: true });
      console.log(`${phase}: ${width}x${height} OK`);
    }
  }
  await check('setup');
  await page.locator('#ready-button').click();
  await opponent.locator('#ready-button').click();
  await page.locator('#resign-button').click();
  await page.locator('[data-action="confirm-modal"]').click();
  await page.locator('#restart-button').waitFor({ state: 'visible' });
  await check('finished');
  assert.deepEqual(errors, []);
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
