import Phaser from 'phaser';
import type { GameView, PieceView } from '../shared/game';

const WIDTH = 680;
const HEIGHT = 616;
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
  return `${String.fromCharCode(65 + (index % COLS))}${ROWS - Math.floor(index / COLS)}`;
}

export function kindName(kind: string | null): string {
  return kind ? KIND_NAMES[kind] ?? kind : 'verdeckte Figur';
}

function previewPieces(): (PieceView | null)[] {
  const board: (PieceView | null)[] = Array.from({ length: 42 }, () => null);
  const kinds = ['rock', 'paper', 'scissors', 'rock', 'paper', 'scissors', 'rock', 'paper', 'scissors', 'flag', 'trap', 'rock', 'paper', 'scissors'] as const;
  for (let i = 0; i < 14; i++) {
    board[i] = { id: `preview-enemy-${i}`, owner: 'preview-enemy', kind: null, revealed: false };
    board[28 + i] = { id: `preview-you-${i}`, owner: 'preview-you', kind: kinds[i], revealed: false };
  }
  return board;
}

type BoardCallbacks = {
  onCell: (index: number) => void;
  onCancel: () => void;
  onFocus: (description: string) => void;
};

class ArenaScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Container;
  private ready = false;
  private view: GameView | null = null;
  private selected: number | null = null;
  private cursor = 38;
  private keyboardFocus = false;
  private enabled = true;
  private demoBoard = previewPieces();

  constructor(private callbacks: BoardCallbacks) {
    super('arena');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.labels = this.add.container();
    this.sys.game.canvas.setAttribute('aria-hidden', 'true');
    this.ready = true;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const column = Math.floor((pointer.x - LEFT) / PITCH);
      const row = Math.floor((pointer.y - TOP) / PITCH);
      if (column < 0 || column >= COLS || row < 0 || row >= ROWS) return;
      if ((pointer.x - LEFT) % PITCH > CELL || (pointer.y - TOP) % PITCH > CELL) return;
      this.keyboardFocus = false;
      this.cursor = row * COLS + column;
      if (!this.view || !this.enabled) return;
      const logicalIndex = this.toLogical(this.cursor);
      this.callbacks.onFocus(this.describe(logicalIndex));
      this.callbacks.onCell(logicalIndex);
      this.paint();
    });
    this.paint();
  }

  setView(view: GameView | null, selected: number | null, enabled: boolean): void {
    this.view = view;
    this.selected = selected;
    this.enabled = enabled;
    this.paint();
  }

  handleKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
    if (event.key in offsets) {
      event.preventDefault();
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
      this.keyboardFocus = true;
      if (this.view && this.enabled) this.callbacks.onCell(this.toLogical(this.cursor));
      this.callbacks.onFocus(this.describe(this.toLogical(this.cursor)));
      this.paint();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.callbacks.onCancel();
      this.paint();
    }
  }

  onBlur(): void {
    this.keyboardFocus = false;
    this.paint();
  }

  private get rotated(): boolean {
    return this.view?.players.find((player) => player.id === this.view?.you)?.seat === 1;
  }

  private toLogical(displayIndex: number): number {
    return this.rotated ? 41 - displayIndex : displayIndex;
  }

  private describe(index: number): string {
    const piece = (this.view?.board ?? this.demoBoard)[index];
    const you = this.view?.you ?? 'preview-you';
    let description = `${coordinate(index)}. `;
    if (!piece) description += 'Leeres Feld.';
    else description += `${piece.owner === you ? 'Deine Figur' : 'Gegnerische Figur'}: ${kindName(piece.kind)}.${piece.revealed ? ' Aufgedeckt.' : ''}`;
    if (index === this.selected) description += ' Ausgewählt.';
    if (this.selected !== null && this.view?.legalMoves[this.selected]?.includes(index)) description += piece ? ' Angriff möglich.' : ' Zug möglich.';
    return description;
  }

  private text(x: number, y: number, value: string, size: number, color: string, weight = 'normal'): void {
    const label = this.add.text(x, y, value, {
      fontFamily: '"Segoe UI", system-ui, sans-serif', fontSize: `${size}px`, color, fontStyle: weight,
    }).setOrigin(.5);
    this.labels.add(label);
  }

  private paint(): void {
    if (!this.ready) return;
    const g = this.graphics;
    g.clear();
    this.labels.removeAll(true);
    const board = this.view?.board ?? this.demoBoard;
    const you = this.view?.you ?? 'preview-you';
    const setup = !this.view || this.view.phase === 'setup' || this.view.phase === 'waiting';
    const possibleMoves = this.selected === null ? [] : this.view?.legalMoves[this.selected] ?? [];

    // Fixed logical coordinates turn with the board; both players see their army at the bottom.
    for (let column = 0; column < COLS; column++) {
      const logical = this.toLogical(column);
      const letter = String.fromCharCode(65 + (logical % COLS));
      this.text(LEFT + column * PITCH + CELL / 2, 23, letter, 11, '#82949f');
      this.text(LEFT + column * PITCH + CELL / 2, TOP + (ROWS - 1) * PITCH + CELL + 24, letter, 11, '#82949f');
    }
    for (let row = 0; row < ROWS; row++) {
      const logicalRow = Math.floor(this.toLogical(row * COLS) / COLS);
      const rowLabel = String(ROWS - logicalRow);
      this.text(25, TOP + row * PITCH + CELL / 2, rowLabel, 11, '#82949f');
      this.text(WIDTH - 25, TOP + row * PITCH + CELL / 2, rowLabel, 11, '#82949f');
    }

    for (let displayIndex = 0; displayIndex < COLS * ROWS; displayIndex++) {
      const index = this.toLogical(displayIndex);
      const col = displayIndex % COLS;
      const row = Math.floor(displayIndex / COLS);
      const x = LEFT + col * PITCH;
      const y = TOP + row * PITCH;
      const piece = board[index];
      const own = piece?.owner === you;
      const selected = this.selected === index;
      const destination = possibleMoves.includes(index);
      const inDuel = this.view?.duel && (this.view.duel.from === index || this.view.duel.to === index);
      let fill = (row + col) % 2 === 0 ? 0x29363e : 0x243138;
      if (setup && piece) fill = own ? 0x2a3c47 : 0x39332f;
      if (selected) fill = 0x42533d;

      g.fillStyle(0x0d1418, .35);
      g.fillRoundedRect(x, y + 3, CELL, CELL, 6);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y, CELL, CELL, 6);
      g.lineStyle(selected ? 2.5 : 1, selected ? 0xc5f277 : inDuel ? 0xeabc87 : 0x43515a, selected || inDuel ? .95 : .65);
      g.strokeRoundedRect(x + .5, y + .5, CELL - 1, CELL - 1, 6);

      if (!piece && !destination) {
        g.fillStyle(0x8193a0, .12);
        g.fillCircle(x + CELL / 2, y + CELL / 2, 1.7);
      }
      if (piece) this.drawPiece(x, y, piece, own, selected);
      if (destination) {
        if (piece) {
          g.lineStyle(2.5, 0xc5f277, .95);
          const corner = 10;
          const inset = 3;
          for (const [cx, cy, dx, dy] of [[x + inset, y + inset, 1, 1], [x + CELL - inset, y + inset, -1, 1], [x + inset, y + CELL - inset, 1, -1], [x + CELL - inset, y + CELL - inset, -1, -1]]) {
            g.beginPath(); g.moveTo(cx, cy + dy * corner); g.lineTo(cx, cy); g.lineTo(cx + dx * corner, cy); g.strokePath();
          }
        } else {
          g.fillStyle(0xc5f277, .22); g.fillCircle(x + CELL / 2, y + CELL / 2, 15);
          g.fillStyle(0xc5f277, .9); g.fillCircle(x + CELL / 2, y + CELL / 2, 5);
        }
      }
      if (this.keyboardFocus && this.cursor === displayIndex) {
        g.lineStyle(2, 0xffffff, .95);
        g.strokeRoundedRect(x + 4, y + 4, CELL - 8, CELL - 8, 4);
      }
    }
    this.text(WIDTH / 2, HEIGHT - 16, this.view ? 'ZWEI TEAMS. EIN ZIEL.' : 'DEIN TEAM STARTET UNTEN', 9, '#728994');
  }

  private drawPiece(x: number, y: number, piece: PieceView, own: boolean, selected: boolean): void {
    const g = this.graphics;
    const px = x + 10;
    const py = y + 8;
    const color = own ? 0xc6e3f5 : 0xf5d2ad;
    const edge = own ? 0x7099b6 : 0xb18a69;
    const base = own ? 0x385d76 : 0x775239;
    g.fillStyle(0x0a1218, .32); g.fillRoundedRect(px, py + 5, 58, 60, 9);
    g.fillStyle(base, selected ? 1 : .98); g.fillRoundedRect(px, py, 58, 60, 9);
    g.lineStyle(1.3, selected ? 0xc5f277 : edge, .88); g.strokeRoundedRect(px + .5, py + .5, 57, 59, 9);
    g.lineStyle(1, own ? 0xa5cee3 : 0xe4b489, .25); g.lineBetween(px + 10, py + 3, px + 48, py + 3);
    const cx = x + CELL / 2;
    const cy = y + CELL / 2 - 1;
    g.lineStyle(2.6, color, 1);
    const line = (points: number[][]) => {
      g.beginPath();
      for (let i = 0; i < points.length; i++) {
        const [dx, dy] = points[i];
        if (i === 0) g.moveTo(cx + dx, cy + dy); else g.lineTo(cx + dx, cy + dy);
      }
      g.strokePath();
    };
    switch (piece.kind) {
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
        g.strokeCircle(cx - 9, cy + 11, 5.5); g.strokeCircle(cx + 9, cy + 11, 5.5);
        line([[-6, 6], [12, -17]]); line([[6, 6], [-12, -17]]);
        g.fillStyle(color); g.fillCircle(cx, cy - 1, 2);
        break;
      case 'flag':
        line([[-10, 18], [-10, -18], [15, -18], [8, -9], [15, -1], [-10, -1]]);
        line([[-16, 18], [-4, 18]]);
        break;
      case 'trap':
        g.strokeCircle(cx, cy, 6);
        line([[-15, -18], [-15, -7], [-4, -7]]); line([[15, -18], [15, -7], [4, -7]]);
        line([[-15, 18], [-15, 7], [-4, 7]]); line([[15, 18], [15, 7], [4, 7]]);
        line([[-15, -15], [-4, -4]]); line([[15, -15], [4, -4]]);
        line([[-15, 15], [-4, 4]]); line([[15, 15], [4, 4]]);
        break;
      default:
        g.lineStyle(1.3, color, .34);
        line([[0, -19], [17, -12], [15, 5], [0, 19], [-15, 5], [-17, -12], [0, -19]]);
        this.text(cx, cy, '?', 30, '#f4d0a9', '600');
    }
    if (piece.revealed) {
      g.fillStyle(0x142028); g.fillCircle(px + 51, py + 8, 4.5);
      g.fillStyle(0xc5f277); g.fillCircle(px + 51, py + 8, 2.3);
    }
  }
}

export class ArenaBoard {
  private game: Phaser.Game;
  private scene: ArenaScene;
  private handleKeyboard: (event: KeyboardEvent) => void;
  private handleBlur: () => void;

  constructor(private container: HTMLElement, callbacks: BoardCallbacks) {
    this.scene = new ArenaScene(callbacks);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      width: WIDTH,
      height: HEIGHT,
      parent: container,
      transparent: true,
      antialias: true,
      banner: false,
      disableContextMenu: true,
      audio: { noAudio: true },
      input: { keyboard: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [this.scene],
      render: { antialias: true, pixelArt: false, roundPixels: false },
    });
    this.handleKeyboard = (event) => this.scene.handleKey(event);
    this.handleBlur = () => this.scene.onBlur();
    container.addEventListener('keydown', this.handleKeyboard);
    container.addEventListener('blur', this.handleBlur);
  }

  update(view: GameView | null, selected: number | null, enabled = true): void {
    this.scene.setView(view, selected, enabled);
  }

  destroy(): void {
    this.container.removeEventListener('keydown', this.handleKeyboard);
    this.container.removeEventListener('blur', this.handleBlur);
    this.game.destroy(true);
  }
}
