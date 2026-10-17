/** Browser smoke check: lobby choice, CPU setup, reload, return and mobile layout. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = await startServer({ host: '127.0.0.1', port: 0, reconnectSeconds: 2 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url);
    await page.waitForFunction(() => !document.querySelector('#app').inert);
    await page.locator('#player-name').fill('CPU Tester');
    for (const [difficulty, name] of [['easy', 'Mochi'], ['medium', 'Kiko'], ['hard', 'Mr. Miyagi']]) {
      await page.locator('#opponent-select').selectOption(difficulty);
      assert.ok((await page.locator('#create-button').innerText()).includes(name));
      assert.ok((await page.locator('#player-name').inputValue()) === 'CPU Tester');
    }
    await page.locator('#series-mode').selectOption('best-of-3');
    await page.locator('#create-button').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.TEMP}/rps-cpu-lobby-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#create-button').click();
    await page.locator('#ready-button').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#copy-button').count(), 0);
    assert.equal(await page.locator('#room-chat').isVisible(), false);
    assert.ok((await page.locator('.players').innerText()).includes('Mr. Miyagi'));
    await page.locator('#ready-button').click();
    await page.locator('#resign-button').waitFor({ state: 'visible' });
    await page.reload();
    await page.locator('#resign-button').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#series-scoreboard').innerText()).includes('Mr. Miyagi'));
    await page.locator('#leave-button').click();
    await page.locator('[data-action="confirm-modal"]').click();
    await page.locator('#opponent-select').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#opponent-select').inputValue(), 'hard');
    await page.locator('#opponent-select').selectOption('human');
    await page.locator('#create-button').click();
    await page.locator('#copy-button').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#room-chat').isVisible(), true);
    assert.deepEqual(errors, []);
    await page.locator('#leave-button').click();
    await page.locator('[data-action="confirm-modal"]').click();
    await page.locator('#opponent-select').waitFor({ state: 'visible' });
    console.log(`CPU browser check passed at ${width}px`);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
