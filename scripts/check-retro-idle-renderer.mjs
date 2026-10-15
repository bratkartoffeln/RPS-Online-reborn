/** Exercise the real Phaser board without exposing test controls in the game. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { startServer } from '../dist/server/server/app.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const bundle = await build({
  stdin: { resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
    import { ArenaBoard } from './client/board';
    import { loadSkin } from './client/skins';
    window.ready = (async () => {
      const skin = await loadSkin({id: window.skinId, name: 'Retro', file: window.skinId + '/skin.json'});
      window.board = new ArenaBoard(document.querySelector('#board'), {onCell() {}, onFocus() {}});
      await window.board.whenReady(); window.board.setSkin(skin);
      window.scene = window.board.scene;
    })();` },
  bundle: true, write: false, format: 'iife', minify: true,
});
const server = await startServer({ host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  for (const id of ['icq-retro', 'icq-retro-dark']) for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 800, height: 740 }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(server.url + '/', route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width"><body style="margin:0;background:#a5b595"><div id="board" style="width:min(100vw,680px);aspect-ratio:680/616"></div></body>' }));
    await page.goto(server.url);
    await page.evaluate(id => { window.skinId = id; }, id);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => window.ready);
    assert.equal(await page.evaluate(() => window.scene.textures.get(window.scene.textureKey).source[0].width), mobile ? 1008 : 2016, 'Retina does not inflate the retro GPU atlas');
    assert.deepEqual(await page.evaluate(async id => {
      const png = new Image(); png.src = '/skins/' + id + '/atlas.png'; await png.decode();
      return [png.naturalWidth, png.naturalHeight];
    }, id), [2016, 2620], 'Losslessly recompressed PNG decodes correctly');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.scene.sys.game.loop.running), false, 'Renderer sleeps between animations');
    const blink = await page.evaluate(() => {
      const s = window.scene, now = performance.now();
      for (const v of s.visuals.values()) v.fidgetAt = now + 100000;
      const v = [...s.visuals.values()].find(v => v.artwork?.frame === 'red-front-unknown');
      window.figure = v;
      v.fidgetAt = now - 1;
      const random = Math.random; Math.random = () => .99;
      try { s.animateArtwork(v, 0); } finally { Math.random = random; }
      s.requestRender();
      return { frame: v.shownFrame, visible: v.eyelids?.visible, texture: s.textures.get('arena-idle-eyelid').source[0].width };
    });
    assert.deepEqual(blink, { frame: 'red-front-unknown', visible: true, texture: 60 });
    await page.screenshot({ path: path.join(tmpdir(), `rps-idle-overlay-${id}-${mobile ? 'mobile' : 'desktop'}.png`) });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.figure.eyelids.visible), false);
    assert.equal(await page.evaluate(() => window.scene.sys.game.loop.running), false);
    const wobble = await page.evaluate(() => {
      const v = window.figure, s = window.scene;
      v.fidgetStarted = performance.now() - 180; v.fidgetVariant = 0;
      s.animateArtwork(v, 0); s.requestRender();
      return { angle: v.sprite.angle, frame: v.shownFrame };
    });
    assert.ok(wobble.angle > 1.2 && wobble.angle <= 1.3);
    assert.equal(wobble.frame, 'red-front-unknown');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => window.scene.sys.game.loop.running), false);
    await page.evaluate(() => {
      window.figure.fidgetStarted = -Infinity;
      window.figure.fidgetAt = performance.now() + 80;
      window.scene.requestRender();
    });
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => Number.isFinite(window.figure.fidgetStarted)), true, 'Idle timer wakes the renderer');
    await page.waitForTimeout(850);
    assert.equal(await page.evaluate(() => window.scene.sys.game.loop.running), false);
    const traps = await page.evaluate(() => {
      const s = window.scene;
      s.demoBoard[0].kind = 'trap'; s.demoBoard[0].revealed = true; s.paint();
      const v = s.visuals.get('preview-enemy-0');
      const visible = s.idleEligible(v);
      s.demoBoard[0].kind = null; s.demoBoard[0].revealed = false; s.paint();
      const hidden = s.idleEligible(v);
      window.board.setAnimationsEnabled(false);
      return { visible, hidden, eyes: v.eyelids?.visible ?? false };
    });
    assert.deepEqual(traps, { visible: false, hidden: true, eyes: false });
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.board.destroy());
    await context.close();
    console.log(`${id}, ${mobile ? 'mobile' : 'desktop'}: shared eyelids, sprite deformation, static traps, sleeping renderer`);
  }
} finally { await browser.close(); await server.close(); }
