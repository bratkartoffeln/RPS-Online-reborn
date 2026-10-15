/** Reuse the four directional ICQ poses and result portraits with a moving mouth. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../public/skins/', import.meta.url);
const source = await readFile(new URL('icq-retro/source/referees.svg', root), 'utf8');
const defs = /<defs>([\s\S]*?)<\/defs>/.exec(source)[1];
const animation = '<style>@keyframes referee-speech{0%,100%{transform:scaleY(.12)}20%{transform:scaleY(1)}45%{transform:scaleY(.25)}70%{transform:scaleY(.85)}}.speech-mouth{transform-box:fill-box;transform-origin:50% 35%;animation:referee-speech 240ms ease-in-out infinite}@media(prefers-reduced-motion:reduce){.speech-mouth{animation:none}}</style>';
function speaking(svg) {
  let changed = false;
  // The narrow white shapes higher on the face are eyes. The mouth is the
  // curved line below the cheek, pointing toward the flag-holding arm.
  svg = svg.replace(/<path d="M(62\.5 65\.5|63\.9 65C)[^>]*\/>/, (_, pose) => {
    changed = true;
    const [x, y] = pose.startsWith('62') ? [68, 66.8] : [68.9, 66.3];
    return `<g transform="rotate(14 ${x} ${y})"><g class="speech-mouth"><ellipse cx="${x}" cy="${y}" rx="4.9" ry="2.3" fill="#582b22" stroke="#6d502b" stroke-width=".85"/><path d="M${x - 3.8} ${y - 1}q3.8 .8 7.6 0" fill="none" stroke="#fffdf1" stroke-width="1"/><path d="M${x - 1.5} ${y + 1.3}q1.5-.7 3 0" fill="none" stroke="#d98b78" stroke-width=".7"/></g></g>`;
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
