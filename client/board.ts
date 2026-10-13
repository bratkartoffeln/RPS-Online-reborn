import { mobileGraphics, mobileRenderScale } from './mobile-graphics';
import Phaser from 'phaser';
import type { GameActionView, GameView, PieceView } from '../shared/game';
import {
  artworkForPiece, artworkFrame, canContinueEffect, captureMotionFrame, CELEBRATION_MS,
  celebrationOffset, clipDuration, FLAG_CELEBRATION_MS, flagCelebrationOffset, flagVictoryForView,
  freshActionFromFrame, smoothStep, type FlagVictory, type MotionFrame,
} from './board-motion';
import type { ArtworkVariant, BoardPalette, LoadedSkin, SkinAnimationState, TeamColor } from './skin-types';
import { builtInSkin, SKIN_LIMITS } from './skins';
import { otherTeamColor, teamColorForPlayer } from './team-ui';

const WIDTH = 680;
const HEIGHT = 616;
const MAX_RENDER_SCALE = 2;
const COLS = 7;
const ROWS = 6;
const CELL = 78;
const PITCH = 84;
const LEFT = 49;
const TOP = 47;

const KIND_NAMES: Record<string, string> = {
  rock: 'Stein', paper: 'Papier', scissors: 'Schere', flag: 'Flagge', trap: 'Falle',
};

export function coordinate(index: number): string {
  return String.fromCharCode(65 + (index % COLS)) + (ROWS - Math.floor(index / COLS));
}

export function kindName(kind: string | null): string {
  return kind ? KIND_NAMES[kind] ?? kind : 'verdeckte Figur';
}

function previewPieces(): (PieceView | null)[] {
  const board: (PieceView | null)[] = Array.from({ length: 42 }, () => null);
  const kinds = ['rock', 'paper', 'scissors', 'rock', 'paper', 'scissors', 'rock', 'paper', 'scissors', 'flag', 'trap', 'rock', 'paper', 'scissors'] as const;
  for (let i = 0; i < 14; i++) {
    board[i] = { id: 'preview-enemy-' + i, owner: 'preview-enemy', kind: null, revealed: false };
    board[28 + i] = { id: 'preview-you-' + i, owner: 'preview-you', kind: kinds[i], revealed: false };
  }
  return board;
}

type Point = { x: number; y: number };
type BoardCallbacks = {
  onCell: (index: number) => void;
  onCancel: () => void;
  onFocus: (description: string) => void;
  onSwap?: (from: number, to: number) => void;
};
type PieceVisual = {
  piece: PieceView;
  index: number;
  ghost: boolean;
  container: Phaser.GameObjects.Container;
  vector: Phaser.GameObjects.Graphics;
  question: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Sprite | null;
  artwork: ArtworkVariant | undefined;
  appearance: string;
  shownFrame: string | null;
  clipState: SkinAnimationState | null;
  clipElapsed: number;
  effectState: SkinAnimationState | null;
  effectElapsed: number;
};
type BoardEffect = {
  action: GameActionView;
  elapsed: number;
  moveMs: number;
  attackMs: number;
  resultMs: number;
};
type TeamCelebration = {
  ownerId: string;
  pieceIds: string[];
  heroId: string | null;
  seriesId: string;
  matchId: string;
  signature: string;
  elapsed: number;
};
type Gesture = {
  pointerId: number;
  from: number;
  pieceId: string | null;
  start: Point;
  offset: Point;
  canDrag: boolean;
  dragging: boolean;
  revision: number;
};

class ArenaScene extends Phaser.Scene {
  private resolveReady!: () => void;
  readonly whenReady = new Promise<void>(resolve => { this.resolveReady = resolve; });
  private base!: Phaser.GameObjects.Graphics;
  private tiles!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Graphics;
  private pieces!: Phaser.GameObjects.Container;
  private interaction!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Container;
  private ready = false;
  private view: GameView | null = null;
  private motionFrame: MotionFrame | null = null;
  private selected: number | null = null;
  private cursor = 38;
  private keyboardFocus = false;
  private enabled = true;
  private animationsEnabled = true;
  private skin: LoadedSkin = builtInSkin();
  private textureKey: string | null = null;
  private textureSequence = 0;
  private atlasFrames = new Set<string>();
  private tileImages: Array<Phaser.GameObjects.Image | null> = [];
  private visuals = new Map<string, PieceVisual>();
  private effect: BoardEffect | null = null;
  private celebration: TeamCelebration | null = null;
  private flagVictory: FlagVictory | null = null;
  private gesture: Gesture | null = null;
  private demoBoard = previewPieces();

  constructor(private callbacks: BoardCallbacks, private renderScale: number, private mobile = false) {
    super('arena');
  }

  create(): void {
    // Phaser 3.90 FIT scales the canvas with CSS, without a renderer resolution
    // setting. Render into a larger canvas, while keeping this 680 x 616 world.
    this.cameras.main.setZoom(this.renderScale).centerOn(WIDTH / 2, HEIGHT / 2);
    this.cameras.main.preRender();
    this.base = this.add.graphics().setDepth(0);
    this.tiles = this.add.container().setDepth(1);
    this.overlay = this.add.graphics().setDepth(2);
    this.pieces = this.add.container().setDepth(3);
    this.interaction = this.add.graphics().setDepth(4);
    this.labels = this.add.container().setDepth(5);
    this.sys.game.canvas.setAttribute('aria-hidden', 'true');
    this.sys.game.canvas.style.touchAction = 'auto';
    this.ready = true;
    this.installTexture();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.pointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.pointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.pointerUp(pointer));
    this.input.on('pointerupoutside', () => this.cancelGesture());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    this.paint();
    this.resolveReady();
  }

  private wakeFrame: number | null = null;

  requestRender(): void {
    if (!this.ready || document.hidden || this.sys.game.loop.running || this.wakeFrame !== null) return;
    // Defer until input has been queued and snapshot/effect changes are complete.
    this.wakeFrame = requestAnimationFrame(() => {
      this.wakeFrame = null;
      if (!this.ready || document.hidden || this.sys.game.loop.running) return;
      this.sys.game.loop.resetDelta();
      this.sys.game.loop.wake();
    });
  }

  resizeRender(scale: number): void {
    this.renderScale = scale;
    if (!this.ready) return;
    const width = Math.round(WIDTH * scale), height = Math.round(HEIGHT * scale);
    this.sys.game.scale.resize(width, height);
    this.cameras.main.setSize(width, height).setZoom(scale).centerOn(WIDTH / 2, HEIGHT / 2);
    this.cameras.main.preRender();
    this.paint();
  }

  update(_time: number, delta: number): void {
    if (!this.ready) return;
    const elapsed = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    if (this.effect) {
      this.effect.elapsed += elapsed;
      this.applyEffect();
    }
    if (this.celebration) {
      this.celebration.elapsed += elapsed;
      this.applyCelebration();
    }
    for (const visual of this.visuals.values()) this.animateArtwork(visual, elapsed);
    // Only the visual clock sleeps. Network, chat and combat timers stay alive.
    const animated = !this.mobile && this.animationsEnabled && [...this.visuals.values()].some(visual => {
      const frames = visual.artwork?.animations?.[this.normalState(visual)]?.frames;
      return visual.sprite && frames && new Set(frames).size > 1;
    });
    if (!this.effect && !this.celebration && !this.gesture?.dragging && !animated) this.sys.game.loop.sleep();
  }

  setView(view: GameView | null, selected: number | null, enabled: boolean): void {
    const nextFrame = captureMotionFrame(view);
    if (this.mobile && this.ready && this.motionFrame?.signature === nextFrame?.signature &&
        this.view?.revision === view?.revision && this.selected === selected && this.enabled === enabled) {
      this.view = view;
      return;
    }
    const action = this.ready && this.animationsEnabled ? freshActionFromFrame(this.motionFrame, view) : null;
    if (this.celebration && (this.celebration.seriesId !== view?.series.id ||
        this.celebration.matchId !== view?.series.matchId || this.celebration.signature !== nextFrame?.signature)) {
      this.finishCelebration();
    }
    if (this.effect && (action || !canContinueEffect(this.motionFrame, nextFrame))) this.finishEffect();
    if (this.gesture && (!enabled || !view || view.revision !== this.gesture.revision)) this.cancelGesture();
    this.view = view;
    this.motionFrame = nextFrame;
    this.selected = selected;
    this.enabled = enabled;
    this.paint();
    if (action) this.startEffect(action);
  }

  setSkin(skin: LoadedSkin): void {
    if (this.skin === skin) return;
    this.finishCelebration();
    this.finishEffect();
    this.cancelGesture();
    this.skin = skin;
    if (!this.ready) return;
    this.clearArtwork();
    this.installTexture();
    this.paint();
  }

  setAnimationsEnabled(enabled: boolean): void {
    if (this.animationsEnabled === enabled) return;
    this.animationsEnabled = enabled;
    this.requestRender();
    if (!enabled) {
      this.finishCelebration();
      this.finishEffect();
    }
    for (const visual of this.visuals.values()) {
      visual.clipState = null;
      visual.clipElapsed = 0;
      this.animateArtwork(visual, 0);
    }
  }

  celebrate(ownerId: string): void {
    this.finishCelebration();
    if (!this.ready || !this.animationsEnabled || !this.view || !this.motionFrame ||
        (this.view.phase !== 'playing' && this.view.phase !== 'finished') ||
        (this.view.paused && this.view.phase !== 'finished')) return;
    const pieceIds = this.view.board.flatMap((piece) => piece?.owner === ownerId ? [piece.id] : []);
    if (!pieceIds.length) return;
    // A celebration owns only the visual offset; settle battle ghosts and any
    // arrangement gesture first so there is never a second position writer.
    this.finishEffect();
    this.cancelGesture();
    this.celebration = {
      ownerId, pieceIds, seriesId: this.view.series.id, matchId: this.view.series.matchId,
      heroId: this.flagVictory?.ownerId === ownerId ? this.flagVictory.pieceId : null,
      signature: this.motionFrame.signature, elapsed: 0,
    };
    this.requestRender();
    this.applyCelebration();
    for (const id of pieceIds) {
      const visual = this.visuals.get(id);
      if (visual) this.animateArtwork(visual, 0);
    }
  }

  handleKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
    if (event.key in offsets) {
      event.preventDefault();
      this.finishCelebration();
      this.cancelGesture();
      this.keyboardFocus = true;
      const col = this.cursor % COLS;
      const row = Math.floor(this.cursor / COLS);
      if ((event.key === 'ArrowLeft' && col > 0) || (event.key === 'ArrowRight' && col < COLS - 1) || (event.key === 'ArrowUp' && row > 0) || (event.key === 'ArrowDown' && row < ROWS - 1)) {
        this.cursor += offsets[event.key];
      }
      this.callbacks.onFocus(this.describe(this.toLogical(this.cursor)));
      this.paint();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.finishCelebration();
      this.keyboardFocus = true;
      if (this.view && this.enabled) this.callbacks.onCell(this.toLogical(this.cursor));
      this.callbacks.onFocus(this.describe(this.toLogical(this.cursor)));
      this.paint();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.finishCelebration();
      this.cancelGesture();
      this.callbacks.onCancel();
      this.paint();
    }
  }

  onBlur(): void {
    this.finishCelebration();
    this.keyboardFocus = false;
    this.cancelGesture();
    this.paint();
  }

  private get rotated(): boolean {
    return this.view?.players.find((player) => player.id === this.view?.you)?.seat === 1;
  }

  private get board(): (PieceView | null)[] { return this.view?.board ?? this.demoBoard; }
  private get you(): string { return this.view?.you ?? 'preview-you'; }
  private get palette(): BoardPalette { return this.skin.definition.palette.board; }
  private get retro(): boolean { return this.skin.definition.presentation === 'retro'; }
  private color(key: keyof BoardPalette): number { return Number.parseInt(this.palette[key].slice(1), 16); }
  private teamColor(owner: string): TeamColor {
    const ownColor = teamColorForPlayer(this.view, this.you);
    return teamColorForPlayer(this.view, owner, owner === this.you ? ownColor : otherTeamColor(ownColor));
  }

  private toLogical(displayIndex: number): number {
    return this.rotated ? 41 - displayIndex : displayIndex;
  }

  private position(index: number): Point {
    const display = this.toLogical(index);
    return {
      x: LEFT + (display % COLS) * PITCH + CELL / 2,
      y: TOP + Math.floor(display / COLS) * PITCH + CELL / 2 - 1,
    };
  }

  private cellAt(pointer: Phaser.Input.Pointer): number | null {
    // Joined retro squares fill the old gutters, including their hit areas.
    const inset = this.retro ? (PITCH - CELL) / 2 : 0;
    const size = this.retro ? PITCH : CELL;
    const point = this.boardPoint(pointer);
    const x = point.x - LEFT + inset;
    const y = point.y - TOP + inset;
    if (x < 0 || y < 0 || x % PITCH >= size || y % PITCH >= size) return null;
    const column = Math.floor(x / PITCH);
    const row = Math.floor(y / PITCH);
    return column < COLS && row < ROWS ? this.toLogical(row * COLS + column) : null;
  }

  private boardPoint(pointer: Phaser.Input.Pointer): Point {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private clientPoint(pointer: Phaser.Input.Pointer): Point {
    const event = pointer.event as MouseEvent & { changedTouches?: TouchList };
    const touch = event.changedTouches?.[0];
    // Keep the drag threshold in CSS pixels, independent of canvas density.
    return {
      x: touch?.clientX ?? event.clientX ?? pointer.x / this.scale.displayScale.x,
      y: touch?.clientY ?? event.clientY ?? pointer.y / this.scale.displayScale.y,
    };
  }

  private canArrange(index: number): boolean {
    const view = this.view;
    return !!view && this.enabled && (view.phase === 'waiting' || view.phase === 'setup') &&
      !view.players.find((player) => player.id === view.you)?.ready && view.board[index]?.owner === view.you;
  }

  private pointerDown(pointer: Phaser.Input.Pointer): void {
    this.finishCelebration();
    if (this.gesture || !this.view || !this.enabled) return;
    const from = this.cellAt(pointer);
    if (from === null) return;
    this.keyboardFocus = false;
    this.cursor = this.toLogical(from);
    const position = this.position(from);
    const point = this.boardPoint(pointer);
    this.gesture = {
      pointerId: pointer.id, from, pieceId: this.board[from]?.id ?? null,
      start: this.clientPoint(pointer), offset: { x: point.x - position.x, y: point.y - position.y },
      canDrag: !pointer.wasTouch && !!this.callbacks.onSwap && this.canArrange(from), dragging: false, revision: this.view.revision,
    };
  }

  private pointerMove(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== pointer.id || !pointer.isDown) return;
    const now = this.clientPoint(pointer);
    if (pointer.wasTouch) {
      if (Math.hypot(now.x - gesture.start.x, now.y - gesture.start.y) > 10) this.cancelGesture();
      return;
    }
    if (!gesture.canDrag) return;
    if (!gesture.dragging && Math.hypot(now.x - gesture.start.x, now.y - gesture.start.y) <= 10) return;
    if (!this.canArrange(gesture.from) || !gesture.pieceId) { this.cancelGesture(); return; }
    gesture.dragging = true;
    const visual = this.visuals.get(gesture.pieceId);
    if (!visual) return;
    this.pieces.bringToTop(visual.container);
    const point = this.boardPoint(pointer);
    visual.container.setPosition(point.x - gesture.offset.x, point.y - gesture.offset.y).setScale(1.06).setAlpha(.9);
  }

  private pointerUp(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== pointer.id) return;
    const to = this.cellAt(pointer);
    this.gesture = null;
    this.snapVisuals();
    if (!this.view || !this.enabled || this.view.revision !== gesture.revision) return;
    if (gesture.dragging) {
      if (to !== null && to !== gesture.from && this.canArrange(gesture.from) && this.canArrange(to) &&
          this.board[gesture.from]?.id === gesture.pieceId) {
        this.callbacks.onFocus(coordinate(gesture.from) + ' und ' + coordinate(to) + ': Figuren tauschen.');
        this.callbacks.onSwap?.(gesture.from, to);
      }
    } else if (to === gesture.from && (!pointer.wasTouch ||
        Math.hypot(this.clientPoint(pointer).x - gesture.start.x, this.clientPoint(pointer).y - gesture.start.y) <= 10)) {
      this.callbacks.onFocus(this.describe(to));
      this.callbacks.onCell(to);
    }
    this.paint();
  }

  private cancelGesture(): void {
    if (!this.gesture) return;
    this.gesture = null;
    this.snapVisuals();
  }

  private describe(index: number): string {
    const piece = this.board[index];
    let description = coordinate(index) + '. ';
    if (!piece) description += 'Leeres Feld.';
    else description += (piece.owner === this.you ? 'Deine Figur' : 'Gegnerische Figur') + ': ' + kindName(piece.kind) + '.' + (piece.revealed ? ' Aufgedeckt.' : '');
    if (index === this.selected) description += ' Ausgewählt.';
    if (this.selected !== null && this.view?.legalMoves[this.selected]?.includes(index)) description += piece ? ' Angriff möglich.' : ' Zug möglich.';
    const last = this.view?.lastAction;
    if (last?.from === index) description += ' Startfeld des letzten Zuges.';
    if (last?.to === index) description += ' Zielfeld des letzten Zuges.';
    return description;
  }

  private text(x: number, y: number, value: string, size: number, color: string, weight = 'normal'): void {
    const label = this.add.text(x, y, value, {
      fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: size + 'px', color, fontStyle: weight,
      resolution: this.renderScale,
    }).setOrigin(.5);
    this.labels.add(label);
  }

  private installTexture(): void {
    if (!this.skin.image || !this.skin.definition.atlas) return;
    const key = 'arena-skin-' + (++this.textureSequence);
    const image = this.skin.image;
    let texture: Phaser.Textures.Texture | null = null;
    let scaleX = 1, scaleY = 1;
    if (this.skin.imageIsVector) {
      // Upload vector artwork at the board's actual render density. Passing the
      // SVG directly to WebGL would rasterize it at its intrinsic 1x dimensions.
      const renderer = this.sys.game.renderer;
      const gpuLimit = 'getMaxTextureSize' in renderer ? renderer.getMaxTextureSize() : SKIN_LIMITS.imageDimension;
      const limit = Math.min(SKIN_LIMITS.imageDimension, Number.isFinite(gpuLimit) && gpuLimit > 0 ? gpuLimit : SKIN_LIMITS.imageDimension);
      const factor = Math.min(this.renderScale, limit / image.naturalWidth, limit / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(limit, Math.ceil(image.naturalWidth * factor));
      canvas.height = Math.min(limit, Math.ceil(image.naturalHeight * factor));
      try {
        const context = canvas.getContext('2d');
        if (context) {
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          // A static Texture avoids CanvasTexture's additional full-size pixel
          // readback and buffer; only the canvas and GPU texture are needed.
          texture = this.textures.create(key, canvas, canvas.width, canvas.height);
          if (texture) {
            texture.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
            scaleX = canvas.width / image.naturalWidth;
            scaleY = canvas.height / image.naturalHeight;
          }
        }
      } catch {
        if (this.textures.exists(key)) this.textures.remove(key);
        texture = null;
        // If the larger buffer cannot be allocated, the decoded image remains
        // a usable texture at its original size instead of breaking the board.
      }
    }
    texture ??= this.textures.addImage(key, image);
    if (!texture) return;
    this.textureKey = key;
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    for (const [name, frame] of Object.entries(this.skin.definition.atlas.frames)) {
      if (name === '__BASE' || Object.hasOwn(Object.prototype, name)) continue;
      if (texture.add(name, 0, frame.x * scaleX, frame.y * scaleY, frame.width * scaleX, frame.height * scaleY)) this.atlasFrames.add(name);
    }
  }

  private clearArtwork(): void {
    for (const visual of this.visuals.values()) visual.container.destroy();
    this.visuals.clear();
    this.tiles.removeAll(true);
    this.tileImages = [];
    if (this.textureKey && this.textures.exists(this.textureKey)) this.textures.remove(this.textureKey);
    this.textureKey = null;
    this.atlasFrames.clear();
  }

  private dispose(): void {
    if (this.wakeFrame !== null) cancelAnimationFrame(this.wakeFrame);
    this.wakeFrame = null;
    this.finishCelebration();
    this.finishEffect();
    this.gesture = null;
    this.clearArtwork();
    this.ready = false;
  }

  private paint(): void {
    if (!this.ready) return;
    this.requestRender();
    const victory = flagVictoryForView(this.skin.definition, this.view);
    this.flagVictory = victory && this.textureKey && this.atlasFrames.has(victory.frame) ? victory : null;
    this.paintBoard();
    this.syncVisuals();
    this.applyCelebration();
    for (const visual of this.visuals.values()) this.animateArtwork(visual, 0);
  }

  private paintBoard(): void {
    const base = this.base.clear();
    const overlay = this.overlay.clear();
    const interaction = this.interaction.clear();
    this.labels.removeAll(true);
    const setup = !this.view || this.view.phase === 'setup' || this.view.phase === 'waiting';
    const possibleMoves = this.selected === null ? [] : this.view?.legalMoves[this.selected] ?? [];
    const last = this.view?.lastAction;
    const retro = this.retro;
    const tileSize = retro ? PITCH : CELL;
    const tileInset = retro ? (PITCH - CELL) / 2 : 0;

    // Absolute coordinates turn with the board; each player's army remains below.
    for (let column = 0; column < COLS; column++) {
      const logical = this.toLogical(column);
      const letter = String.fromCharCode(65 + (logical % COLS));
      this.text(LEFT + column * PITCH + CELL / 2, 23, letter, 11, this.palette.coordinates);
      this.text(LEFT + column * PITCH + CELL / 2, TOP + (ROWS - 1) * PITCH + CELL + 24, letter, 11, this.palette.coordinates);
    }
    for (let row = 0; row < ROWS; row++) {
      const rowLabel = String(ROWS - Math.floor(this.toLogical(row * COLS) / COLS));
      this.text(25, TOP + row * PITCH + CELL / 2, rowLabel, 11, this.palette.coordinates);
      this.text(WIDTH - 25, TOP + row * PITCH + CELL / 2, rowLabel, 11, this.palette.coordinates);
    }

    for (let display = 0; display < COLS * ROWS; display++) {
      const index = this.toLogical(display);
      const col = display % COLS;
      const row = Math.floor(display / COLS);
      const x = LEFT + col * PITCH;
      const y = TOP + row * PITCH;
      const piece = this.board[index];
      const blue = piece ? this.teamColor(piece.owner) === 'blue' : false;
      const selected = this.selected === index;
      const destination = possibleMoves.includes(index);
      const inDuel = this.view?.duel && (this.view.duel.from === index || this.view.duel.to === index);
      const shade = (row + col) % 2 === 0 ? 'light' : 'dark';
      const tileFrame = this.skin.definition.board?.[shade];
      const hasTile = !!tileFrame && !!this.textureKey && this.atlasFrames.has(tileFrame);
      let tile = this.tileImages[display];
      if (hasTile) {
        if (!tile) {
          tile = this.add.image(x + CELL / 2, y + CELL / 2, this.textureKey!, tileFrame);
          this.tiles.add(tile);
          this.tileImages[display] = tile;
        }
        tile.setTexture(this.textureKey!, tileFrame).setDisplaySize(tileSize, tileSize).setVisible(true);
      } else tile?.setVisible(false);

      if (retro) {
        base.fillStyle(this.color(shade), 1).fillRect(x - tileInset, y - tileInset, tileSize, tileSize);
      } else {
        base.fillStyle(this.color('shadow'), .35).fillRoundedRect(x, y + 3, CELL, CELL, 6);
        base.fillStyle(this.color(shade), 1).fillRoundedRect(x, y, CELL, CELL, 6);
      }
      if (setup && piece && !retro) overlay.fillStyle(this.color(blue ? 'setupOwn' : 'setupEnemy'), hasTile ? .64 : 1).fillRoundedRect(x, y, CELL, CELL, 6);
      if (last && (last.from === index || last.to === index)) {
        overlay.fillStyle(this.color('accent'), last.to === index ? .10 : .04).fillRoundedRect(x + 1, y + 1, CELL - 2, CELL - 2, 5);
        overlay.lineStyle(last.to === index ? 2 : 1.5, this.color('accent'), last.to === index ? .62 : .34);
        overlay.strokeRoundedRect(x + 2, y + 2, CELL - 4, CELL - 4, 5);
      }
      if (selected) overlay.fillStyle(this.color('selected'), retro ? .50 : hasTile ? .78 : 1).fillRoundedRect(x, y, CELL, CELL, retro ? 0 : 6);
      overlay.lineStyle(selected ? 2.5 : 1, this.color(selected ? 'accent' : inDuel ? 'duel' : 'border'), selected || inDuel ? .95 : .65);
      if (retro) overlay.strokeRect(x - tileInset + .5, y - tileInset + .5, tileSize - 1, tileSize - 1);
      else overlay.strokeRoundedRect(x + .5, y + .5, CELL - 1, CELL - 1, 6);
      if (!piece && !destination && !retro) overlay.fillStyle(this.color('dots'), .12).fillCircle(x + CELL / 2, y + CELL / 2, 1.7);

      if (destination) {
        if (piece) {
          interaction.lineStyle(2.5, this.color('accent'), .95);
          for (const [cx, cy, dx, dy] of [[x + 3, y + 3, 1, 1], [x + CELL - 3, y + 3, -1, 1], [x + 3, y + CELL - 3, 1, -1], [x + CELL - 3, y + CELL - 3, -1, -1]]) {
            interaction.beginPath().moveTo(cx, cy + dy * 10).lineTo(cx, cy).lineTo(cx + dx * 10, cy).strokePath();
          }
        } else {
          interaction.fillStyle(this.color('accent'), .22).fillCircle(x + CELL / 2, y + CELL / 2, 15);
          interaction.fillStyle(this.color('accent'), .9).fillCircle(x + CELL / 2, y + CELL / 2, 5);
        }
      }
      if (this.keyboardFocus && this.cursor === display) {
        interaction.lineStyle(2, this.color('focus'), .95).strokeRoundedRect(x + 4, y + 4, CELL - 8, CELL - 8, 4);
      }
    }
    if (last) this.drawLastDirection(last);
    this.text(WIDTH / 2, HEIGHT - 16, last ? 'LETZTER ZUG  ' + coordinate(last.from) + ' → ' + coordinate(last.to) :
      this.view ? 'ZWEI TEAMS. EIN ZIEL.' : 'DEIN TEAM STARTET UNTEN', 9, this.palette.coordinates);
  }

  private drawLastDirection(action: GameActionView): void {
    const from = this.position(action.from);
    const to = this.position(action.to);
    const dx = (to.x - from.x) / PITCH;
    const dy = (to.y - from.y) / PITCH;
    const cx = (from.x + to.x) / 2;
    const cy = (from.y + to.y) / 2;
    const g = this.overlay.lineStyle(2, this.color('accent'), .75);
    g.beginPath().moveTo(cx - dx * 8, cy - dy * 8).lineTo(cx + dx * 6, cy + dy * 6).strokePath();
    g.beginPath().moveTo(cx + dx * 1 - dy * 4, cy + dy * 1 + dx * 4)
      .lineTo(cx + dx * 6, cy + dy * 6).lineTo(cx + dx * 1 + dy * 4, cy + dy * 1 - dx * 4).strokePath();
  }

  private createVisual(piece: PieceView, index: number, ghost: boolean): PieceVisual {
    const position = this.position(index);
    const container = this.add.container(position.x, position.y);
    const glow = this.add.graphics();
    const vector = this.add.graphics();
    const question = this.add.text(0, 0, '?', {
      fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: '30px', fontStyle: '600',
      resolution: this.renderScale,
    }).setOrigin(.5).setVisible(false);
    const marker = this.add.graphics();
    container.add([glow, vector, question, marker]);
    this.pieces.add(container);
    const visual: PieceVisual = {
      piece, index, ghost, container, vector, question, marker, glow, sprite: null,
      artwork: undefined, appearance: '', shownFrame: null, clipState: null, clipElapsed: 0,
      effectState: null, effectElapsed: 0,
    };
    this.visuals.set(piece.id, visual);
    this.paintVisual(visual);
    return visual;
  }

  private syncVisuals(): void {
    const wanted = new Set<string>();
    this.board.forEach((piece, index) => {
      if (!piece) return;
      wanted.add(piece.id);
      const visual = this.visuals.get(piece.id) ?? this.createVisual(piece, index, false);
      visual.piece = piece; // The current public DTO is the only source of a live figure's kind.
      visual.index = index;
      visual.ghost = false;
      this.paintVisual(visual);
      if (!this.isEffectPiece(piece.id) && this.gesture?.pieceId !== piece.id) this.snapVisual(visual);
    });
    for (const [id, visual] of this.visuals) {
      if (!wanted.has(id) && !(visual.ghost && this.isEffectPiece(id))) {
        visual.container.destroy();
        this.visuals.delete(id);
      }
    }
  }

  private paintVisual(visual: PieceVisual): void {
    const own = visual.piece.owner === this.you;
    const color = this.teamColor(visual.piece.owner);
    const selected = !visual.ghost && visual.index === this.selected;
    const heroFrame = !visual.ghost && this.flagVictory?.pieceId === visual.piece.id ? this.flagVictory.frame : null;
    const appearance = JSON.stringify([visual.piece.kind, visual.piece.revealed, own, color, selected, visual.ghost, heroFrame]);
    if (appearance === visual.appearance) return;
    visual.appearance = appearance;
    const artwork = heroFrame ? { frame: heroFrame } : artworkForPiece(this.skin.definition, own, visual.piece.kind, visual.piece.revealed, color);
    visual.artwork = artwork && this.textureKey && this.atlasFrames.has(artwork.frame) ? artwork : undefined;
    visual.vector.clear();
    visual.question.setVisible(false);
    if (visual.artwork) {
      if (!visual.sprite) {
        visual.sprite = this.add.sprite(0, 0, this.textureKey!, visual.artwork.frame);
        visual.container.addAt(visual.sprite, 2);
      }
      visual.sprite.setVisible(true);
      visual.shownFrame = null;
      visual.clipState = null;
    } else {
      visual.sprite?.setVisible(false);
      this.drawVector(visual, color === 'blue', selected);
    }
    visual.marker.clear();
    if (visual.piece.revealed && !this.retro) {
      visual.marker.fillStyle(this.color('shadow'), 1).fillCircle(22, -22, 4.5);
      visual.marker.fillStyle(this.color('revealed'), 1).fillCircle(22, -22, 2.3);
    }
    visual.container.bringToTop(visual.marker);
  }

  private drawVector(visual: PieceVisual, blue: boolean, selected: boolean): void {
    const g = visual.vector;
    const color = this.color(blue ? 'ownSymbol' : 'enemySymbol');
    g.fillStyle(this.color('shadow'), .32).fillRoundedRect(-29, -25, 58, 60, 9);
    g.fillStyle(this.color(blue ? 'ownBase' : 'enemyBase'), selected ? 1 : .98).fillRoundedRect(-29, -30, 58, 60, 9);
    g.lineStyle(1.3, this.color(selected ? 'accent' : blue ? 'ownEdge' : 'enemyEdge'), .88).strokeRoundedRect(-28.5, -29.5, 57, 59, 9);
    g.lineStyle(1, color, .25).lineBetween(-19, -27, 19, -27);
    g.lineStyle(2.6, color, 1);
    const line = (points: number[][]): void => {
      g.beginPath();
      points.forEach(([x, y], index) => { if (index === 0) g.moveTo(x, y); else g.lineTo(x, y); });
      g.strokePath();
    };
    switch (visual.piece.kind) {
      case 'rock':
        line([[-8, -16], [9, -14], [17, 0], [8, 15], [-11, 15], [-17, 1], [-8, -16]]);
        g.lineStyle(1.5, color, .45);
        line([[-8, -16], [-2, 1], [17, 0]]); line([[-2, 1], [-11, 15]]); line([[-2, 1], [8, 15]]);
        break;
      case 'paper':
        line([[-11, -18], [6, -18], [14, -10], [14, 17], [-11, 17], [-11, -18]]);
        line([[5, -18], [5, -9], [14, -9]]); line([[-5, -1], [8, -1]]); line([[-5, 6], [8, 6]]);
        break;
      case 'scissors':
        g.strokeCircle(-9, 11, 5.5).strokeCircle(9, 11, 5.5);
        line([[-6, 6], [12, -17]]); line([[6, 6], [-12, -17]]);
        g.fillStyle(color).fillCircle(0, -1, 2);
        break;
      case 'flag':
        // The cloth marks the opponent's target; token, pole and outline retain their owner color.
        g.fillStyle(this.color(blue ? 'enemyEdge' : 'ownEdge'), 1);
        g.beginPath().moveTo(-10, -18).lineTo(15, -18).lineTo(8, -9).lineTo(15, -1).lineTo(-10, -1).closePath().fillPath();
        line([[-10, 18], [-10, -18], [15, -18], [8, -9], [15, -1], [-10, -1]]);
        line([[-16, 18], [-4, 18]]);
        break;
      case 'trap':
        g.strokeCircle(0, 0, 6);
        line([[-15, -18], [-15, -7], [-4, -7]]); line([[15, -18], [15, -7], [4, -7]]);
        line([[-15, 18], [-15, 7], [-4, 7]]); line([[15, 18], [15, 7], [4, 7]]);
        line([[-15, -15], [-4, -4]]); line([[15, -15], [4, -4]]);
        line([[-15, 15], [-4, 4]]); line([[15, 15], [4, 4]]);
        break;
      default:
        g.lineStyle(1.3, color, .34);
        line([[0, -19], [17, -12], [15, 5], [0, 19], [-15, 5], [-17, -12], [0, -19]]);
        visual.question.setColor(blue ? this.palette.ownSymbol : this.palette.enemySymbol).setVisible(true);
    }
  }

  private normalState(visual: PieceVisual): SkinAnimationState {
    if (visual.effectState) return visual.effectState;
    const duel = this.view?.duel;
    if (duel && (visual.index === duel.from || visual.index === duel.to)) return 'duel';
    if (!visual.ghost && visual.index === this.selected) return 'selected';
    return 'idle';
  }

  private animateArtwork(visual: PieceVisual, delta: number): void {
    if (!visual.artwork || !visual.sprite) return;
    const state = this.normalState(visual);
    if (visual.clipState !== state) {
      visual.clipState = state;
      visual.clipElapsed = 0;
    } else visual.clipElapsed += delta;
    const elapsed = visual.effectState ? visual.effectElapsed : visual.clipElapsed;
    const frame = artworkFrame(visual.artwork, state, elapsed, this.animationsEnabled && (!this.mobile || !!this.effect || !!this.celebration));
    if (frame === visual.shownFrame || !this.atlasFrames.has(frame)) return;
    visual.sprite.setTexture(this.textureKey!, frame);
    const source = visual.sprite.frame;
    const size = this.retro ? 76 : 64;
    visual.sprite.setScale(Math.min(size / source.width, size / source.height));
    visual.shownFrame = frame;
  }

  private isEffectPiece(id: string): boolean {
    const action = this.effect?.action;
    return !!action && (action.attacker.id === id || action.defender?.id === id);
  }

  private snapVisual(visual: PieceVisual): void {
    const position = this.position(visual.index);
    visual.container.setPosition(position.x, position.y).setScale(1).setAlpha(1);
    visual.glow.clear();
    visual.effectState = null;
    visual.effectElapsed = 0;
  }

  private snapVisuals(): void {
    for (const visual of this.visuals.values()) if (!this.isEffectPiece(visual.piece.id)) this.snapVisual(visual);
  }

  private finishCelebration(): void {
    const celebration = this.celebration;
    if (!celebration) return;
    this.celebration = null;
    for (const id of celebration.pieceIds) {
      const visual = this.visuals.get(id);
      if (visual && !visual.ghost && !this.isEffectPiece(id)) {
        this.snapVisual(visual);
        this.animateArtwork(visual, 0);
      }
    }
  }

  private applyCelebration(): void {
    const celebration = this.celebration;
    if (!celebration) return;
    const duration = celebration.heroId ? FLAG_CELEBRATION_MS : CELEBRATION_MS;
    if (celebration.elapsed >= duration) { this.finishCelebration(); return; }
    celebration.pieceIds.forEach((id, ordinal) => {
      const visual = this.visuals.get(id);
      if (!visual || visual.ghost || visual.piece.owner !== celebration.ownerId || this.board[visual.index]?.id !== id) return;
      const position = this.position(visual.index);
      const offset = celebration.heroId ? flagCelebrationOffset(celebration.elapsed, id === celebration.heroId) :
        celebrationOffset(celebration.elapsed, ordinal);
      visual.container.setPosition(position.x, position.y + offset).setScale(1).setAlpha(1);
      this.override(visual, 'win', celebration.elapsed);
    });
  }

  private finishEffect(): void {
    if (!this.effect) return;
    this.effect = null;
    for (const [id, visual] of this.visuals) {
      if (visual.ghost) {
        visual.container.destroy();
        this.visuals.delete(id);
      } else {
        this.snapVisual(visual);
        this.animateArtwork(visual, 0);
      }
    }
  }

  private startEffect(action: GameActionView): void {
    this.finishCelebration();
    if (!this.ready || !this.animationsEnabled) return;
    if (action.kind === 'move' && this.skin.definition.motion.moveMs <= 0) return;
    // Removed figures come only from the server's explicitly public battle event.
    for (const [piece, index] of [[action.attacker, action.from], [action.defender, action.to]] as const) {
      if (!piece || this.visuals.has(piece.id)) continue;
      if (action.kind !== 'move' && piece.kind !== null && piece.revealed && action.removedIds.includes(piece.id)) {
        this.createVisual(piece, index, true);
      }
    }
    const attacker = this.visuals.get(action.attacker.id);
    const defender = action.defender ? this.visuals.get(action.defender.id) : undefined;
    if (!attacker || (action.kind !== 'move' && !defender)) {
      for (const [id, visual] of this.visuals) if (visual.ghost) { visual.container.destroy(); this.visuals.delete(id); }
      return;
    }
    const battleMs = this.skin.definition.motion.battleMs;
    const participants = [attacker, defender].filter((visual): visual is PieceVisual => !!visual);
    const attackMs = Math.max(battleMs * .4, clipDuration(attacker.artwork, 'attack'),
      action.kind === 'duel' ? clipDuration(defender?.artwork, 'attack') : 0);
    const resultMs = Math.max(battleMs * .6, ...participants.map((visual) =>
      action.winnerId === visual.piece.id ? clipDuration(visual.artwork, 'win') :
        action.removedIds.includes(visual.piece.id) ? clipDuration(visual.artwork, 'lose') : 0));
    this.effect = {
      action, elapsed: 0, moveMs: Math.max(1, this.skin.definition.motion.moveMs),
      attackMs: Math.max(1, attackMs), resultMs: Math.max(1, resultMs),
    };
    this.pieces.bringToTop(attacker.container);
    this.applyEffect();
    for (const visual of participants) this.animateArtwork(visual, 0);
  }

  private override(visual: PieceVisual | undefined, state: SkinAnimationState, elapsed: number): void {
    if (!visual) return;
    visual.effectState = state;
    visual.effectElapsed = Math.max(0, elapsed);
  }

  private applyEffect(): void {
    const effect = this.effect;
    if (!effect) return;
    const { action, elapsed } = effect;
    const attacker = this.visuals.get(action.attacker.id);
    const defender = action.defender ? this.visuals.get(action.defender.id) : undefined;
    if (!attacker) { this.finishEffect(); return; }
    const from = this.position(action.from);
    const to = this.position(action.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (action.kind === 'move') {
      if (elapsed >= effect.moveMs) { this.finishEffect(); return; }
      const progress = smoothStep(elapsed / effect.moveMs);
      attacker.container.setPosition(from.x + dx * progress, from.y + dy * progress - Math.sin(progress * Math.PI) * 5);
      this.override(attacker, 'move', elapsed);
      return;
    }
    if (elapsed >= effect.attackMs + effect.resultMs) { this.finishEffect(); return; }
    if (defender) defender.container.setPosition(to.x, to.y).setScale(1).setAlpha(1);
    const undecided = action.outcome === 'duel' || action.outcome === 'tie';
    if (elapsed < effect.attackMs) {
      const progress = smoothStep(elapsed / effect.attackMs);
      const travel = undecided ? Math.sin(progress * Math.PI) * .42 : progress * .68;
      attacker.container.setPosition(from.x + dx * travel, from.y + dy * travel - Math.sin(progress * Math.PI) * 14).setScale(1).setAlpha(1);
      this.override(attacker, 'attack', elapsed);
      if (defender && action.kind === 'duel') this.override(defender, 'attack', elapsed);
      return;
    }
    const resultElapsed = elapsed - effect.attackMs;
    const progress = Math.min(1, resultElapsed / effect.resultMs);
    if (undecided) {
      attacker.container.setPosition(from.x, from.y);
      this.override(attacker, 'duel', resultElapsed);
      this.override(defender, 'duel', resultElapsed);
      return;
    }
    const attackerWins = action.winnerId === action.attacker.id;
    const landing = .68 + .32 * smoothStep(Math.min(1, progress * 2.6));
    attacker.container.setPosition(from.x + dx * (attackerWins ? landing : .68),
      from.y + dy * (attackerWins ? landing : .68));
    for (const visual of [attacker, defender]) {
      if (!visual) continue;
      if (action.removedIds.includes(visual.piece.id)) {
        const fade = smoothStep(Math.max(0, (progress - .10) / .9));
        visual.container.setAlpha(1 - fade).setScale(1 - fade * .18);
        this.override(visual, 'lose', resultElapsed);
      } else if (action.winnerId === visual.piece.id) {
        const pulse = Math.sin(progress * Math.PI * 2) ** 2;
        visual.container.setScale(1 + .10 * pulse).setAlpha(1);
        visual.glow.clear().lineStyle(2, this.color('accent'), .7 * pulse)
          .strokeRoundedRect(-33, -34, 66, 68, 11);
        this.override(visual, 'win', resultElapsed);
      }
    }
  }
}

export class ArenaBoard {
  private game: Phaser.Game;
  private scene: ArenaScene;
  private handleKeyboard: (event: KeyboardEvent) => void;
  private handleBlur: () => void;
  private wake = () => this.scene.requestRender();
  private resizeObserver?: ResizeObserver;

  constructor(private container: HTMLElement, callbacks: BoardCallbacks) {
    const pixelRatio = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
    // Quarter steps keep both canvas dimensions integral, including common
    // 125/150/175% desktop scaling. Cap the buffer at 1360 x 1232 pixels.
    const mobile = mobileGraphics();
    const bounds = container.getBoundingClientRect();
    const renderScale = mobile ? mobileRenderScale(bounds.width, bounds.height, pixelRatio) :
      Math.min(MAX_RENDER_SCALE, Math.max(1, Math.ceil(pixelRatio * 4) / 4));
    this.scene = new ArenaScene(callbacks, renderScale, mobile);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: Math.round(WIDTH * renderScale),
      height: Math.round(HEIGHT * renderScale),
      ...(mobile ? { fps: { target: 30, limit: 30 } } : {}),
      parent: container,
      transparent: true,
      antialias: true,
      banner: false,
      disableContextMenu: true,
      audio: { noAudio: true },
      input: { keyboard: false, touch: { capture: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [this.scene],
      render: { antialias: true, pixelArt: false, roundPixels: false },
    });
    this.handleKeyboard = (event) => this.scene.handleKey(event);
    this.handleBlur = () => this.scene.onBlur();
    container.addEventListener('keydown', this.handleKeyboard);
    container.addEventListener('blur', this.handleBlur);
    container.addEventListener('touchcancel', this.handleBlur, { passive: true });
    {
      // Phaser processes native input in its next step, so wake before it queues events.
      for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'keydown']) {
        container.addEventListener(event, this.wake, { capture: true, passive: true });
      }
      document.addEventListener('visibilitychange', this.wake);
      if (mobile) this.resizeObserver = new ResizeObserver(() => {
        const size = container.getBoundingClientRect();
        const scale = mobileRenderScale(size.width, size.height, window.devicePixelRatio);
        this.scene.resizeRender(scale);
      });
      this.resizeObserver?.observe(container);
    }
  }

  update(view: GameView | null, selected: number | null, enabled = true): void {
    this.scene.setView(view, selected, enabled);
  }

  setSkin(skin: LoadedSkin): void {
    this.scene.setSkin(skin);
  }

  whenReady(): Promise<void> {
    return this.scene.whenReady;
  }

  setAnimationsEnabled(enabled: boolean): void {
    this.scene.setAnimationsEnabled(enabled);
  }

  celebrate(ownerId: string): void {
    this.scene.celebrate(ownerId);
  }

  destroy(): void {
    this.container.removeEventListener('keydown', this.handleKeyboard);
    this.container.removeEventListener('blur', this.handleBlur);
    this.container.removeEventListener('touchcancel', this.handleBlur);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.wake);
    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'keydown']) {
      this.container.removeEventListener(event, this.wake, true);
    }
    this.game.destroy(true);
  }
}
