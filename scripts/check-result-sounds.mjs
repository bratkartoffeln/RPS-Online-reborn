/** Two real clients: resignation announces both results; lobby departure only the survivor. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = await startServer({ host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const pages = [], errors = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('rps-arena:skin', 'icq-retro');
      localStorage.setItem('rps-arena:sounds', 'on');
      localStorage.setItem('rps-arena:animations', 'off');
      window.samples = [];
      window.sampleKey = buffer => {
        const data = buffer.getChannelData(0); let hash = 2166136261;
        for (let j = 0; j < data.length; j += Math.max(1, Math.floor(data.length / 128))) {
          hash = Math.imul(hash ^ Math.round(data[j] * 32767), 16777619);
        }
        return buffer.length + ':' + (hash >>> 0);
      };
      const original = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = original.call(this), start = source.start.bind(source);
        source.start = (...args) => { window.samples.push(window.sampleKey(source.buffer)); start(...args); };
        return source;
      };
    });
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => !document.querySelector('#app').inert);
  }
  const [blue, red] = pages;
  await blue.locator('#player-name').fill('Blau'); await blue.locator('#create-button').click();
  await blue.locator('.room-code').waitFor(); const room = await blue.locator('.room-code').innerText();
  await red.locator('#player-name').fill('Rot'); await red.locator('#room-input').fill(room); await red.locator('#join-button').click();
  async function ready() {
    for (const page of pages) await page.locator('#ready-button').click();
    for (const page of pages) {
      await page.waitForFunction(() => document.querySelector('#shell').dataset.phase === 'playing' && document.querySelector('#board').getAttribute('aria-busy') === 'false');
      await page.waitForTimeout(1500);
      await page.evaluate(async () => {
        const skin = await fetch('/skins/icq-retro/skin.json').then(r => r.json());
        const ctx = new AudioContext(); window.expected = {};
        for (const cue of ['youWin', 'youLose']) {
          const data = await fetch('/skins/icq-retro/' + skin.audio[cue].file).then(r => r.arrayBuffer());
          window.expected[cue] = window.sampleKey(await ctx.decodeAudioData(data));
        }
        await ctx.close(); window.samples = [];
      });
    }
  }
  async function result(page, cue) {
    await page.locator('#endgame-overlay').waitFor({ state: 'visible' });
    await page.waitForFunction(cue => window.samples.includes(window.expected[cue]), cue);
    assert.equal(await page.evaluate(cue => window.samples.filter(key => key === window.expected[cue]).length, cue), 1);
  }
  await ready();
  await red.locator('#resign-button').click(); await red.locator('[data-action="confirm-modal"]').click();
  await result(blue, 'youWin'); await result(red, 'youLose');
  console.log('Resignation: winner and loser each hear the matching result exactly once');
  for (const page of pages) await page.locator('#restart-button').click();
  await ready();
  await red.locator('#leave-button').click(); await red.locator('[data-action="confirm-modal"]').click();
  await red.locator('#player-name').waitFor(); await result(blue, 'youWin');
  assert.equal(await red.locator('#endgame-overlay').isVisible(), false);
  assert.equal(await red.evaluate(() => window.samples.filter(key => Object.values(window.expected).includes(key)).length), 0);
  assert.deepEqual(errors, []);
  console.log('Lobby departure: only the remaining opponent receives a winning overlay and sound');
  // Leave the surviving session explicitly so teardown does not wait for reconnection.
  await blue.locator('[data-action="leave"]:visible').first().click();
  await blue.locator('[data-action="confirm-modal"]').click();
  await blue.locator('#player-name').waitFor();
} finally { await browser.close(); await server.close(); }
