/** Integration check after npm run build; optional argument: installed playwright directory. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../dist/server/server/app.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 5 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const [blue, red] = await Promise.all([context.newPage(), context.newPage()]);
  const errors = [];
  for (const page of [blue, red]) page.on('pageerror', error => errors.push(error.message));
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
  async function ready() {
    await blue.locator('#ready-button').click();
    await red.locator('#ready-button').click();
    await blue.locator('#resign-button').waitFor({ state: 'visible' });
  }
  async function resign(page) {
    await page.locator('#resign-button').click();
    await page.locator('[data-action="confirm-modal"]').click();
    await Promise.all([blue, red].map(tab => tab.locator('#endgame-overlay').waitFor({ state: 'visible' })));
  }
  async function verify(color) {
    for (const page of [blue, red]) {
      const root = page.locator('#endgame-overlay');
      assert.equal(await root.getAttribute('data-winner-team'), color);
      const skin = await page.evaluate(() => document.documentElement.dataset.skin);
      const directory = `/skins/${skin}/endgame/`;
      assert.equal(await root.locator('.endgame-referee img').getAttribute('src'), directory + 'referee-' + color + '.svg');
      assert.equal(await root.locator('[data-mood="happy"]').getAttribute('data-team-color'), color);
      assert.equal(await root.locator('.endgame-player').nth(0).getAttribute('data-team-color'), 'blue');
      assert.equal(await root.locator('.endgame-player').nth(1).getAttribute('data-team-color'), 'red');
      assert.equal(await root.locator('.endgame-referee img').evaluate(img => getComputedStyle(img).transform), color === 'blue' ? 'matrix(-1, 0, 0, 1, 0, 0)' : 'none');
      assert.equal(await root.locator('.endgame-result').evaluate(result => getComputedStyle(result).borderBottomWidth), '2px');
      assert.equal(await root.locator('.endgame-referee img').getAttribute('alt'), 'Siegeranzeige: ' + (color === 'blue' ? 'Blau, links' : 'Rot, rechts'));
      assert.notEqual(await root.locator('[data-mood="sad"]').getAttribute('data-team-color'), color);
      assert.ok(await page.locator('#restart-button').isVisible());
      assert.equal(await root.locator('button').count(), 0, 'No dismissal control');
      assert.ok(await root.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)));
    }
  }
  await ready();
  await resign(red);
  await verify('blue');
  await blue.bringToFront();
  for (const skin of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    await blue.locator('#skin-select').selectOption(skin, { force: true });
    await blue.waitForFunction(id => document.documentElement.dataset.skin === id, skin);
    for (const [width, height] of [[1280, 900], [390, 844], [320, 568], [844, 390]]) {
      await blue.setViewportSize({ width, height });
      await blue.evaluate(() => scrollTo(0, 0));
      await blue.waitForTimeout(250);
      const bounds = await blue.locator('#endgame-overlay').evaluate(root => {
        const overlay = root.getBoundingClientRect(), result = root.querySelector('.endgame-result').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, fits: result.top >= overlay.top - 1 && result.bottom <= overlay.bottom + 1, centered: Math.abs((result.top + result.bottom) / 2 - (overlay.top + overlay.bottom) / 2) < 1 };
      });
      assert.equal(bounds.overflow, false);
      assert.equal(bounds.fits, true, `${skin} ${width}x${height}: end scene fits board`);
      assert.equal(bounds.centered, true, `${skin} ${width}x${height}: end scene is vertically centered`);
      const directory = `/skins/${skin}/endgame/`;
      assert.ok(await blue.locator('#endgame-overlay img').evaluateAll((images, prefix) => images.every(img => img.getAttribute('src').startsWith(prefix) && img.complete && img.naturalWidth > 0), directory));
      assert.equal(await blue.locator('.score-referee .gong-scene[data-animated="false"]').count(), 1, 'The regular referee position becomes a resting gong at game end');
      assert.equal(await blue.locator('.score-referee [data-turn-team]').count(), 0, 'No second referee beside the winner scene');
      if (width === 390) await blue.locator('.board-surface').screenshot({ path: path.join(tmpdir(), `rps-endgame-${skin}.png`) });
    }
    console.log(`${skin}: blue winner, sad red player and raised blue flag fit all viewport sizes`);
  }
  await blue.waitForTimeout(4200);
  assert.ok(await blue.locator('#endgame-overlay').isVisible(), 'End scene has no automatic timeout');
  await blue.locator('#endgame-overlay').click({ force: true });
  assert.ok(await blue.locator('#endgame-overlay').isVisible(), 'Board click does not dismiss result');
  await blue.reload();
  await blue.locator('#endgame-overlay').waitFor({ state: 'visible' });
  await verify('blue');
  await blue.locator('#restart-button').click();
  assert.ok(await blue.locator('#endgame-overlay').isVisible(), 'One continuation vote keeps the result');
  await red.locator('#restart-button').click();
  for (const page of [blue, red]) {
    await page.locator('#ready-button').waitFor({ state: 'visible' });
    assert.ok(await page.locator('#endgame-overlay').isHidden(), 'A new game clears the old result');
  }
  await ready();
  await resign(blue);
  await verify('red');
  await blue.locator('.board-surface').screenshot({ path: path.join(tmpdir(), 'rps-endgame-red-winner.png') });
  assert.deepEqual(errors, []);
  console.log('Both viewers, red winner, persistence, reload, continuation votes and next-game reset OK');
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
