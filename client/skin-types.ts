/** Public contract for replaceable, local graphics packs. Coordinates are pixels. */
export type SkinPiece = 'rock' | 'paper' | 'scissors' | 'flag' | 'trap' | 'unknown';
export type SkinWeapon = 'rock' | 'paper' | 'scissors';
export type SkinTeam = 'own' | 'enemy';
/** Stable player identity: seat 0 is blue, seat 1 is red in every browser. */
export type TeamColor = 'blue' | 'red';
/** Location of a player's army in the current viewer's board orientation. */
export type PortraitDirection = 'top' | 'bottom';
export type SkinAnimationState = 'idle' | 'selected' | 'move' | 'duel' | 'attack' | 'win' | 'lose';

export interface AtlasFrame { x: number; y: number; width: number; height: number }
export interface SkinAtlas {
  image: string;
  /** Optional raster replacement, using the same dimensions and frame coordinates. */
  fallbackImage?: string;
  frames: Record<string, AtlasFrame>;
}
export interface SkinAnimation { frames: string[]; fps: number }
export interface ArtworkVariant {
  frame: string;
  animations?: Partial<Record<SkinAnimationState, SkinAnimation>>;
}
export interface PieceArtwork extends ArtworkVariant {
  /** Optional complete artwork for a publicly revealed piece; never nested. */
  revealed?: ArtworkVariant;
}
export type PieceSet = Partial<Record<SkinPiece, PieceArtwork>>;
export type PerspectivePieces = Partial<Record<SkinTeam, PieceSet>>;
export interface UiPalette {
  background: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  /** Blue/seat 0; the legacy name does not change with the viewer. */
  own: string;
  /** Red/seat 1; the legacy name does not change with the viewer. */
  enemy: string;
}
export interface BoardPalette {
  light: string;
  dark: string;
  border: string;
  setupOwn: string;
  setupEnemy: string;
  selected: string;
  accent: string;
  duel: string;
  coordinates: string;
  shadow: string;
  dots: string;
  focus: string;
  ownBase: string;
  ownEdge: string;
  ownSymbol: string;
  enemyBase: string;
  enemyEdge: string;
  enemySymbol: string;
  revealed: string;
}
export const SOUND_CUES = ['shuffle', 'move', 'moveBlue', 'moveRed', 'rock', 'paper', 'scissors', 'trap', 'trapFall', 'flag', 'duel', 'win', 'lose', 'draw', 'gong', 'redTurn', 'blueTurn', 'youWin', 'youLose', 'yawn'] as const;
export type SoundCue = typeof SOUND_CUES[number];
export interface SkinSound { file: string; volume: number; rate: number; variants?: string[] }
export interface SkinArtwork {
  /** Relative directory containing the nine team/mood/referee SVGs. */
  endgame?: string;
  gong?: { idle: string; strike: string; strikeMs: number; durationMs: number };
}
/** The parser fills missing palette/motion fields with the built-in defaults. */
export interface SkinDefinition {
  version: 1;
  name: string;
  /** Reuse image files from another local pack; frame definitions remain explicit. */
  assetPack?: string;
  /** Optional interface and board treatment; artwork and rules stay independent. */
  presentation?: 'modern' | 'retro';
  audio?: Partial<Record<SoundCue, SkinSound>>;
  artwork?: SkinArtwork;
  palette: { ui: UiPalette; board: BoardPalette };
  atlas?: SkinAtlas;
  /** Standalone weapons for rules and concealed choices; frames also exist in the main atlas. */
  weapons?: Partial<Record<SkinWeapon, string>>;
  /** Optional sharper SVG/raster artwork for declared weapons, using the same frame names. */
  weaponAtlas?: SkinAtlas;
  /** Optional small raster atlas for touch-first devices, with its own coordinates. */
  mobileAtlas?: SkinAtlas;
  board?: { light?: string; dark?: string };
  logo?: string;
  /** Speech bubble shown for unread room chat messages. */
  chatNotice?: string;
  /** Optional static host/referee illustration used by the retro masthead. */
  portrait?: string;
  /** Legacy color slots: own is blue/seat 0, enemy is red/seat 1. */
  turnPortraits?: Partial<Record<SkinTeam, string>>;
  /** Portraits follow absolute player colors, independently of the viewing player. */
  colorTurnPortraits?: Partial<Record<TeamColor, string>>;
  /** Absolute player color, then its position in this viewer's board orientation. */
  directionalTurnPortraits?: Partial<Record<TeamColor, Partial<Record<PortraitDirection, string>>>>;
  /** Frontal flag-capture victory poses, keyed by the capturer's absolute owner color. */
  flagVictoryFrames?: Partial<Record<TeamColor, string>>;
  /** Legacy color slots; use teamPieces when separate viewing directions exist. */
  pieces?: PerspectivePieces;
  /** Absolute owner color, then the own/enemy viewing direction for that color. */
  teamPieces?: Partial<Record<TeamColor, PerspectivePieces>>;
  motion: { moveMs: number; battleMs: number };
}
export interface SkinEntry { id: string; name: string; file: string }
export interface SkinCatalog { version: 1; default: string; skins: SkinEntry[] }
export interface LoadedSkin {
  id: string;
  definition: SkinDefinition;
  image: HTMLImageElement | null;
  imageUrl: string | null;
  /** Describes the image that actually loaded, including a possible raster fallback. */
  imageIsVector?: boolean;
  weaponAtlas?: { image: HTMLImageElement; imageUrl: string };
}
