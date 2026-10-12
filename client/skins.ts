import { mobileGraphics } from './mobile-graphics';
import type {
  ArtworkVariant, AtlasFrame, BoardPalette, LoadedSkin, PerspectivePieces, PieceArtwork, PieceSet, PortraitDirection, SkinAnimation,
  SkinAnimationState, SkinAtlas, SkinCatalog, SkinDefinition, SkinEntry, SkinPiece, SkinTeam, SkinWeapon, TeamColor, UiPalette,
} from './skin-types';

export const SKIN_LIMITS = Object.freeze({
  jsonBytes: 256 * 1024,
  imageDimension: 4096,
  atlasFrames: 512,
  clipFrames: 64,
  catalogEntries: 32,
  loadTimeoutMs: 10000,
});

export const DEFAULT_SKIN: SkinDefinition = {
  version: 1,
  name: 'Klassisch',
  presentation: 'modern',
  palette: {
    ui: {
      background: '#11171a', panel: '#1a2125', border: '#303a3f', text: '#eff2ec',
      muted: '#99a5a9', accent: '#c5f277', accentText: '#22311c', own: '#91c5ef', enemy: '#f09b9b',
    },
    board: {
      light: '#29363e', dark: '#243138', border: '#43515a', setupOwn: '#2a3c47',
      setupEnemy: '#452f35', selected: '#42533d', accent: '#c5f277', duel: '#eabc87',
      coordinates: '#82949f', shadow: '#0d1418', dots: '#8193a0', focus: '#ffffff',
      ownBase: '#385d76', ownEdge: '#7099b6', ownSymbol: '#c6e3f5',
      enemyBase: '#783f48', enemyEdge: '#ba7783', enemySymbol: '#ffd2d8', revealed: '#c5f277',
    },
  },
  motion: { moveMs: 220, battleMs: 900 },
};

function freezeDefaults(value: object): void {
  Object.values(value).forEach((nested: unknown) => {
    if (nested !== null && typeof nested === 'object') freezeDefaults(nested);
  });
  Object.freeze(value);
}
freezeDefaults(DEFAULT_SKIN);

const BUILTIN_ENTRY: SkinEntry = { id: 'classic', name: 'Klassisch', file: 'classic/skin.json' };
const TEAMS: SkinTeam[] = ['own', 'enemy'];
const COLORS: TeamColor[] = ['blue', 'red'];
const PORTRAIT_DIRECTIONS: PortraitDirection[] = ['top', 'bottom'];
const PIECES: SkinPiece[] = ['rock', 'paper', 'scissors', 'flag', 'trap', 'unknown'];
const WEAPONS: SkinWeapon[] = ['rock', 'paper', 'scissors'];
const ANIMATIONS: SkinAnimationState[] = ['idle', 'selected', 'move', 'duel', 'attack', 'win', 'lose'];
const RESERVED_NAMES = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype', '__BASE']);
let loadSequence = 0;

export class SkinError extends Error {
  constructor(message: string) { super(message); this.name = 'SkinError'; }
}

function invalid(message: string): never { throw new SkinError(message); }

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid(`${label} muss ein JSON-Objekt sein.`);
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid(`${label}: Unbekanntes Feld „${key.slice(0, 60)}“.`);
  }
}

function title(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > 48 || /[\u0000-\u001f\u007f]/.test(value)) {
    invalid(`${label} muss ein Name mit 1 bis 48 Zeichen sein.`);
  }
  return value.trim();
}

function number(value: unknown, minimum: number, maximum: number, label: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    invalid(`${label} muss ${integer ? 'eine ganze Zahl' : 'eine Zahl'} zwischen ${minimum} und ${maximum} sein.`);
  }
  return value;
}

function frameName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value) || RESERVED_NAMES.has(value)) {
    invalid(`${label} enthält einen ungültigen Frame-Namen. Erlaubt sind bis zu 64 Buchstaben, Ziffern, - und _.`);
  }
  return value;
}

function relativeImagePath(value: unknown, label: string, allowSvg = false): string {
  const extension = allowSvg ? /\.(png|webp|jpe?g|svg)$/i : /\.(png|webp|jpe?g)$/i;
  if (typeof value !== 'string' || value.length > 200 || !extension.test(value) ||
      value.split('/').some((segment) => !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(segment)) ||
      /[\\:%?#]/.test(value)) {
    const formats = allowSvg ? 'PNG-, WebP-, JPEG- oder SVG-Datei' : 'PNG-, WebP- oder JPEG-Datei';
    invalid(`${label} muss eine relative ${formats} innerhalb dieses Grafiksets sein, zum Beispiel atlas.png.`);
  }
  return value;
}

function parseAtlas(value: unknown, label: string): SkinAtlas {
  const atlas = record(value, label);
  keys(atlas, ['image', 'fallbackImage', 'frames'], label);
  const inputFrames = record(atlas.frames, `${label}.frames`);
  const entries = Object.entries(inputFrames);
  if (entries.length < 1 || entries.length > SKIN_LIMITS.atlasFrames) invalid(`Ein Atlas benötigt 1 bis ${SKIN_LIMITS.atlasFrames} Frames.`);
  const frames: Record<string, AtlasFrame> = Object.create(null);
  for (const [name, input] of entries) {
    frameName(name, `${label}.frames`);
    const rect = record(input, `${label}.frames.${name}`);
    keys(rect, ['x', 'y', 'width', 'height'], `${label}.frames.${name}`);
    const max = SKIN_LIMITS.imageDimension;
    const frame = {
      x: number(rect.x, 0, max - 1, `${name}.x`, true),
      y: number(rect.y, 0, max - 1, `${name}.y`, true),
      width: number(rect.width, 1, max, `${name}.width`, true),
      height: number(rect.height, 1, max, `${name}.height`, true),
    };
    if (frame.x + frame.width > max || frame.y + frame.height > max) invalid(`Frame „${name}“ überschreitet die maximalen Atlasmaße von ${max} × ${max} Pixeln.`);
    frames[name] = frame;
  }
  const parsed: SkinAtlas = { image: relativeImagePath(atlas.image, `${label}.image`, true), frames };
  if (atlas.fallbackImage !== undefined) {
    parsed.fallbackImage = relativeImagePath(atlas.fallbackImage, `${label}.fallbackImage`);
    if (parsed.fallbackImage === parsed.image) invalid(`${label}.fallbackImage muss eine andere Datei als image verwenden.`);
  }
  return parsed;
}

function palette<T extends UiPalette | BoardPalette>(value: unknown, defaults: T, label: string): T {
  const output = { ...defaults };
  if (value === undefined) return output;
  const source = record(value, label);
  keys(source, Object.keys(defaults), label);
  for (const key of Object.keys(source)) {
    if (typeof source[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(source[key] as string)) {
      invalid(`${label}.${key} muss eine Farbe im Format #RRGGBB sein.`);
    }
    Object.assign(output, { [key]: source[key] });
  }
  return output;
}

function parseEntry(value: unknown): SkinEntry {
  const source = record(value, 'Grafikset-Eintrag');
  keys(source, ['id', 'name', 'file'], 'Grafikset-Eintrag');
  if (typeof source.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(source.id) || RESERVED_NAMES.has(source.id)) {
    invalid('Die Grafikset-ID darf nur kleine Buchstaben, Ziffern, - und _ enthalten (maximal 48 Zeichen).');
  }
  if (source.file !== `${source.id}/skin.json`) {
    invalid(`Die Datei für „${source.id}“ muss ${source.id}/skin.json heißen.`);
  }
  return { id: source.id, name: title(source.name, 'Grafikset-Name'), file: source.file };
}

/** Pure catalog parser. The selectable built-in fallback always remains present. */
export function parseSkinCatalog(value: unknown): SkinCatalog {
  const source = record(value, 'Grafikset-Verzeichnis');
  keys(source, ['version', 'default', 'skins'], 'Grafikset-Verzeichnis');
  if (source.version !== 1) invalid('Das Grafikset-Verzeichnis muss version: 1 verwenden.');
  if (!Array.isArray(source.skins) || source.skins.length < 1 || source.skins.length > SKIN_LIMITS.catalogEntries) {
    invalid(`Das Grafikset-Verzeichnis muss 1 bis ${SKIN_LIMITS.catalogEntries} Einträge enthalten.`);
  }
  const skins = source.skins.map(parseEntry);
  if (new Set(skins.map((entry) => entry.id)).size !== skins.length) invalid('Jede Grafikset-ID darf nur einmal im Verzeichnis stehen.');
  if (!skins.some((entry) => entry.id === 'classic')) skins.unshift({ ...BUILTIN_ENTRY });
  if (typeof source.default !== 'string' || !skins.some((entry) => entry.id === source.default)) {
    invalid('Das Standard-Grafikset unter „default“ fehlt im Verzeichnis.');
  }
  return { version: 1, default: source.default, skins };
}

/** Pure, strict parser; partial optional palettes/artwork retain vector fallbacks. */
export function parseSkinDefinition(value: unknown): SkinDefinition {
  const source = record(value, 'Grafikset');
  keys(source, ['version', 'name', 'presentation', 'palette', 'atlas', 'weapons', 'weaponAtlas', 'mobileAtlas', 'board', 'logo', 'portrait', 'turnPortraits', 'colorTurnPortraits', 'directionalTurnPortraits', 'flagVictoryFrames', 'pieces', 'teamPieces', 'motion'], 'Grafikset');
  if (source.version !== 1) invalid('Das Grafikset muss version: 1 verwenden.');
  if (source.presentation !== undefined && source.presentation !== 'modern' && source.presentation !== 'retro') {
    invalid('presentation muss „modern“ oder „retro“ sein.');
  }
  const colorInput = source.palette === undefined ? {} : record(source.palette, 'palette');
  keys(colorInput, ['ui', 'board'], 'palette');
  const motionInput = source.motion === undefined ? {} : record(source.motion, 'motion');
  keys(motionInput, ['moveMs', 'battleMs'], 'motion');
  const skin: SkinDefinition = {
    version: 1,
    name: title(source.name, 'Grafikset-Name'),
    presentation: source.presentation === 'retro' ? 'retro' : 'modern',
    palette: {
      ui: palette(colorInput.ui, DEFAULT_SKIN.palette.ui, 'palette.ui'),
      board: palette(colorInput.board, DEFAULT_SKIN.palette.board, 'palette.board'),
    },
    motion: {
      moveMs: motionInput.moveMs === undefined ? DEFAULT_SKIN.motion.moveMs : number(motionInput.moveMs, 0, 1000, 'motion.moveMs'),
      battleMs: motionInput.battleMs === undefined ? DEFAULT_SKIN.motion.battleMs : number(motionInput.battleMs, 100, 2000, 'motion.battleMs'),
    },
  };

  if (source.atlas !== undefined) {
    skin.atlas = parseAtlas(source.atlas, 'atlas');
  }

  if (source.mobileAtlas !== undefined) {
    const atlas = parseAtlas(source.mobileAtlas, 'mobileAtlas');
    if (/\.svg$/i.test(atlas.image)) invalid('mobileAtlas muss ein Rasterbild verwenden.');
    if (!skin.atlas || Object.keys(skin.atlas.frames).some((name) => !Object.hasOwn(atlas.frames, name))) {
      invalid('mobileAtlas muss alle Frames des Hauptatlas enthalten.');
    }
    skin.mobileAtlas = atlas;
  }

  function reference(value: unknown, label: string): string {
    const name = frameName(value, label);
    if (!skin.atlas || !Object.hasOwn(skin.atlas.frames, name)) invalid(`${label} verweist auf den fehlenden Atlas-Frame „${name}“.`);
    return name;
  }

  if (source.weapons !== undefined) {
    const input = record(source.weapons, 'weapons');
    keys(input, WEAPONS, 'weapons');
    skin.weapons = {};
    for (const weapon of WEAPONS) {
      if (input[weapon] !== undefined) skin.weapons[weapon] = reference(input[weapon], `weapons.${weapon}`);
    }
  }
  if (source.weaponAtlas !== undefined) {
    const atlas = parseAtlas(source.weaponAtlas, 'weaponAtlas');
    const weaponFrames = new Set(Object.values(skin.weapons ?? {}));
    for (const name of Object.keys(atlas.frames)) {
      if (!weaponFrames.has(name)) invalid(`weaponAtlas.frames.${name} muss unter weapons als Waffen-Frame deklariert sein.`);
    }
    skin.weaponAtlas = atlas;
  }

  function animationClips(value: unknown, label: string): ArtworkVariant['animations'] {
    if (value === undefined) return undefined;
    const animations = record(value, label);
    keys(animations, ANIMATIONS, label);
    const output: NonNullable<ArtworkVariant['animations']> = {};
    for (const state of ANIMATIONS) {
      if (animations[state] === undefined) continue;
      const clipLabel = `${label}.${state}`;
      const inputClip = record(animations[state], clipLabel);
      keys(inputClip, ['frames', 'fps'], clipLabel);
      if (!Array.isArray(inputClip.frames) || !inputClip.frames.length || inputClip.frames.length > SKIN_LIMITS.clipFrames) {
        invalid(`${clipLabel} benötigt 1 bis ${SKIN_LIMITS.clipFrames} Frames.`);
      }
      const clip: SkinAnimation = {
        frames: inputClip.frames.map((entry) => reference(entry, `${clipLabel}.frames`)),
        fps: number(inputClip.fps, 1, 30, `${clipLabel}.fps`),
      };
      output[state] = clip;
    }
    return output;
  }

  if (source.board !== undefined) {
    const input = record(source.board, 'board');
    keys(input, ['light', 'dark'], 'board');
    skin.board = {};
    if (input.light !== undefined) skin.board.light = reference(input.light, 'board.light');
    if (input.dark !== undefined) skin.board.dark = reference(input.dark, 'board.dark');
  }
  if (source.logo !== undefined) skin.logo = reference(source.logo, 'logo');
  if (source.portrait !== undefined) skin.portrait = reference(source.portrait, 'portrait');
  if (source.turnPortraits !== undefined) {
    const input = record(source.turnPortraits, 'turnPortraits');
    keys(input, TEAMS, 'turnPortraits');
    skin.turnPortraits = {};
    for (const team of TEAMS) {
      if (input[team] !== undefined) skin.turnPortraits[team] = reference(input[team], `turnPortraits.${team}`);
    }
  }
  if (source.colorTurnPortraits !== undefined) {
    const input = record(source.colorTurnPortraits, 'colorTurnPortraits');
    keys(input, COLORS, 'colorTurnPortraits');
    skin.colorTurnPortraits = {};
    for (const color of COLORS) {
      if (input[color] !== undefined) skin.colorTurnPortraits[color] = reference(input[color], `colorTurnPortraits.${color}`);
    }
  }
  if (source.directionalTurnPortraits !== undefined) {
    const input = record(source.directionalTurnPortraits, 'directionalTurnPortraits');
    keys(input, COLORS, 'directionalTurnPortraits');
    skin.directionalTurnPortraits = {};
    for (const color of COLORS) {
      if (input[color] === undefined) continue;
      const label = `directionalTurnPortraits.${color}`;
      const directions = record(input[color], label);
      keys(directions, PORTRAIT_DIRECTIONS, label);
      const output: Partial<Record<PortraitDirection, string>> = {};
      for (const direction of PORTRAIT_DIRECTIONS) {
        if (directions[direction] !== undefined) output[direction] = reference(directions[direction], `${label}.${direction}`);
      }
      skin.directionalTurnPortraits[color] = output;
    }
  }
  if (source.flagVictoryFrames !== undefined) {
    const input = record(source.flagVictoryFrames, 'flagVictoryFrames');
    keys(input, COLORS, 'flagVictoryFrames');
    skin.flagVictoryFrames = {};
    for (const color of COLORS) {
      if (input[color] !== undefined) skin.flagVictoryFrames[color] = reference(input[color], `flagVictoryFrames.${color}`);
    }
  }

  function pieceSet(value: unknown, label: string): PieceSet {
    const input = record(value, label);
    keys(input, PIECES, label);
    const output: PieceSet = {};
    for (const piece of PIECES) {
      if (input[piece] === undefined) continue;
      const pieceLabel = `${label}.${piece}`;
      const inputArtwork = record(input[piece], pieceLabel);
      keys(inputArtwork, ['frame', 'animations', 'revealed'], pieceLabel);
      const artwork: PieceArtwork = { frame: reference(inputArtwork.frame, `${pieceLabel}.frame`) };
      if (inputArtwork.animations !== undefined) {
        artwork.animations = animationClips(inputArtwork.animations, `${pieceLabel}.animations`);
      }
      if (inputArtwork.revealed !== undefined) {
        const revealedLabel = `${pieceLabel}.revealed`;
        const inputRevealed = record(inputArtwork.revealed, revealedLabel);
        keys(inputRevealed, ['frame', 'animations'], revealedLabel);
        artwork.revealed = { frame: reference(inputRevealed.frame, `${revealedLabel}.frame`) };
        if (inputRevealed.animations !== undefined) {
          artwork.revealed.animations = animationClips(inputRevealed.animations, `${revealedLabel}.animations`);
        }
      }
      output[piece] = artwork;
    }
    return output;
  }

  function perspectivePieces(value: unknown, label: string): PerspectivePieces {
    const input = record(value, label);
    keys(input, TEAMS, label);
    const output: PerspectivePieces = {};
    for (const team of TEAMS) {
      if (input[team] !== undefined) output[team] = pieceSet(input[team], `${label}.${team}`);
    }
    return output;
  }

  if (source.pieces !== undefined) skin.pieces = perspectivePieces(source.pieces, 'pieces');
  if (source.teamPieces !== undefined) {
    const input = record(source.teamPieces, 'teamPieces');
    keys(input, COLORS, 'teamPieces');
    skin.teamPieces = {};
    for (const color of COLORS) {
      if (input[color] !== undefined) skin.teamPieces[color] = perspectivePieces(input[color], `teamPieces.${color}`);
    }
  }
  return skin;
}

/** Checks actual decoded dimensions, including frames currently unused by pieces. */
export function validateAtlasDimensions(skin: SkinDefinition, width: number, height: number): void {
  validateFrameDimensions(skin.atlas, width, height);
}

function validateFrameDimensions(atlas: SkinAtlas | undefined, width: number, height: number): void {
  const max = SKIN_LIMITS.imageDimension;
  number(width, 1, max, 'Die Atlas-Bildbreite', true);
  number(height, 1, max, 'Die Atlas-Bildhöhe', true);
  for (const [name, frame] of Object.entries(atlas?.frames ?? {})) {
    if (frame.x + frame.width > width || frame.y + frame.height > height) {
      invalid(`Frame „${name}“ liegt außerhalb des geladenen Atlasbilds (${width} × ${height} Pixel).`);
    }
  }
}

/** Zero-network default; callers can always recover from a broken custom pack. */
export function builtInSkin(): LoadedSkin {
  return { id: 'classic', definition: structuredClone(DEFAULT_SKIN), image: null, imageUrl: null };
}

function freshUrl(path: string): string {
  return `${path}?skin=${Date.now().toString(36)}-${++loadSequence}`;
}

async function fetchJson(path: string, label: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SKIN_LIMITS.loadTimeoutMs);
  try {
    const response = await fetch(freshUrl(path), { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal });
    if (!response.ok) invalid(`${label} konnte nicht geladen werden (HTTP ${response.status}). Prüfe die Datei ${path}.`);
    const declaredSize = Number(response.headers.get('content-length'));
    if (declaredSize > SKIN_LIMITS.jsonBytes) {
      controller.abort();
      invalid(`${label} ist zu groß. Erlaubt sind höchstens 256 KiB JSON.`);
    }
    const reader = response.body?.getReader();
    if (!reader) invalid(`${label} ist leer.`);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '';
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > SKIN_LIMITS.jsonBytes) {
          await reader.cancel();
          invalid(`${label} ist zu groß. Erlaubt sind höchstens 256 KiB JSON.`);
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    try { return JSON.parse(text) as unknown; }
    catch { invalid(`${label} enthält ungültiges JSON. Prüfe Anführungszeichen, Klammern und Kommas.`); }
  } catch (error) {
    if (error instanceof SkinError) throw error;
    if (controller.signal.aborted) invalid(`${label} konnte innerhalb von 10 Sekunden nicht geladen werden.`);
    invalid(`${label} konnte nicht geladen werden. Prüfe die Verbindung und den Grafikset-Ordner.`);
  } finally {
    clearTimeout(timer);
  }
}

function loadAtlasImage(url: string, atlas: SkinAtlas): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') { reject(new SkinError('Grafikbilder können in dieser Umgebung nicht geladen werden.')); return; }
    const image = new Image();
    let settled = false;
    const clear = () => { clearTimeout(timer); image.onload = null; image.onerror = null; };
    const failed = (error: SkinError) => {
      if (settled) return;
      settled = true;
      clear(); image.removeAttribute('src'); reject(error);
    };
    const timer = setTimeout(() => failed(new SkinError('Das Atlasbild konnte innerhalb von 10 Sekunden nicht geladen werden.')), SKIN_LIMITS.loadTimeoutMs);
    image.onload = async () => {
      try {
        // Some browsers report load before the decoded pixels can be consumed by Canvas/WebGL.
        if (typeof image.decode === 'function') await image.decode();
        if (settled) return;
        validateFrameDimensions(atlas, image.naturalWidth, image.naturalHeight);
        settled = true;
        clear();
        resolve(image);
      } catch (error) {
        failed(error instanceof SkinError ? error : new SkinError('Das Atlasbild ist ungültig.'));
      }
    };
    image.onerror = () => failed(new SkinError(`Das Atlasbild „${atlas.image}“ konnte nicht geladen werden. Prüfe Dateiname und Bildformat.`));
    image.src = url;
  });
}

async function loadAtlas(atlas: SkinAtlas, packId: string): Promise<{ image: HTMLImageElement; imageUrl: string; imageIsVector: boolean }> {
  const load = async (path: string) => {
    const imageUrl = freshUrl(`/skins/${packId}/${path}`);
    const image = await loadAtlasImage(imageUrl, { ...atlas, image: path });
    return { image, imageUrl, imageIsVector: /\.svg$/i.test(path) };
  };
  try {
    return await load(atlas.image);
  } catch (primaryError) {
    if (!atlas.fallbackImage) throw primaryError;
    try {
      return await load(atlas.fallbackImage);
    } catch (fallbackError) {
      const reason = (error: unknown) => error instanceof Error ? error.message : 'Das Bild ist ungültig.';
      invalid(`${reason(primaryError)} Auch das Ersatzbild ist nicht verfügbar: ${reason(fallbackError)}`);
    }
  }
}

export async function loadSkinCatalog(): Promise<SkinCatalog> {
  return parseSkinCatalog(await fetchJson('/skins/index.json', 'Das Grafikset-Verzeichnis'));
}

export async function loadSkin(entry: SkinEntry): Promise<LoadedSkin> {
  // Validate again even if the caller did not obtain this entry from the catalog.
  const checked = parseEntry(entry);
  const definition = parseSkinDefinition(await fetchJson(`/skins/${checked.file}`, `Das Grafikset „${checked.name}“`));
  if (!definition.atlas) return { id: checked.id, definition, image: null, imageUrl: null };
  const mobile = mobileGraphics();
  const compatibleAtlas = mobile && definition.atlas.fallbackImage
    ? { ...definition.atlas, image: definition.atlas.fallbackImage, fallbackImage: definition.atlas.image }
    : definition.atlas;
  let loadedAtlas;
  if (mobile && definition.mobileAtlas) {
    try {
      loadedAtlas = await loadAtlas(definition.mobileAtlas, checked.id);
      definition.atlas = definition.mobileAtlas;
    } catch {
      // Keep a usable board when a custom server omits the optional mobile asset.
      loadedAtlas = await loadAtlas(compatibleAtlas, checked.id);
    }
  } else {
    loadedAtlas = await loadAtlas(compatibleAtlas, checked.id);
  }
  const skin: LoadedSkin = { id: checked.id, definition, ...loadedAtlas };
  if (definition.weaponAtlas && !mobile) {
    try {
      const { image, imageUrl } = await loadAtlas(definition.weaponAtlas, checked.id);
      skin.weaponAtlas = { image, imageUrl };
    } catch {
      // The same weapon frames in the main atlas remain usable if this optional image fails.
    }
  }
  return skin;
}
