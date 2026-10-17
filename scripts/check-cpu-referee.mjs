/** Real browser/audio check with near-instant CPU thinking and deliberately slowed speech. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from '../dist/server/server/app.js';
import { CpuBrain } from '../dist/server/server/cpu.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const originalDelay = CpuBrain.prototype.delay, originalMove = CpuBrain.prototype.chooseMove;
const moves = [];
CpuBrain.prototype.delay = () => 20;
CpuBrain.prototype.chooseMove = function (view) { moves.push(Date.now()); return originalMove.call(this, view); };
const server = await startServer({ host: '127.0.0.1', port: 0, reconnectSeconds: 2 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const skin of ['classic', 'icq-retro']) for (const audible of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(({ skin, audible }) => {
      localStorage.setItem('rps-arena:skin', skin);
      localStorage.setItem('rps-arena:sounds', audible ? 'on' : 'off');
      window.samples = [];
      window.sampleKey = buffer => {
        const data = buffer.getChannelData(0); let hash = 2166136261;
        for (let j = 0; j < data.length; j += Math.max(1, Math.floor(data.length / 128))) hash = Math.imul(hash ^ Math.round(data[j] * 32767), 16777619);
        return buffer.length + ':' + (hash >>> 0);
      };
      const original = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = original.call(this), start = source.start.bind(source);
        source.start = (...args) => {
          const sample = { key: window.sampleKey(source.buffer), started: Date.now(), ended: null };
          if (sample.key === window.expectedRed) source.playbackRate.value = .5;
          window.samples.push(sample);
          source.addEventListener('ended', () => { sample.ended = Date.now(); });
          start(...args);
        };
        return source;
      };
    }, { skin, audible });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url);
    await page.waitForFunction(() => !document.querySelector('#app').inert);
    if (audible) await page.evaluate(async skin => {
      const manifest = await fetch(`/skins/${skin}/skin.json`).then(r => r.json());
      const data = await fetch(`/skins/${skin}/${manifest.audio.redTurn.file}`).then(r => r.arrayBuffer());
      const context = new AudioContext();
      window.expectedRed = window.sampleKey(await context.decodeAudioData(data));
      await context.close();
    }, skin);
    await page.locator('#player-name').fill('Schiri-Test');
    await page.locator('#opponent-select').selectOption('hard');
    await page.locator('#create-button').click();
    await page.locator('#ready-button').click();
    await page.locator('#resign-button').click();
    await page.locator('[data-action="confirm-modal"]').click();
    await page.locator('#restart-button').click();
    await page.locator('#ready-button').waitFor({ state: 'visible' });
    moves.length = 0;
    await page.locator('#ready-button').click(); // CPU opens the second game.
    if (audible) {
      await page.waitForFunction(() => window.samples.some(s => s.key === window.expectedRed));
      assert.equal(moves.length, 0, 'CPU must still wait when the referee starts speaking');
      await page.waitForFunction(() => window.samples.some(s => s.key === window.expectedRed && s.ended !== null));
    }
    const deadline = Date.now() + 15000;
    while (!moves.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(moves.length, 1, 'exactly one CPU opening move, including with muted audio');
    if (audible) {
      const ended = await page.evaluate(() => window.samples.find(s => s.key === window.expectedRed).ended);
      assert.ok(moves[0] >= ended, 'CPU move must occur after actual audio completion');
    }
    assert.deepEqual(errors, []);
    await page.locator('#leave-button').click();
    await page.locator('[data-action="confirm-modal"]').click();
    await page.locator('#create-button').waitFor({ state: 'visible' });
    console.log(`${skin}, sound ${audible ? 'on' : 'off'}: CPU waits for the full referee presentation`);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
  CpuBrain.prototype.delay = originalDelay;
  CpuBrain.prototype.chooseMove = originalMove;
}
