/** Extract the original ICQ combatants, without their weapons or the board.
 * Usage: node scripts/extract-video-poses.mjs VIDEO FFMPEG PLAYWRIGHT_MODULE
 * Output seeking is intentional: the reference's MPEG-TS timestamps are irregular.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
const [video, ffmpeg, module] = process.argv.slice(2);
const { chromium } = createRequire(import.meta.url)(module || 'playwright');
const poses = [
  { team: 'blue', facing: 'right', seconds: 38.4, crop: [20, 115, 95, 110],
    outline: [[10,19],[16,13],[29,19],[33,29],[40,28],[47,28],[57,29],[65,32],[66,39],[72,33],[76,39],[75,44],[79,47],[78,54],[73,61],[65,64],[62,69],[65,74],[70,78],[75,80],[79,80],[82,85],[82,91],[72,94],[68,91],[61,90],[63,97],[66,102],[64,106],[48,107],[43,103],[42,99],[38,107],[39,109],[25,110],[24,105],[29,99],[33,90],[32,80],[30,76],[32,69],[36,66],[30,61],[28,55],[27,47],[26,38],[28,32],[16,30],[10,29]] },
  { team: 'red', facing: 'left', seconds: 34.7, crop: [118, 127, 76, 90],
    outline: [[13,27],[21,20],[36,19],[45,20],[45,14],[50,8],[56,7],[61,10],[61,18],[57,23],[59,32],[58,40],[56,44],[58,48],[60,51],[62,52],[65,52],[66,56],[64,60],[60,61],[56,60],[53,58],[52,62],[56,65],[55,69],[48,70],[44,69],[39,73],[36,76],[34,82],[33,87],[29,89],[20,89],[18,86],[19,79],[12,77],[9,74],[10,70],[6,69],[4,65],[5,61],[9,58],[14,55],[14,52],[12,48],[12,39]] },
];
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage();
  for (const pose of poses) {
    const frame = path.join(tmpdir(), `rps-extract-${pose.team}.png`);
    execFileSync(ffmpeg, ['-v','error','-i',video,'-ss',String(pose.seconds),'-frames:v','1','-y',frame], { windowsHide: true });
    const png = await page.evaluate(async ({ base64, pose }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
      const [x,y,w,h] = pose.crop, canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d'); ctx.beginPath();
      pose.outline.forEach(([px,py], i) => i ? ctx.lineTo(px,py) : ctx.moveTo(px,py)); ctx.closePath(); ctx.clip();
      ctx.drawImage(image,x,y,w,h,0,0,w,h);
      const pixels=ctx.getImageData(0,0,w,h);
      for(let i=0;i<pixels.data.length;i+=4) {
        const [r,g,b]=pixels.data.slice(i,i+3);
        if(g>r*1.15 && g>b*1.1) pixels.data[i+3]=0;
      }
      ctx.putImageData(pixels,0,0);
      return canvas.toDataURL('image/png').split(',')[1];
    }, {base64:(await readFile(frame)).toString('base64'),pose});
    await writeFile(new URL(`../public/skins/icq-retro/source/video-side-${pose.team}.png`, import.meta.url),Buffer.from(png,'base64'));
  }
  await writeFile(new URL('../public/skins/icq-retro/source/video-side-poses.json',import.meta.url),JSON.stringify({
    source:'https://www.youtube.com/watch?v=Q2sDtTbzHiI', title:'Rock Paper Scissors in ICQ (RPS)', channel:'shachar700',
    rights:'Original ICQ game artwork; extracted from the supplied reference, not CC0.',
    videoSha256:createHash('sha256').update(await readFile(video)).digest('hex'),
    processing:'Frame extraction, polygon mask, green background removal; opposite directions are mirrored. Shared by both ICQ skins.', poses,
  },null,2)+'\n');
} finally { await browser.close(); }
