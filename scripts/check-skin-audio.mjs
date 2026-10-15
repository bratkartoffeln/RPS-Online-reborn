/** Decode every packaged sample and verify the portable sound/art preview in a real browser. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const server = await startServer({ host: '127.0.0.1', port: 0 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1050, height: 850 } });
  const errors = [], failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
    await page.goto(`${server.url}/skins/${id}/preview.html`);
    await page.waitForFunction(() => document.querySelectorAll('audio').length >= 20);
    const samples = await page.evaluate(async () => {
      const context = new AudioContext(), rows = [];
      for (const audio of document.querySelectorAll('audio')) {
        const response = await fetch(audio.src);
        if (!response.ok) throw new Error(audio.src + ': ' + response.status);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        const pcm = buffer.getChannelData(0);
        let peak = 0, head = 0, tail = 0;
        const windowSize = Math.min(pcm.length, Math.round(buffer.sampleRate * .2));
        for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
        for (let i = 0; i < windowSize; i++) { head += pcm[i] ** 2; tail += pcm[pcm.length - windowSize + i] ** 2; }
        rows.push({ file: new URL(audio.src).pathname, duration: buffer.duration, peak, volume: audio.volume, head: Math.sqrt(head / windowSize), tail: Math.sqrt(tail / windowSize) });
      }
      await context.close();
      return rows;
    });
    assert.equal(samples.length, 20, `${id}: all cues and both team variants have preview controls`);
    for (const sample of samples) {
      assert.ok(sample.peak > .001 && sample.peak * sample.volume <= 1, `${sample.file}: audible without clipping at its configured gain`);
      assert.ok(sample.duration > .03 && sample.duration <= 10, `${sample.file}: bounded duration`);
      assert.ok(sample.file.startsWith(`/skins/${id}/audio/`), 'No cross-pack audio dependencies');
    }
    if (id.startsWith('icq')) {
      const gong = samples.find(sample => sample.file.endsWith('/original-gong.wav'));
      assert.ok(gong.duration > 2.8 && gong.duration < 3.1, 'Gong retains a long decay');
      assert.ok(gong.tail < gong.head / 20, 'Gong fades gradually into silence');
      const red = samples.find(sample => sample.file.endsWith('/original-redTurn.wav'));
      assert.ok(red.duration > 1.2 && red.duration < 1.5, 'Complete isolated red-turn phrase');
    }
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    const first = page.locator('audio').first();
    await first.scrollIntoViewIfNeeded();
    await first.evaluate(audio => audio.play());
    await page.waitForFunction(() => document.querySelector('audio').currentTime > .05);
    await first.evaluate(audio => audio.pause());
    console.log(`${id}: 20 local clips decoded, playback, artwork, isolated speech and gong decay OK`);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
} finally {
  await browser?.close();
  await server.close();
}
