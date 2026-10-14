import { chromium } from 'file:///C:/Users/BeQuiet/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{windowsHide:true,stdio:'ignore'});
let browser;
const results=[];
try {
 for(let i=0;i<50;i++) { try { if((await fetch('http://127.0.0.1:5173/mobile-qa.html')).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
 browser=await chromium.launch({headless:true,channel:'msedge'});
 for(const mobile of [true,false]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},deviceScaleFactor:mobile?3:2,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(); const errors=[]; const requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:5173/mobile-qa.html');
  await page.evaluate(async()=>{
   const {ArenaBoard}=await import('/client/board.ts'); const {loadSkin}=await import('/client/skins.ts'); const g=await import('/shared/game.ts');
   const game=g.createGame();g.addPlayer(game,'a','Ada');g.addPlayer(game,'b','Ben');g.readyPlayer(game,'a');g.readyPlayer(game,'b');
   let selected=null; const taps=[];
   const board=new ArenaBoard(document.querySelector('#board'),{onCell(index){taps.push(index);if(selected===null)selected=index;else {g.movePiece(game,'a',selected,index);selected=null;}board.update(g.viewFor(game,'a'),selected);},onCancel(){},onFocus(){}});
   board.setSkin(await loadSkin({id:'icq-retro',name:'ICQ Retro',file:'icq-retro/skin.json'})); board.update(g.viewFor(game,'a'),null);
   window.qa={board,game,g,taps};
  });
  await page.waitForTimeout(350);
  const before=await page.evaluate(()=>({running:qa.board.game.loop.running,frame:qa.board.game.loop.frame,canvas:[qa.board.game.canvas.width,qa.board.game.canvas.height],image:[qa.board.scene.skin.image.naturalWidth,qa.board.scene.skin.image.naturalHeight],limit:qa.board.game.loop.fpsLimit}));
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>qa.board.game.loop.frame);
  assert.equal(before.running,false); if(mobile){assert.equal(after,before.frame);assert.equal(before.image[0],1008);assert.equal(before.canvas[0],680);assert.equal(before.limit,30);}else{assert.equal(after,before.frame);assert.equal(before.canvas[0],1360);}
  const tap=async index=>{const box=await page.locator('canvas').boundingBox();const x=box.x+(49+index%7*84+39)/680*box.width;const y=box.y+(47+Math.floor(index/7)*84+39)/616*box.height;if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);await page.waitForTimeout(100);};
  const pair=await page.evaluate(()=>{const v=qa.g.viewFor(qa.game,'a');for(let from=28;from<35;from++){const to=(v.legalMoves[from]??[]).find(i=>i>=21&&i<28);if(to!==undefined)return [from,to];}throw Error('No legal fixture move');});
  await tap(pair[0]);assert.deepEqual(await page.evaluate(()=>qa.taps),[pair[0]],"The very first tap selects exactly once after idle");await tap(pair[1]);await page.waitForTimeout(400);
  const moved=await page.evaluate(()=>({taps:qa.taps,turn:qa.game.turnNumber,frame:qa.board.game.loop.frame,running:qa.board.game.loop.running,effect:!!qa.board.scene.effect}));
  assert.deepEqual(moved.taps,pair);assert.equal(moved.turn,1);assert.equal(moved.running,false);assert.equal(moved.effect,false);
  if(mobile){assert.ok(requests.some(x=>x.includes('atlas-mobile.webp')));assert.ok(!requests.some(x=>x.includes('atlas.svg')));await page.setViewportSize({width:320,height:700});await page.waitForTimeout(150);const width=await page.evaluate(()=>qa.board.game.canvas.width);assert.ok(width<=640); const origin=await page.evaluate(()=>{const p=qa.board.scene.cameras.main.getWorldPoint(0,0);return {x:p.x,y:p.y,width:qa.board.scene.cameras.main.width};});assert.ok(Math.abs(origin.x)<1 && Math.abs(origin.y)<1,JSON.stringify(origin));}
  else{assert.ok(requests.some(x=>x.includes('atlas.svg')));}
  const combatResult=await page.evaluate(async()=>{
    await import('/client/combat-ui.css');
    const {CombatOverlay}=await import('/client/combat-ui.ts');
    const {createGame,addPlayer,readyPlayer,movePiece,viewFor}=qa.g;
    const state=createGame();addPlayer(state,'a','Ada');addPlayer(state,'b','Ben');readyPlayer(state,'a');readyPlayer(state,'b');state.board.fill(null);
    for(const [i,owner,kind] of [[24,'a','rock'],[17,'b','scissors'],[35,'a','paper'],[6,'b','paper'],[41,'a','flag'],[0,'b','flag']])state.board[i]={id:'combat-'+i,owner,kind,revealed:true};
    movePiece(state,'a',24,17);const view={...viewFor(state,'a'),roomId:'qa'};
    const root=document.createElement('div');root.style.cssText='position:relative;width:100%;max-width:680px;height:360px';document.body.append(root);
    const overlay=new CombatOverlay(root,{onBusyChange(){},onCelebrate(){}});
    overlay.update(view,qa.board.scene.skin,{connected:true,pending:false});overlay.present(view.lastAction,view);
    const stages=[root.dataset.stage];
    let reachedWinner;
    const winner=new Promise(resolve=>{reachedWinner=resolve;});
    const observer=new MutationObserver(()=>{if(stages.at(-1)!==root.dataset.stage)stages.push(root.dataset.stage);if(root.dataset.stage==='winner')reachedWinner();});
    observer.observe(root,{attributes:true,attributeFilter:['data-stage']});
    const result={motion:root.dataset.motion,shards:root.querySelectorAll('.combat-shard').length,cloud:root.querySelectorAll('.combat-cloud').length,animation:getComputedStyle(root.querySelector('.combat-art')).animationName,stages};
    await Promise.race([winner,new Promise((_,reject)=>setTimeout(()=>reject(Error('Battle did not reach winner animation')),10000))]);
    observer.disconnect();overlay.reset();root.remove();return result;
  });
  assert.equal(combatResult.motion,'full');assert.equal(combatResult.shards,6);assert.equal(combatResult.cloud,1);
  assert.equal(combatResult.animation,'combat-approach-left');
  assert.deepEqual(combatResult.stages.filter(Boolean),['approach','impact','shatter','winner']);
  const darkChoice=await page.evaluate(async()=>{
    const {loadSkin}=await import('/client/skins.ts');
    const {applyUiPalette}=await import('/client/skin-ui.ts');
    const {CombatOverlay}=await import('/client/combat-ui.ts');
    const skin=await loadSkin({id:'icq-retro-dark',name:'ICQ Retro Dark',file:'icq-retro-dark/skin.json'});
    applyUiPalette(skin);
    const game=qa.g.createGame();qa.g.addPlayer(game,'a','Ada');qa.g.addPlayer(game,'b','Ben');qa.g.readyPlayer(game,'a');qa.g.readyPlayer(game,'b');game.board.fill(null);
    for(const [i,owner,kind] of [[24,'a','rock'],[17,'b','rock'],[35,'a','paper'],[6,'b','paper'],[41,'a','flag'],[0,'b','flag']])game.board[i]={id:'choice-'+i,owner,kind,revealed:true};
    qa.g.movePiece(game,'a',24,17);
    const root=document.createElement('div');root.id='qa-dark-choice';root.style.cssText='position:relative;width:100%;max-width:390px;height:300px';document.body.append(root);
    const overlay=new CombatOverlay(root,{onBusyChange(){},onCelebrate(){}});
    overlay.update({...qa.g.viewFor(game,'a'),roomId:'choice'},skin,{connected:true,pending:false});
    qa.darkOverlay=overlay;qa.darkRoot=root;
    const panel=root.querySelector('.combat-choice-panel');
    return {background:getComputedStyle(panel).backgroundColor,color:getComputedStyle(panel).color,url:skin.imageUrl,panelHeight:panel.getBoundingClientRect().height};
  });
  assert.match(darkChoice.url,/\/icq-retro-dark\//);
  assert.match(darkChoice.background,/24, 35, 26/);
  assert.equal(darkChoice.color,'rgb(240, 246, 230)');
  assert.ok(darkChoice.panelHeight<=300);
  await page.locator('#qa-dark-choice .combat-choice-panel').screenshot({path:path.join(tmpdir(),mobile?'dark-weapon-choice-mobile.png':'dark-weapon-choice-desktop.png')});
  await page.evaluate(()=>{qa.darkOverlay.reset();qa.darkRoot.remove();});
  const finalBattle=await page.evaluate(async()=>{
    const {CombatOverlay}=await import('/client/combat-ui.ts');
    const {EndgameOverlay}=await import('/client/endgame-ui.ts');
    await import('/client/endgame-ui.css');
    const game=qa.g.createGame();qa.g.addPlayer(game,'a','Ada');qa.g.addPlayer(game,'b','Ben');qa.g.readyPlayer(game,'a');qa.g.readyPlayer(game,'b');game.board.fill(null);
    for(const [i,owner,kind] of [[24,'a','rock'],[17,'b','flag'],[41,'a','flag'],[6,'b','paper']])game.board[i]={id:'final-'+i,owner,kind,revealed:true};
    qa.g.movePiece(game,'a',24,17);
    const view={...qa.g.viewFor(game,'a'),roomId:'final'};
    const host=document.createElement('div');host.style.cssText='position:relative;width:100%;max-width:390px;height:360px';document.body.append(host);
    const combatRoot=document.createElement('div'),endRoot=document.createElement('div');host.append(combatRoot,endRoot);
    const end=new EndgameOverlay(endRoot);let finished;
    const completion=new Promise(resolve=>{finished=resolve;});
    const combat=new CombatOverlay(combatRoot,{onBusyChange(busy){end.update(view,busy);if(!busy)finished();},onCelebrate(){}});
    combat.update(view,qa.board.scene.skin,{connected:true,pending:false});combat.present(view.lastAction,view);
    const hiddenDuringBattle=endRoot.hidden;
    await Promise.race([completion,new Promise((_,reject)=>setTimeout(()=>reject(Error('Final battle did not finish')),10000))]);
    const visibleAfterBattle=!endRoot.hidden;
    const winner=endRoot.dataset.winnerTeam;
    end.update({...view,winner:null,finishReason:'turn_limit'},false);
    const neutral=endRoot.dataset.winnerTeam==='draw'&&endRoot.querySelectorAll('[data-mood="neutral"]').length===2;
    combat.reset();host.remove();
    return {hiddenDuringBattle,visibleAfterBattle,winner,neutral};
  });
  assert.deepEqual(finalBattle,{hiddenDuringBattle:true,visibleAfterBattle:true,winner:'blue',neutral:true});
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(tmpdir(),mobile?'mobile-preview.png':'desktop-preview.png')});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>document.querySelector('#skin-select')?.value==='icq-retro');
  await page.waitForTimeout(350);
  const appCanvas=await page.locator('#board canvas').evaluate(c=>[c.width,c.height,c.getBoundingClientRect().width]);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(tmpdir(),mobile?'mobile-app-preview.png':'desktop-app-preview.png'),fullPage:true});
  results.push({mobile,before,after,moved,appCanvas,combatResult,errors});await context.close();
 }
 console.log(JSON.stringify(results,null,2));writeFileSync(path.join(tmpdir(),'browser-mobile-results.json'),JSON.stringify(results,null,2));
} finally {await browser?.close();server.kill();}
