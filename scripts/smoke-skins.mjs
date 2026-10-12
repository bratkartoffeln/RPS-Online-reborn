import { chromium } from 'file:///C:/Users/BeQuiet/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {startServer} from '../dist/server/server/app.js';
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const server=await startServer({port:0,host:'127.0.0.1'});let browser;const results=[];
try {browser=await chromium.launch({headless:true,channel:'msedge'});
for(const mobile of [false,true]){const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(server.url);await page.waitForFunction(()=>document.querySelector('#skin-select')?.options.length>=3);
const entries=await page.locator('#skin-select option').evaluateAll(xs=>xs.map(x=>x.value));
for(const id of entries){await page.locator('#skin-select').selectOption(id,{force:true});await page.waitForFunction(id=>document.documentElement.dataset.skin===id,id);await page.waitForTimeout(100);assert.equal(await page.locator('#skin-select').inputValue(),id);assert.ok(!await page.locator('body').innerText().then(x=>x.includes('Unbekanntes Feld')));assert.equal(await page.locator('#board canvas').count(),1);results.push({mobile,id,errors:[...errors]});}assert.deepEqual(errors,[]);await context.close();}
writeFileSync('smoke-skins-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}finally{await browser?.close();await server.close();}
