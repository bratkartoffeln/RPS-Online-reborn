import type { GameView } from '../shared/game';
import type { LoadedSkin } from './skin-types';
import { skinAssetUrl } from './skin-assets';

export const GONG_TIMING = Object.freeze({ strike: 380, complete: 1500 });
const preloaded = new Map<string, HTMLImageElement>();
export function preloadGongArtwork(skin: LoadedSkin): void {
  if (typeof Image === 'undefined') return;
  const gong = skin.definition.artwork?.gong;
  if (!gong) return;
  for (const file of [gong.idle]) {
    const url = skinAssetUrl(skin, file);
    if (preloaded.has(url)) continue;
    const image = new Image();
    preloaded.set(url, image);
    image.src = url;
    void image.decode().catch(() => preloaded.delete(url));
  }
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

/** SVG animation and its timing belong to the selected design. */
export function gongMarkup(skin: LoadedSkin, size: number, animated = false, replay = 0): string {
  const gong = skin.definition.artwork?.gong;
  const url = gong ? skinAssetUrl(skin, animated ? gong.strike : gong.idle) : '/skins/classic/gong/' + (animated ? 'strike' : 'idle') + '.svg';
  return '<img class="gong-scene" data-gong-style="' + skin.id + '" data-animated="' + animated + '" src="' + url + (animated ? '?play=' + replay : '') + '" width="' + size + '" height="' + size * .75 + '" alt="" aria-hidden="true" />';
}
