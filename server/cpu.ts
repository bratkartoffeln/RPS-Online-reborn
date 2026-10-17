import { BOARD_COLS, type FighterKind, type GameView, type PieceKind } from '../shared/game.js';
import type { CpuDifficulty } from '../shared/cpu.js';

const fighters: FighterKind[] = ['rock', 'paper', 'scissors'];
const counter: Record<FighterKind, FighterKind> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
const profiles = {
  easy: { mistake: .55, noise: 5, memory: 0, predict: 0 },
  medium: { mistake: .22, noise: 2.5, memory: 5, predict: .35 },
  hard: { mistake: .08, noise: 1, memory: Infinity, predict: .7 },
};
const distance = (a: number, b: number) => Math.abs(a % BOARD_COLS - b % BOARD_COLS) + Math.abs(Math.floor(a / BOARD_COLS) - Math.floor(b / BOARD_COLS));
const isFighter = (kind: PieceKind | null | undefined): kind is FighterKind => fighters.includes(kind as FighterKind);

/** Receives only the CPU's masked view, never the authoritative state or secret choices. */
export class CpuBrain {
  private match = '';
  private actionId = -1;
  private traps = new Map<string, number>();
  private visits = new Map<string, number>();
  private duelHistory: FighterKind[] = [];

  constructor(readonly difficulty: CpuDifficulty, private random: () => number = Math.random) {}

  observe(view: GameView): void {
    if (this.match !== view.series.matchId) {
      this.match = view.series.matchId;
      this.actionId = -1;
      this.traps.clear();
      this.visits.clear();
      this.duelHistory = [];
    }
    const action = view.lastAction;
    if (!action || action.id === this.actionId) return;
    this.actionId = action.id;
    if (action.outcome === 'trap' && action.defender?.owner !== view.you && action.defender) {
      this.traps.set(action.defender.id, view.turnNumber);
    }
    if (action.attacker.owner === view.you && (action.outcome === 'move' || action.outcome === 'attacker')) {
      const key = `${action.attacker.id}:${action.to}`;
      this.visits.set(key, (this.visits.get(key) ?? 0) + 1);
    }
    if (action.kind === 'duel' && action.outcome !== 'duel') {
      const enemy = action.attacker.owner === view.you ? action.defender : action.attacker;
      if (enemy && isFighter(enemy.kind)) this.duelHistory.push(enemy.kind);
      this.duelHistory = this.duelHistory.slice(-12);
    }
  }

  delay(phase: GameView['phase']): number {
    // Occasional longer hesitation, with time for the gong and combat presentation.
    return (phase === 'setup' ? 1400 : phase === 'duel' ? 1800 : 3200) +
      this.random() * 1400 + (this.random() < .15 ? 1300 : 0);
  }

  chooseDuel(): FighterKind {
    const profile = profiles[this.difficulty];
    if (this.duelHistory.length >= 2 && this.random() < profile.predict) {
      const counts = fighters.map(kind => this.duelHistory.filter(entry => entry === kind).length);
      const likely = fighters[counts.indexOf(Math.max(...counts))]!;
      return counter[likely];
    }
    return fighters[Math.floor(this.random() * fighters.length)]!;
  }

  chooseMove(view: GameView): { from: number; to: number } | null {
    this.observe(view);
    const profile = profiles[this.difficulty];
    // Mistakes may be tactical, but can never turn a flag or trap into a mover.
    const moves = Object.entries(view.legalMoves).flatMap(([source, targets]) => {
      const from = Number(source);
      const piece = view.board[from];
      return piece?.owner === view.you && isFighter(piece.kind)
        ? targets.map(to => ({ from, to })) : [];
    });
    if (!moves.length) return null;
    if (this.random() < profile.mistake) return moves[Math.floor(this.random() * moves.length)]!;
    const enemies = view.board.flatMap((piece, cell) => piece && piece.owner !== view.you ? [cell] : []);
    const flag = view.board.findIndex(piece => piece?.owner === view.you && piece.kind === 'flag');
    const knownKind = (cell: number) => {
      const piece = view.board[cell];
      if (!piece) return null;
      const seen = this.traps.get(piece.id);
      return seen !== undefined && view.turnNumber - seen < profile.memory ? 'trap' : piece.kind;
    };
    const score = ({ from, to }: { from: number; to: number }) => {
      const kind = view.board[from]!.kind as FighterKind;
      const target = view.board[to];
      const targetKind = knownKind(to);
      let value = this.random() * profile.noise - (this.visits.get(`${view.board[from]!.id}:${to}`) ?? 0) * 2;
      if (target && target.owner !== view.you) {
        value += targetKind === 'flag' ? 100 : targetKind === 'trap' ? -24 :
          targetKind === null ? 3 : targetKind === kind ? 1 : counter[targetKind as FighterKind] === kind ? 13 : -15;
      }
      const nearest = (cell: number) => Math.min(...enemies.map(enemy => distance(cell, enemy)), 20);
      value += (nearest(from) - nearest(to)) * 1.8;
      if (this.difficulty !== 'easy') {
        // Account for the opponent's immediate reply using only revealed information.
        for (const enemy of enemies) {
          if (enemy === to || distance(enemy, to) !== 1) continue;
          const enemyKind = knownKind(enemy);
          if (isFighter(enemyKind) && counter[kind] === enemyKind) value -= 11;
          if (this.difficulty === 'hard' && flag >= 0 && distance(enemy, flag) <= 2 && distance(to, flag) < distance(from, flag)) value += 4;
        }
        if (targetKind === 'flag') value += 100;
      }
      return value;
    };
    return moves.map(move => ({ move, score: score(move) })).sort((a, b) => b.score - a.score)[0]!.move;
  }
}
