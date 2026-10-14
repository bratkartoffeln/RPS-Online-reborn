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
const server = await startServer({ port: 0, host: '127.0.0.1', reconnectSeconds: 10 });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  for (const mobile of [false, true]) {
    const errors = [];
    const settings = { viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' };
    const contexts = await Promise.all([browser.newContext(settings), browser.newContext(settings)]);
    const [reader, sender] = await Promise.all(contexts.map(context => context.newPage()));
    for (const page of [reader, sender]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([reader.goto(server.url), sender.goto(server.url)]);
    await Promise.all([reader, sender].map(page => page.waitForFunction(() => !document.querySelector('#app').inert)));
    await reader.waitForFunction(() => [...document.querySelectorAll('.design-choice')].length === 4 && [...document.querySelectorAll('.design-choice')].every(button => !button.disabled));
    await reader.locator('#player-name').fill('Leser');
    await reader.locator('#room-input').fill('Entwurf');
    for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
      await reader.locator('#design-' + id).click();
      await reader.waitForFunction(id => document.documentElement.dataset.skin === id, id);
      assert.equal(await reader.locator('#design-' + id).getAttribute('aria-pressed'), 'true');
      assert.equal(await reader.locator('#player-name').inputValue(), 'Leser', 'Design change preserves player name');
      assert.equal(await reader.locator('#room-input').inputValue(), 'Entwurf', 'Design change preserves room draft');
      if (id !== 'classic') assert.equal(await reader.locator('#design-' + id + ' .atlas-icon').count(), 1);
    }
    const boxes = await reader.locator('.design-choice').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    assert.ok(boxes.every(box => box.width >= 70 && box.height >= 110), 'Large design buttons');
    assert.equal(boxes[0].y, boxes[1].y, 'Design buttons stay alongside each other');
    if (!mobile) assert.ok(boxes.every(box => box.y === boxes[0].y));
    if (mobile) {
      const forms = await reader.locator('.lobby-options form').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { x: r.x, width: r.width }; }));
      assert.equal(forms[0].x, forms[1].x, 'Mobile login forms use one column');
      assert.ok(forms.every(form => form.width >= 280), 'Mobile fields retain their usable width');
    }
    await reader.locator('.lobby-designs').screenshot({ path: path.join(tmpdir(), `rps-designs-${mobile ? 'mobile' : 'desktop'}.png`) });
    await reader.locator('#room-input').fill('');
    await reader.locator('#create-button').click();
    await reader.locator('#room-chat').waitFor({ state: 'visible' });
    const code = await reader.locator('.room-code').innerText();
    await sender.locator('#player-name').fill('Sender');
    await sender.locator('#room-input').fill(code);
    await sender.locator('#join-button').click();
    await sender.locator('#room-chat').waitFor({ state: 'visible' });
    if (mobile) {
      for (const page of [reader, sender]) {
        await page.locator('#board').scrollIntoViewIfNeeded();
        const rect = await page.locator('#board canvas').boundingBox();
        const x = rect.x + 88 / 680 * rect.width;
        const y = rect.y + (47 + 4 * 84 + 39) / 616 * rect.height;
        await page.waitForTimeout(350); // Let the render loop sleep before the first tap.
        await page.touchscreen.tap(x, y);
        await page.waitForFunction(() => document.querySelector('.phase-card .body-copy').textContent.includes('ausgewählt'));
        await page.touchscreen.tap(x, y);
        await page.waitForFunction(() => !document.querySelector('.phase-card .body-copy').textContent.includes('ausgewählt'));
      }
      await reader.locator('#board').scrollIntoViewIfNeeded();
      const rect = await reader.locator('#board canvas').boundingBox();
      const beforeScroll = await reader.evaluate(() => scrollY);
      const cdp = await contexts[0].newCDPSession(reader);
      const finger = { id: 1, x: rect.x + rect.width / 2, y: rect.y + rect.height * .75 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
      for (let step = 1; step <= 6; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...finger, y: finger.y - step * 16 }] });
        await reader.waitForTimeout(25);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await reader.waitForTimeout(300);
      assert.ok(await reader.evaluate(() => scrollY) > beforeScroll, 'Swiping the board still scrolls the page');
      assert.ok(!(await reader.locator('.phase-card .body-copy').innerText()).includes('ausgewählt'), 'Scrolling does not select a figure');
      await cdp.detach();
    }
    const send = async (page, text) => {
      await page.waitForTimeout(550); // Server rate limit.
      await page.locator('#chat-input').fill(text);
      await page.locator('#chat-send').click();
      await page.waitForFunction(() => document.querySelector('#chat-input').value === '');
    };
    const top = reader.locator('.board-chat-bubble[data-position="top"]');
    const bottom = reader.locator('.board-chat-bubble[data-position="bottom"]');
    for (const id of ['classic', 'arcade', 'icq-retro', 'icq-retro-dark']) {
      await reader.locator('#skin-select').selectOption(id, { force: true });
      await reader.waitForFunction(id => document.documentElement.dataset.skin === id, id);
      await send(sender, 'Gut gespielt, das war knapp!');
      await top.waitFor({ state: 'visible' });
      assert.equal(await top.locator('.bubble-text').innerText(), 'Gut gespielt, das war knapp!');
      assert.equal(await top.getAttribute('data-team-color'), 'red');
      assert.ok(await reader.locator('#board-chat-notices').evaluate(element => !!element.closest('.board-surface')));
      await send(reader, 'Danke!');
      assert.equal(await bottom.count(), 0, 'Own messages do not create a speech bubble');
      await sender.locator('.board-chat-bubble[data-team-color="blue"]').waitFor({ state: 'visible' });
      assert.equal(await top.count(), 1, 'Own reply keeps the opponent bubble');
      await top.click();
      assert.equal(await top.count(), 0, 'Click dismisses the opponent bubble');
      assert.equal(await reader.evaluate(() => document.activeElement.id), 'chat-input');
      assert.equal(await reader.locator('.board-chat-bubble').count(), 0);
      await reader.locator('#board').click({ position: { x: 10, y: 10 } });
      assert.equal(await reader.locator('.board-chat-bubble').count(), 0, 'Game render cannot restore dismissed messages');
      for (const text of ['eins zwei drei vier fünf sechs', 'a'.repeat(51)]) {
        await send(sender, text);
        await top.waitFor({ state: 'visible' });
        assert.equal(await top.locator('.bubble-text').count(), 0, 'Both short-text limits are enforced');
        assert.equal(await top.locator('.atlas-icon').count(), 1, 'Long messages use the selected atlas');
      }
      await send(sender, '<b>Hallo</b>');
      await reader.waitForFunction(() => document.querySelector('.board-chat-bubble .bubble-text')?.textContent === '<b>Hallo</b>');
      assert.equal(await top.locator('b').count(), 0, 'Message text cannot inject markup');
      await top.screenshot({ path: path.join(tmpdir(), `rps-chat-${id}-${mobile ? 'mobile' : 'desktop'}.png`) });
      await top.click();
      const textStyle = await reader.locator('.chat-text').first().evaluate(element => { const s = getComputedStyle(element); return { size: parseFloat(s.fontSize), weight: Number(s.fontWeight) }; });
      assert.ok(textStyle.size >= 15 && textStyle.weight >= 600);
      const backgrounds = await reader.locator('.chat-message').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.dataset.teamColor, getComputedStyle(element).backgroundColor])));
      assert.notEqual(backgrounds.blue, backgrounds.red, 'Chat row tint follows player color');
      const summaries = reader.locator('#match-overview > summary, #game-history > summary, #room-details > summary, #game-rules > summary, #appearance-menu > summary');
      for (const summary of await summaries.all()) {
        const styles = await summary.evaluate(element => ({ arrow: getComputedStyle(element, '::after').borderRightWidth, radius: getComputedStyle(element.parentElement).borderRadius }));
        assert.equal(styles.arrow, '2px');
        if (id.startsWith('icq-retro')) assert.equal(styles.radius, '0px');
      }
      if (id === 'icq-retro-dark') {
        assert.equal(await reader.evaluate(() => document.documentElement.style.colorScheme), 'dark');
        assert.equal(await reader.locator('.play-panel').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(32, 44, 35)');
        if (mobile) {
          assert.ok(await reader.locator('.score-referee .referee-portrait').isVisible());
          assert.ok(await reader.locator('.phase-referee').isHidden());
          const positions = await reader.locator('.header-arena .series-player, .score-referee').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
          assert.ok(positions[0] < positions[1] && positions[1] < positions[2], 'Referee sits between player scores');
        }
        await reader.screenshot({ path: path.join(tmpdir(), `rps-dark-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
      }
      console.log(`${mobile ? 'Mobil' : 'Desktop'} / ${id}: Design, Chattext, Spielerfarben, Absenderposition, Textgrenzen, Ausblenden und Akkordeons OK`);
    }
    // Observe actual browser timers once; unit tests cover intermediate reading times.
    if (mobile) {
      await send(sender, 'Kurz');
      await top.waitFor({ state: 'visible' });
      await reader.waitForTimeout(4200);
      assert.ok(await top.isVisible(), 'A short notice lasts at least five seconds');
      await top.waitFor({ state: 'detached', timeout: 2500 });
      await send(sender, 'a'.repeat(200));
      await top.waitFor({ state: 'visible' });
      await reader.waitForTimeout(5200);
      assert.ok(await top.isVisible(), 'Longer messages receive more reading time');
      await top.waitFor({ state: 'detached', timeout: 11000 });
    }
    await reader.locator('#ready-button').click();
    await sender.locator('#ready-button').click();
    await reader.waitForFunction(() => document.querySelector('#shell').classList.contains('active-match'));
    assert.ok(await reader.locator('.footer').isVisible(), 'Footer remains visible in active matches');
    assert.equal(await reader.locator('.play-panel > .legal-footer').count(), 0);
    assert.equal(await reader.locator('.footer-legal nav a').count(), 2);
    const footerSizes = await reader.locator('.footer-legal').evaluate(element => [getComputedStyle(element.querySelector('span')).fontSize, getComputedStyle(element.querySelector('a')).fontSize]);
    assert.equal(footerSizes[0], footerSizes[1]);
    assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
    await send(sender, 'Bis gleich!');
    await top.waitFor({ state: 'visible' });
    await reader.reload();
    await reader.locator('#room-chat').waitFor({ state: 'visible' });
    await reader.waitForFunction(() => document.querySelectorAll('.chat-message').length > 0);
    assert.equal(await reader.locator('.board-chat-bubble').count(), 0, 'History sync does not show old bubbles');
    assert.deepEqual(errors, []);
    await Promise.all(contexts.map(context => context.close()));
  }
} finally {
  await browser?.close();
  await server.close();
}
