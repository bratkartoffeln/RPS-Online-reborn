import { retroGongDrawing, RETRO_GONG_IMAGE } from './retro-gong-art';
import type { GameView } from '../shared/game';
import type { LoadedSkin } from './skin-types';

export const GONG_TIMING = Object.freeze({ strike: 380, complete: 1500 });

let retroImage: HTMLImageElement | null = null;
export function preloadGongArtwork(skin: LoadedSkin): void {
  if (skin.definition.presentation !== 'retro' || retroImage || typeof Image === 'undefined') return;
  retroImage = new Image();
  retroImage.src = RETRO_GONG_IMAGE;
  void retroImage.decode().catch(() => { retroImage = null; });
}

/** A live second ready confirmation, never a restored game or reconnect. */
export function freshMatchStart(previous: GameView | null, next: GameView): boolean {
  return !!previous && previous.phase === 'setup' && next.phase === 'playing' &&
    previous.you === next.you && previous.series.id === next.series.id && previous.series.matchId === next.series.matchId &&
    (previous as GameView & { roomId?: string }).roomId === (next as GameView & { roomId?: string }).roomId &&
    next.revision === previous.revision + 1 && !previous.paused && !next.paused &&
    previous.players.length === 2 && next.players.length === 2 &&
    previous.players.every(player => player.connected && next.players.some(peer => peer.id === player.id && peer.connected && peer.ready));
}

/** Native SVG, styled to each pack. The retro pose reconstructs the gong reference. */
export function gongMarkup(skin: LoadedSkin, size: number, animated = false): string {
  const style = skin.definition.presentation === 'retro' ? 'retro' : skin.id === 'arcade' ? 'arcade' : 'classic';
  const id = `gong-${style}-${size}`;
  let drawing: string;
  if (style === 'retro') {
    drawing = retroGongDrawing(id);
  } else if (style === 'arcade') {
    drawing = `<g stroke="#111f27" stroke-width="5" stroke-linejoin="round"><path d="M40 207h231l17 17H23Z" fill="#ffcf7e"/><path d="M61 195v16m165-16v16" stroke="#73b2ff" stroke-width="12"/><g class="gong-disc"><path d="m74 25 104 0 54 54v83l-54 45H74l-47-45V79Z" fill="#73b2ff"/><path d="M81 38h90l47 47v70l-47 39H81l-40-39V85Z" fill="#132e40"/><path d="M93 54h65l42 39v18L58 153V93Z" fill="#205dc1"/><path d="M102 80h47l32 32-32 32h-47l-28-32Z" fill="#ffcf7e"/><path d="M109 92h32l20 20-20 20h-32l-17-20Z" fill="#eef9ef"/></g><g class="gong-mallet" style="transform-origin:259px 159px"><path d="m259 159 19-95" stroke="#ffcf7e" stroke-width="12"/><path d="m268 28 27 5 12 24-17 20-28-6-9-24Z" fill="#ff8b84"/><path d="m267 36 23 5 6 13-14 12-16-5-6-12Z" fill="#b9333e"/></g></g>`;
  } else {
    drawing = '<g fill="none" stroke="#b9c7d1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M43 220h198M66 194v26m150-26v26"/><g class="gong-disc"><circle cx="141" cy="114" r="91"/><circle cx="141" cy="114" r="74"/><circle cx="141" cy="114" r="24"/><path d="M141 33v11m-81 70h11m151 0h-11M141 195v-11"/></g><g class="gong-mallet" style="transform-origin:261px 179px" stroke="#e9bf78"><path d="m261 179 22-114"/><circle cx="288" cy="44" r="21"/></g></g>';
  }
  return `<svg class="gong-scene" data-gong-style="${style}" data-animated="${animated}" width="${size}" height="${size * .75}" viewBox="0 0 320 240" aria-hidden="true">${drawing}</svg>`;
}
