import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../public/skins/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
const html = `<!doctype html>
<html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Designvorschau · RPS Arena</title>
<style>
body{margin:0;background:var(--background,#11171a);color:var(--text,#eff2ec);font:16px/1.5 system-ui,sans-serif}
main{max-width:1000px;margin:auto;padding:24px}a{color:var(--accent,#c5f277)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px}
article{background:var(--panel,#1a2125);border:1px solid var(--border,#303a3f);border-radius:10px;padding:16px;min-width:0}
article h3{margin:0 0 10px}audio{display:block;width:100%}img{max-width:100%;height:160px;object-fit:contain}
p{max-width:75ch}h2{margin-top:32px}
</style>
<main><a href="/">Zur Arena</a><h1 id="name">Designvorschau</h1>
<p id="speech-note">Die Klangvarianten und Effekte gehören zum gewählten Design.</p>
<h2>Schiedsrichter</h2><div class="grid" id="speech"></div>
<h2>Gong und Kampfgeräusche</h2><div class="grid" id="effects"></div>
<h2>Ergebnisbilder und Startgong</h2><div class="grid" id="art"></div>
<p><a href="audio/SOURCES.json">Audioquellen und Syntheseparameter</a> · <a href="audio/LICENSE.txt">Audio-Lizenzen</a></p>
</main>
<script type="module">
const skin = await (await fetch('skin.json')).json();
document.getElementById('name').textContent = skin.name;
document.title = skin.name + ' · Designvorschau';
document.getElementById('speech-note').textContent = skin.audio?.redTurn?.file.startsWith('audio/original-')
 ? 'Originale Spielansagen und Effekte aus dem angegebenen ICQ-Video. Diese Ausschnitte sind nicht als CC0 freigegeben; Details stehen im Quellenverzeichnis.'
 : 'Englische Schiedsrichteransagen mit lokal synthetisiertem Mandarin-Sprachprofil. Keine menschlichen Sprecheraufnahmen.';
for (const [key,value] of Object.entries(skin.palette?.ui ?? {})) document.body.style.setProperty('--'+key,value);
const labels = {redTurn:'Red turn',blueTurn:'Blue turn',youWin:'You win',youLose:'You lose',gong:'Startgong',move:'Zug (Standard)',moveBlue:'Blau bewegt',moveRed:'Rot bewegt',rock:'Stein',paper:'Papier',scissors:'Schere',trap:'Falle',flag:'Flagge',duel:'Duell',win:'Kampf gewonnen',lose:'Kampf verloren',draw:'Unentschieden'};
labels.shuffle = 'Mischen / Aufstellung';
for (const [cue,clip] of Object.entries(skin.audio ?? {})) {
 for(const [index,file] of [clip.file,...clip.variants??[]].entries()) {
 const article=document.createElement('article'), title=document.createElement('h3'), audio=document.createElement('audio');
 title.textContent=(labels[cue]??cue)+(clip.variants?.length?' · '+(index+1):''); audio.controls=true; audio.preload='none'; audio.src=file;
 audio.volume=clip.volume??.7; audio.playbackRate=clip.rate??1;
 article.append(title,audio); document.getElementById(['redTurn','blueTurn','youWin','youLose'].includes(cue)?'speech':'effects').append(article);
 }
}
const images = skin.artwork?.endgame ? ['blue-happy','red-happy','blue-sad','red-sad','referee-blue','referee-red'].map(name=>[name,skin.artwork.endgame+'/'+name+'.svg']) : [];
if(skin.artwork?.gong) images.push(['Gong',skin.artwork.gong.idle],['Gongschlag',skin.artwork.gong.strike]);
for(const [label,file] of images){const article=document.createElement('article'),img=document.createElement('img');img.alt=label;img.src=file;article.append(img);document.getElementById('art').append(article);}
</script></html>
`;
for (const { id } of catalog.skins) {
  await writeFile(new URL(id + '/preview.html', root), html);
  console.log(`${id}: preview page exported`);
}
