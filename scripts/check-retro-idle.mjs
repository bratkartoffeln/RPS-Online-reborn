/** Live two-player checks for the retro idle scene and stable mobile header. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = await startServer({ host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  for (const skin of ['icq-retro', 'icq-retro-dark']) for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390 });
    await context.addInitScript(skin => {
      localStorage.setItem('rps-arena:skin', skin);
      localStorage.setItem('rps-arena:animations', 'on');
      localStorage.setItem('rps-arena:sounds', 'on');
      window.samples = [];
      const create = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = create.call(this), start = source.start.bind(source);
        source.start = (...args) => { window.samples.push(source.buffer?.duration); start(...args); };
        return source;
      };
    }, skin);
    const blue = await context.newPage(), red = await context.newPage();
    const errors = [];
    for (const page of [blue, red]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([blue.goto(server.url), red.goto(server.url)]);
    for (const page of [blue, red]) await page.waitForFunction(() => !document.querySelector('#app').inert);
    await blue.locator('#player-name').fill('Blau');
    await blue.locator('#create-button').click();
    await blue.locator('.room-code').waitFor();
    const room = await blue.locator('.room-code').innerText();
    await red.locator('#player-name').fill('Rot');
    await red.locator('#room-input').fill(room);
    await red.locator('#join-button').click();
    await red.locator('#ready-button').waitFor();
    await blue.locator('#ready-button').click();
    await red.locator('#ready-button').click();
    await red.locator('.gong-scene[data-animated="true"]:visible').waitFor();
    const gong = await red.locator('.gong-scene[data-animated="true"]:visible').boundingBox();
    assert.ok(gong.width >= (width === 390 ? 151 : 215));
    await red.waitForFunction(() => !document.querySelector('.gong-scene[data-animated="true"]'));
    const headerHeight = await red.locator('.app-header').evaluate(el => el.getBoundingClientRect().height);
    await red.waitForTimeout(1000);
    const beforeAudio = await red.evaluate(() => window.samples.length);
    await red.locator('[data-referee-state="yawn"]:visible').waitFor({ timeout: 13000 });
    assert.equal(await red.locator('.app-header').evaluate(el => el.getBoundingClientRect().height), headerHeight);
    await red.waitForTimeout(250);
    assert.ok(await red.evaluate(count => window.samples.length > count, beforeAudio), 'Yawn sample plays');
    const img = red.locator('.referee-yawn:visible');
    assert.ok((await img.boundingBox()).width >= (width === 390 ? 151 : 179));
    await red.screenshot({ path: path.join(tmpdir(), `rps-idle-${skin}-${width}.png`) });
    await red.waitForFunction(() => !document.querySelector('[data-referee-state="yawn"]'));
    assert.deepEqual(errors, []);
    console.log(`${skin}, ${width}px: larger gong, yawn with sound, unchanged header height`);
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
