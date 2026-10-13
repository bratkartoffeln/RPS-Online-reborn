/** Browser regression check after npm run build. Optional dependency: playwright.
 * An existing module directory may be passed as argv[2].
 */
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
  for (const mobile of [false, true]) {
    const errors = [];
    const settings = { viewport: mobile ? { width: 390, height: 600 } : { width: 1280, height: 600 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' };
    const contexts = await Promise.all([browser.newContext(settings), browser.newContext(settings)]);
    const [reader, sender] = await Promise.all(contexts.map(context => context.newPage()));
    for (const page of [reader, sender]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([reader.goto(server.url), sender.goto(server.url)]);
    await Promise.all([reader, sender].map(page => page.waitForFunction(() => !document.querySelector('#app').inert)));
    await reader.locator('#player-name').fill('Leser');
    await reader.locator('#create-button').click();
    await reader.locator('#room-chat').waitFor({ state: 'visible' });
    const code = await reader.locator('.room-code').innerText();
    await sender.locator('#player-name').fill('Sender');
    await sender.locator('#room-input').fill(code);
    await sender.locator('#join-button').click();
    await sender.locator('#room-chat').waitFor({ state: 'visible' });
    const send = async (page, text) => {
      // Respect the server's 500 ms per-player chat rate limit.
      await page.waitForTimeout(550);
      await page.locator('#chat-input').fill(text);
      await page.locator('#chat-send').click();
      await page.waitForFunction(() => document.querySelector('#chat-input').value === '');
    };
    for (const id of ['classic', 'arcade', 'icq-retro']) {
      await reader.locator('#skin-select').selectOption(id, { force: true });
      await reader.waitForFunction(id => document.documentElement.dataset.skin === id, id);
      await send(sender, `${id}: Nachricht lesen`);
      const badge = reader.locator('.referee-chat-notice');
      await badge.waitFor({ state: 'visible' });
      assert.equal(await badge.locator('.atlas-icon').count(), 1, id + ': atlas artwork');
      const artworkUrl = await badge.locator('.atlas-icon').evaluate(element => element.style.backgroundImage);
      assert.match(artworkUrl, mobile && id === 'icq-retro' ? /atlas-mobile\.webp/ : /atlas\.(svg|png)|master\.svg/);
      await reader.waitForTimeout(2300);
      assert.ok(await badge.isVisible(), 'Unread message must survive the old timeout');
      await reader.locator('#board').evaluate(element => element.scrollIntoView());
      await badge.click();
      assert.ok(await badge.isHidden(), 'Click dismisses the notice');
      assert.equal(await reader.evaluate(() => document.activeElement.id), 'chat-input');
      const chatScroll = await reader.evaluate(() => scrollY);
      await reader.locator('[data-action="back-to-board"]').click();
      assert.equal(await reader.evaluate(() => document.activeElement.id), 'board');
      assert.ok(await reader.evaluate(() => scrollY) < chatScroll, 'Return button scrolls up');
      await send(sender, `${id}: eigene Antwort`);
      await badge.waitFor({ state: 'visible' });
      await send(reader, `${id}: bestätigt`);
      assert.ok(await badge.isHidden(), 'Sending dismisses the notice');
      const summary = reader.locator('#match-overview > summary');
      const closed = await summary.evaluate(element => getComputedStyle(element, '::after').transform);
      await summary.click();
      assert.ok(await reader.locator('#match-overview').evaluate(element => element.open));
      await reader.waitForFunction(previous => getComputedStyle(document.querySelector('#match-overview > summary'), '::after').transform !== previous, closed);
      const opened = await summary.evaluate(element => getComputedStyle(element, '::after').transform);
      assert.notEqual(opened, closed, 'Accordion indicator follows open state');
      await summary.click();
      await send(sender, `${id}: Vorschau`);
      await badge.waitFor({ state: 'visible' });
      await badge.screenshot({ path: path.join(tmpdir(), `rps-chat-${id}-${mobile ? 'mobile' : 'desktop'}.png`) });
      await badge.click();
      console.log(`${mobile ? 'Mobil' : 'Desktop'} / ${id}: Atlas, dauerhafter Hinweis, Klick, Antwort, Scrollen und Klappindikator OK`);
    }
    assert.deepEqual(errors, []);
    await Promise.all(contexts.map(context => context.close()));
  }
} finally {
  await browser?.close();
  await server.close();
}
