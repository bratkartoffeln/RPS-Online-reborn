/** Reuse the four directional ICQ poses and result portraits with a moving mouth. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../public/skins/', import.meta.url);
const source = await readFile(new URL('icq-retro/source/referees.svg', root), 'utf8');
const defs = /<defs>([\s\S]*?)<\/defs>/.exec(source)[1];
const animation = '<style>@keyframes referee-speech{0%,100%{transform:scaleY(.12)}20%{transform:scaleY(1)}45%{transform:scaleY(.25)}70%{transform:scaleY(.85)}}.speech-mouth{transform-box:fill-box;transform-origin:50% 35%;animation:referee-speech 240ms ease-in-out infinite}@media(prefers-reduced-motion:reduce){.speech-mouth{animation:none}}</style>';
function speaking(svg) {
  let changed = false;
  svg = svg.replace(/<path d="M(71\.4 58\.1|73\.2 59\.8)[^>]*\/>\s*<path[^>]*\/>\s*<path[^>]*\/>/, (_, pose) => {
    changed = true;
    const y = pose.startsWith('71') ? 60.5 : 63;
    return `<g class="speech-mouth"><ellipse cx="79" cy="${y}" rx="5.8" ry="3.4" fill="#582b22" stroke="#6c532c" stroke-width=".8"/><path d="M74 ${y - 1.7}Q79 ${y - .5} 84 ${y - 1.7}" fill="none" stroke="#fffdf1" stroke-width="1.5"/><path d="M77 ${y + 2}q2-1 4 0" fill="none" stroke="#d98b78" stroke-width="1"/></g>`;
  });
  svg = svg.replace(/<path d="M76\.6 74\.8[^>]*\/>/, () => {
    changed = true;
    return '<g class="speech-mouth"><ellipse cx="80.5" cy="75.5" rx="4.3" ry="3" fill="#582b22" stroke="#966b30" stroke-width=".7"/><path d="M78 74q2.5 1 5 0" fill="none" stroke="#fffdf1" stroke-width="1"/></g>';
  });
  if (!changed) throw new Error('Missing referee mouth');
  return svg.replace(/<\/svg>\s*$/, animation + '</svg>\n');
}
function group(id) {
  const open = new RegExp(`<g\\b[^>]*id="${id}"[^>]*>`).exec(source);
  const tags=/<\/?g\b[^>]*>/g; tags.lastIndex=open.index+open[0].length;
  let depth=1;
  for(let tag; (tag=tags.exec(source));) {
    depth+=tag[0].startsWith('</')?-1:1;
    if(!depth)return source.slice(open.index,tags.lastIndex);
  }
  throw new Error('Unclosed referee group');
}
for(const id of ['icq-retro','icq-retro-dark']) {
  const dir=new URL(id+'/',root);
  await mkdir(new URL('speech/',dir),{recursive:true});
  await writeFile(new URL('speech/referee-neutral.svg',dir),speaking(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><title>Sprechender Schiedsrichter</title><defs>${defs}</defs>${group('referee-neutral')}</svg>`));
  for(const color of ['blue','red']) {
    for(const direction of color === 'blue' ? ['turn','top'] : ['turn','bottom']) {
      const frame=`referee-${color}-${direction}`;
      await writeFile(new URL(`speech/${frame}.svg`,dir),speaking(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><title>Sprechender Schiedsrichter</title><defs>${defs}</defs>${group(frame)}</svg>`));
    }
    const result=await readFile(new URL(`endgame/referee-${color}.svg`,dir),'utf8');
    await writeFile(new URL(`endgame/referee-${color}-speaking.svg`,dir),speaking(result));
  }
  console.log(id+': four speaking turn poses and two speaking result portraits');
}
