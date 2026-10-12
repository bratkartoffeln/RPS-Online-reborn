import { artworkForPiece } from './board-motion';
import { escapeHtml, icon } from './icons';
import type { AtlasFrame, LoadedSkin, SkinPiece, SkinTeam, SkinWeapon, TeamColor } from './skin-types';

/** DOM icons use the same validated atlas as the board, at their resting frame. */
export function atlasIcon(skin: LoadedSkin, frameName: string | undefined, size: number): string | null {
  return frameIcon(skin.image, skin.imageUrl, frameName ? skin.definition.atlas?.frames[frameName] : undefined, size);
}

function frameIcon(image: HTMLImageElement | null, imageUrl: string | null, frame: AtlasFrame | undefined, size: number, weapon = false): string | null {
  if (!image || !imageUrl || !frame) return null;
  const scale = size / Math.max(frame.width, frame.height);
  const style = [
    `width:${frame.width * scale}px`, `height:${frame.height * scale}px`,
    `background-image:url("${imageUrl}")`,
    `background-size:${image.naturalWidth * scale}px ${image.naturalHeight * scale}px`,
    `background-position:${-frame.x * scale}px ${-frame.y * scale}px`,
  ].join(';');
  return `<span class="atlas-icon${weapon ? ' weapon-icon' : ''}" aria-hidden="true" style="${escapeHtml(style)}"></span>`;
}

export function pieceIcon(skin: LoadedSkin, kind: SkinPiece, size = 29, team: SkinTeam = 'own', revealed = false, color: TeamColor = team === 'own' ? 'blue' : 'red'): string {
  const artwork = artworkForPiece(skin.definition, team === 'own', kind, revealed, color);
  const atlas = atlasIcon(skin, artwork?.frame, size);
  if (atlas) return atlas;
  if (kind === 'flag') {
    const target = color === 'blue' ? 'red' : 'blue';
    const cloth = skin.definition.palette.board[target === 'blue' ? 'ownEdge' : 'enemyEdge'];
    const pole = skin.definition.palette.ui[color === 'blue' ? 'own' : 'enemy'];
    return `<svg class="icon target-flag" data-flag-target-color="${target}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(pole)}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path data-flag-cloth fill="${escapeHtml(cloth)}" d="M6 4h12l-3 4 3 4H6Z"/><path d="M6 21V3M3 21h6"/></svg>`;
  }
  return icon(kind, '', size);
}

/** Choices show the weapon itself; SVG artwork stays sharp and the main atlas is always a fallback. */
export function weaponIcon(skin: LoadedSkin, kind: SkinWeapon, size = 44, color: TeamColor = 'blue'): string {
  const name = skin.definition.weapons?.[kind];
  if (name) {
    const preferred = skin.weaponAtlas;
    const sharpIcon = preferred && frameIcon(preferred.image, preferred.imageUrl, skin.definition.weaponAtlas?.frames[name], size, true);
    return sharpIcon || frameIcon(skin.image, skin.imageUrl, skin.definition.atlas?.frames[name], size, true) || pieceIcon(skin, kind, size, 'own', false, color);
  }
  return pieceIcon(skin, kind, size, 'own', false, color);
}

function blend(first: string, second: string, fraction: number): string {
  return '#' + [1, 3, 5].map((offset) => {
    const a = parseInt(first.slice(offset, offset + 2), 16);
    const b = parseInt(second.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * fraction).toString(16).padStart(2, '0');
  }).join('');
}

/** Secondary surfaces follow the nine editable UI colors, including light skins. */
export function applyUiPalette(skin: LoadedSkin): void {
  const p = skin.definition.palette.ui;
  const variables: Record<string, string> = {
    bg: p.background, panel: p.panel, line: p.border, text: p.text, muted: p.muted,
    green: p.accent, 'accent-text': p.accentText, blue: p.own, orange: p.enemy,
    'surface-deep': blend(p.background, p.panel, .25),
    'surface-raised': blend(p.panel, p.text, .05),
    'surface-hover': blend(p.panel, p.text, .10),
    'surface-border': blend(p.border, p.muted, .25),
    'soft-text': blend(p.text, p.muted, .30),
    'dim-text': blend(p.muted, p.background, .15),
    'accent-soft': blend(p.panel, p.accent, .08),
    'accent-border': blend(p.border, p.accent, .35),
    'accent-hover': blend(p.accent, p.text, .20),
    'enemy-soft': blend(p.panel, p.enemy, .08),
    'enemy-border': blend(p.border, p.enemy, .35),
    'own-soft': blend(p.panel, p.own, .08),
    'own-border': blend(p.border, p.own, .35),
    'board-surface': skin.definition.palette.board.dark,
    'board-light': skin.definition.palette.board.light,
    'accent-glow': p.accent + '12',
    'accent-translucent': p.accent + '22',
    'backdrop': p.background + 'dd',
  };
  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(`--${name}`, value);
  }
  document.documentElement.dataset.skin = skin.id;
  document.documentElement.dataset.presentation = skin.definition.presentation ?? 'modern';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.background);
  // Native inputs follow the selected background, without assuming every pack is dark.
  const backgroundLuminance = [1, 3, 5].reduce((sum, offset, index) => {
    const channel = parseInt(p.background.slice(offset, offset + 2), 16) / 255;
    const linear = channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    return sum + linear * [.2126, .7152, .0722][index];
  }, 0);
  document.documentElement.style.colorScheme = backgroundLuminance > .4 ? 'light' : 'dark';
}
