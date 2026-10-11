/**
 * Authoritative rules for the provisional RPS Remake v0.1.
 *
 * Assumptions are intentionally explicit: 7 x 6 cells; each army has four of
 * each fighter, one flag, and one immobile trap. Seat 0 starts at the bottom.
 * A trap kills its attacker and remains on the board. Equal fighters start a
 * secret-choice duel; a tied choice repeats the duel and both shown fighters
 * take that choice's type. The winner keeps its final chosen type. There is no
 * promotion, diagonal movement, move repetition rule, or setup time limit.
 * No legal move is a loss; 300 completed turns is a draw. Disconnection pauses
 * moves and duels rather than changing the result of a match.
 *
 * Only viewFor() may cross the network boundary. Never serialize GameState.
 * Every DTO below is built explicitly so hidden kinds and private duel choices
 * cannot leak through a spread of the authoritative state.
 */

export const BOARD_COLS = 7;
export const BOARD_ROWS = 6;
export const BOARD_SIZE = BOARD_COLS * BOARD_ROWS;
export const MAX_TURNS = 300;
const LOG_LIMIT = 20;

export type FighterKind = 'rock' | 'paper' | 'scissors';
export type PieceKind = FighterKind | 'flag' | 'trap';
export type GamePhase = 'waiting' | 'setup' | 'playing' | 'duel' | 'finished';
export type FinishReason = 'flag' | 'no_moves' | 'resign' | 'turn_limit';
export type ActionResult = { ok: true } | { ok: false; error: string };

export interface PlayerView {
  id: string;
  name: string;
  seat: 0 | 1;
  connected: boolean;
  ready: boolean;
  restartRequested: boolean;
}

export interface Piece {
  id: string;
  owner: string;
  kind: PieceKind;
  revealed: boolean;
}

export interface PieceView {
  id: string;
  owner: string;
  /** Null means an unrevealed enemy piece, including its flag and trap. */
  kind: PieceKind | null;
  /** Whether the piece is publicly known, including after it moves again. */
  revealed: boolean;
}

export interface Duel {
  id: string;
  /** Attacker and defender are player IDs, not piece IDs. */
  attacker: string;
  defender: string;
  from: number;
  to: number;
  round: number;
  choices: Partial<Record<string, FighterKind>>;
}

export interface DuelView {
  id: string;
  attacker: string;
  defender: string;
  from: number;
  to: number;
  round: number;
  choiceLocked: Record<string, boolean>;
  /** A player can recover their own locked choice after reconnecting. */
  yourChoice: FighterKind | null;
}

export interface GameState {
  revision: number;
  phase: GamePhase;
  players: PlayerView[];
  board: Array<Piece | null>;
  currentTurn: string | null;
  /** Completed turns; starts at zero, incremented after a resolved move. */
  turnNumber: number;
  winner: string | null;
  finishReason: FinishReason | null;
  duel: Duel | null;
  log: string[];
}

export interface GameView {
  revision: number;
  phase: GamePhase;
  you: string;
  players: PlayerView[];
  board: Array<PieceView | null>;
  currentTurn: string | null;
  turnNumber: number;
  paused: boolean;
  winner: string | null;
  finishReason: FinishReason | null;
  duel: DuelView | null;
  /** Indexed by the source cell; only the viewing player's active moves. */
  legalMoves: Record<number, number[]>;
  log: string[];
}

export interface GameOptions {
  /** For deterministic rule tests. Production defaults to Math.random. */
  random?: () => number;
  /** Must return unique, type-independent IDs. Defaults to randomUUID. */
  idGenerator?: () => string;
}

type Generators = Required<GameOptions>;
const gameGenerators = new WeakMap<GameState, Generators>();
const labels: Record<PieceKind, string> = {
  rock: 'Stein',
  paper: 'Papier',
  scissors: 'Schere',
  flag: 'Fahne',
  trap: 'Falle',
};

function generators(game: GameState): Generators {
  return gameGenerators.get(game) ?? {
    random: Math.random,
    idGenerator: () => globalThis.crypto.randomUUID(),
  };
}

function ok(game: GameState): ActionResult {
  game.revision += 1;
  return { ok: true };
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function log(game: GameState, entry: string): void {
  game.log.push(entry);
  if (game.log.length > LOG_LIMIT) game.log.splice(0, game.log.length - LOG_LIMIT);
}

function playerFor(game: GameState, id: string): PlayerView | undefined {
  return game.players.find((player) => player.id === id);
}

function otherPlayer(game: GameState, id: string): PlayerView | undefined {
  return game.players.find((player) => player.id !== id);
}

function isFighter(kind: unknown): kind is FighterKind {
  return kind === 'rock' || kind === 'paper' || kind === 'scissors';
}

function validIndex(index: unknown): index is number {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < BOARD_SIZE;
}

function adjacent(from: number, to: number): boolean {
  const columnDistance = Math.abs((from % BOARD_COLS) - (to % BOARD_COLS));
  const rowDistance = Math.abs(Math.floor(from / BOARD_COLS) - Math.floor(to / BOARD_COLS));
  return columnDistance + rowDistance === 1;
}

function cellName(index: number): string {
  return `${String.fromCharCode(65 + (index % BOARD_COLS))}${BOARD_ROWS - Math.floor(index / BOARD_COLS)}`;
}

function paused(game: GameState): boolean {
  return (game.phase === 'playing' || game.phase === 'duel') &&
    (game.players.length !== 2 || game.players.some((player) => !player.connected));
}

function homeCells(seat: 0 | 1): number[] {
  return Array.from({ length: BOARD_COLS * 2 }, (_, offset) =>
    offset + (seat === 0 ? BOARD_COLS * (BOARD_ROWS - 2) : 0));
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const chosen = Math.floor(random() * (index + 1));
    [output[index], output[chosen]] = [output[chosen]!, output[index]!];
  }
  return output;
}

function placeArmy(game: GameState, player: PlayerView): void {
  const kinds: PieceKind[] = [
    'rock', 'rock', 'rock', 'rock',
    'paper', 'paper', 'paper', 'paper',
    'scissors', 'scissors', 'scissors', 'scissors', 'flag', 'trap',
  ];
  const source = generators(game);
  const army = shuffled(kinds, source.random);
  homeCells(player.seat).forEach((cell, index) => {
    game.board[cell] = {
      id: source.idGenerator(), owner: player.id, kind: army[index]!, revealed: false,
    };
  });
}

function legalMovesFor(game: GameState, id: string): Record<number, number[]> {
  const result: Record<number, number[]> = {};
  game.board.forEach((piece, from) => {
    if (!piece || piece.owner !== id || !isFighter(piece.kind)) return;
    const possible = [from - BOARD_COLS, from + BOARD_COLS, from - 1, from + 1];
    const legal = possible.filter((to) => validIndex(to) && adjacent(from, to) && game.board[to]?.owner !== id);
    if (legal.length) result[from] = legal;
  });
  return result;
}

function hasLegalMove(game: GameState, id: string): boolean {
  return Object.keys(legalMovesFor(game, id)).length > 0;
}

/** 1: first wins; -1: second wins; 0: equal. */
function compare(first: FighterKind, second: FighterKind): -1 | 0 | 1 {
  if (first === second) return 0;
  return (first === 'rock' && second === 'scissors') ||
    (first === 'scissors' && second === 'paper') ||
    (first === 'paper' && second === 'rock') ? 1 : -1;
}

function finish(game: GameState, winner: string | null, reason: FinishReason): void {
  game.phase = 'finished';
  game.winner = winner;
  game.finishReason = reason;
  game.currentTurn = null;
  game.duel = null;
  if (winner) {
    const explanations: Record<Exclude<FinishReason, 'turn_limit'>, string> = {
      flag: 'Die gegnerische Fahne wurde erobert.',
      no_moves: 'Der Gegner hat keinen erlaubten Zug mehr.',
      resign: 'Der Gegner hat aufgegeben.',
    };
    log(game, `${playerFor(game, winner)?.name ?? 'Spieler'} gewinnt. ${reason === 'turn_limit' ? '' : explanations[reason]}`.trim());
  } else {
    log(game, `Unentschieden nach ${MAX_TURNS} abgeschlossenen Zügen.`);
  }
}

function startIfReady(game: GameState): void {
  if (game.players.length !== 2 || !game.players.every((player) => player.ready)) return;
  game.phase = 'playing';
  game.currentTurn = game.players[0]!.id;
  log(game, `Die Partie beginnt. ${game.players[0]!.name} ist am Zug.`);
  if (!hasLegalMove(game, game.currentTurn)) finish(game, game.players[1]!.id, 'no_moves');
}

function completeTurn(game: GameState, mover: string): void {
  game.turnNumber += 1;
  const next = otherPlayer(game, mover)!;
  game.phase = 'playing';
  game.duel = null;
  game.currentTurn = next.id;
  // A decisive result takes precedence over the provisional turn-limit draw.
  if (!hasLegalMove(game, next.id)) finish(game, mover, 'no_moves');
  else if (!hasLegalMove(game, mover)) finish(game, next.id, 'no_moves');
  else if (game.turnNumber >= MAX_TURNS) finish(game, null, 'turn_limit');
}

function setupPlayer(game: GameState, id: string): PlayerView | ActionResult {
  const player = playerFor(game, id);
  if (!player) return fail('Du gehörst nicht zu dieser Partie.');
  if (game.phase !== 'waiting' && game.phase !== 'setup') return fail('Die Aufstellung ist bereits abgeschlossen.');
  if (!player.connected) return fail('Deine Verbindung ist unterbrochen.');
  if (player.ready) return fail('Du hast deine Aufstellung bereits bestätigt.');
  return player;
}

export function createGame(options: GameOptions = {}): GameState {
  const game: GameState = {
    revision: 0, phase: 'waiting', players: [], board: Array(BOARD_SIZE).fill(null),
    currentTurn: null, turnNumber: 0, winner: null, finishReason: null, duel: null, log: [],
  };
  gameGenerators.set(game, {
    random: options.random ?? Math.random,
    idGenerator: options.idGenerator ?? (() => globalThis.crypto.randomUUID()),
  });
  return game;
}

export function addPlayer(game: GameState, id: string, name: string): ActionResult {
  if (typeof id !== 'string' || !id.trim() || id.length > 160) return fail('Ungültige Spieler-ID.');
  if (typeof name !== 'string') return fail('Bitte gib einen Spielernamen ein.');
  const cleanName = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleanName || Array.from(cleanName).length > 24) return fail('Der Spielername muss 1 bis 24 Zeichen lang sein.');
  if (playerFor(game, id)) return fail('Dieser Spieler ist bereits im Raum.');
  if (game.players.length >= 2) return fail('Dieser Raum ist bereits voll.');
  if (game.phase !== 'waiting') return fail('Die Partie hat bereits begonnen.');
  const player: PlayerView = {
    id, name: cleanName, seat: game.players.length as 0 | 1,
    connected: true, ready: false, restartRequested: false,
  };
  game.players.push(player);
  placeArmy(game, player);
  game.phase = game.players.length === 2 ? 'setup' : 'waiting';
  log(game, `${player.name} ist dem Raum beigetreten.`);
  return ok(game);
}

export function setConnected(game: GameState, id: string, connected: boolean): ActionResult {
  const player = playerFor(game, id);
  if (!player) return fail('Unbekannter Spieler.');
  if (typeof connected !== 'boolean') return fail('Ungültiger Verbindungsstatus.');
  if (player.connected === connected) return { ok: true };
  player.connected = connected;
  log(game, connected ? `${player.name} ist wieder verbunden.` : `${player.name}: Verbindung unterbrochen.`);
  return ok(game);
}

export function shuffleSetup(game: GameState, id: string): ActionResult {
  const player = setupPlayer(game, id);
  if ('ok' in player) return player;
  const cells = homeCells(player.seat);
  const army = shuffled(cells.map((cell) => game.board[cell]!), generators(game).random);
  cells.forEach((cell, index) => { game.board[cell] = army[index]!; });
  return ok(game);
}

export function swapSetup(game: GameState, id: string, fromIndex: number, toIndex: number): ActionResult {
  const player = setupPlayer(game, id);
  if ('ok' in player) return player;
  if (!validIndex(fromIndex) || !validIndex(toIndex)) return fail('Ungültiges Spielfeld.');
  if (fromIndex === toIndex) return fail('Wähle zwei verschiedene Felder.');
  const home = homeCells(player.seat);
  if (!home.includes(fromIndex) || !home.includes(toIndex) ||
      game.board[fromIndex]?.owner !== id || game.board[toIndex]?.owner !== id) {
    return fail('Du kannst nur zwei eigene Figuren in deinen Startreihen tauschen.');
  }
  [game.board[fromIndex], game.board[toIndex]] = [game.board[toIndex]!, game.board[fromIndex]!];
  return ok(game);
}

export function readyPlayer(game: GameState, id: string): ActionResult {
  const player = setupPlayer(game, id);
  if ('ok' in player) return player;
  player.ready = true;
  log(game, `${player.name} ist bereit.`);
  startIfReady(game);
  return ok(game);
}

export function movePiece(game: GameState, id: string, fromIndex: number, toIndex: number): ActionResult {
  if (!playerFor(game, id)) return fail('Du gehörst nicht zu dieser Partie.');
  if (game.phase !== 'playing') return fail('Zurzeit kann keine Figur gezogen werden.');
  if (paused(game)) return fail('Die Partie wartet auf die Wiederverbindung beider Spieler.');
  if (game.currentTurn !== id) return fail('Du bist noch nicht am Zug.');
  if (!validIndex(fromIndex) || !validIndex(toIndex)) return fail('Ungültiges Spielfeld.');
  const attacker = game.board[fromIndex];
  const defender = game.board[toIndex];
  if (!attacker || attacker.owner !== id) return fail('Wähle eine eigene Figur.');
  if (!isFighter(attacker.kind)) return fail('Fahne und Falle können sich nicht bewegen.');
  if (!adjacent(fromIndex, toIndex)) return fail('Eine Figur zieht genau ein Feld waagerecht oder senkrecht.');
  if (defender?.owner === id) return fail('Auf diesem Feld steht bereits eine eigene Figur.');

  const name = playerFor(game, id)!.name;
  if (!defender) {
    game.board[toIndex] = attacker;
    game.board[fromIndex] = null;
    log(game, `${name} zieht von ${cellName(fromIndex)} nach ${cellName(toIndex)}.`);
    completeTurn(game, id);
    return ok(game);
  }

  attacker.revealed = true;
  defender.revealed = true;
  if (defender.kind === 'flag') {
    game.board[toIndex] = attacker;
    game.board[fromIndex] = null;
    game.turnNumber += 1;
    log(game, `${name} erobert die Fahne auf ${cellName(toIndex)}.`);
    finish(game, id, 'flag');
  } else if (defender.kind === 'trap') {
    game.board[fromIndex] = null;
    log(game, `${name}s ${labels[attacker.kind]} trifft auf eine Falle auf ${cellName(toIndex)} und fällt.`);
    completeTurn(game, id);
  } else {
    const result = compare(attacker.kind, defender.kind);
    if (result === 0) {
      game.phase = 'duel';
      game.duel = {
        id: generators(game).idGenerator(), attacker: id, defender: defender.owner,
        from: fromIndex, to: toIndex, round: 1, choices: Object.create(null),
      };
      log(game, `${labels[attacker.kind]} gegen ${labels[defender.kind]} auf ${cellName(toIndex)}: Beide wählen im Duell neu.`);
    } else {
      log(game, `${labels[attacker.kind]} gegen ${labels[defender.kind]} auf ${cellName(toIndex)}: ${playerFor(game, result === 1 ? id : defender.owner)!.name} gewinnt den Kampf.`);
      game.board[fromIndex] = null;
      if (result === 1) game.board[toIndex] = attacker;
      completeTurn(game, id);
    }
  }
  return ok(game);
}

export function chooseDuel(game: GameState, id: string, kind: FighterKind): ActionResult {
  if (!playerFor(game, id)) return fail('Du gehörst nicht zu dieser Partie.');
  if (game.phase !== 'duel' || !game.duel) return fail('Es läuft gerade kein Duell.');
  if (paused(game)) return fail('Die Partie wartet auf die Wiederverbindung beider Spieler.');
  if (!isFighter(kind)) return fail('Wähle Stein, Papier oder Schere.');
  const duel = game.duel;
  if (id !== duel.attacker && id !== duel.defender) return fail('Du nimmst an diesem Duell nicht teil.');
  if (duel.choices[id] !== undefined) return fail('Deine Auswahl ist für diese Duellrunde bereits festgelegt.');
  duel.choices[id] = kind;
  const attackChoice = duel.choices[duel.attacker];
  const defenseChoice = duel.choices[duel.defender];
  if (!attackChoice || !defenseChoice) return ok(game);

  const attacker = game.board[duel.from]!;
  const defender = game.board[duel.to]!;
  attacker.kind = attackChoice;
  defender.kind = defenseChoice;
  const result = compare(attackChoice, defenseChoice);
  if (result === 0) {
    log(game, `Duellrunde ${duel.round}: Beide wählen ${labels[attackChoice]}. Erneut wählen.`);
    duel.round += 1;
    duel.choices = Object.create(null);
  } else {
    const winner = result === 1 ? duel.attacker : duel.defender;
    log(game, `Duell: ${labels[attackChoice]} gegen ${labels[defenseChoice]}. ${playerFor(game, winner)!.name} gewinnt den Kampf.`);
    game.board[duel.from] = null;
    if (result === 1) game.board[duel.to] = attacker;
    completeTurn(game, duel.attacker);
  }
  return ok(game);
}

export function resign(game: GameState, id: string): ActionResult {
  if (!playerFor(game, id)) return fail('Du gehörst nicht zu dieser Partie.');
  if (game.phase === 'finished') return fail('Die Partie ist bereits beendet.');
  const opponent = otherPlayer(game, id);
  if (!opponent) return fail('Es ist noch kein Gegner im Raum.');
  finish(game, opponent.id, 'resign');
  return ok(game);
}

export function restartVote(game: GameState, id: string): ActionResult {
  const player = playerFor(game, id);
  if (!player) return fail('Du gehörst nicht zu dieser Partie.');
  if (game.phase !== 'finished') return fail('Eine Revanche ist erst nach dem Ende der Partie möglich.');
  if (!player.connected) return fail('Deine Verbindung ist unterbrochen.');
  if (player.restartRequested) return { ok: true };
  player.restartRequested = true;
  if (game.players.length === 2 && game.players.every((entry) => entry.restartRequested)) {
    game.board = Array(BOARD_SIZE).fill(null);
    game.phase = 'setup';
    game.currentTurn = null;
    game.turnNumber = 0;
    game.winner = null;
    game.finishReason = null;
    game.duel = null;
    game.log = ['Neue Partie. Stellt eure Figuren auf.'];
    game.players.forEach((entry) => {
      entry.ready = false;
      entry.restartRequested = false;
      placeArmy(game, entry);
    });
  } else {
    log(game, `${player.name} möchte eine Revanche.`);
  }
  return ok(game);
}

export function viewFor(game: GameState, id: string): GameView {
  const isParticipant = Boolean(playerFor(game, id));
  const isPaused = paused(game);
  let duelView: DuelView | null = null;
  if (game.duel) {
    const duel = game.duel;
    duelView = {
      id: duel.id, attacker: duel.attacker, defender: duel.defender,
      from: duel.from, to: duel.to, round: duel.round,
      choiceLocked: Object.fromEntries(game.players.map((player) => [player.id, duel.choices[player.id] !== undefined])),
      yourChoice: isParticipant ? duel.choices[id] ?? null : null,
    };
  }
  return {
    revision: game.revision, phase: game.phase, you: id,
    players: game.players.map((player) => ({
      id: player.id, name: player.name, seat: player.seat, connected: player.connected,
      ready: player.ready, restartRequested: player.restartRequested,
    })),
    board: game.board.map((piece) => piece ? {
      id: piece.id, owner: piece.owner,
      kind: piece.revealed || (isParticipant && piece.owner === id) ? piece.kind : null,
      revealed: piece.revealed,
    } : null),
    currentTurn: game.currentTurn, turnNumber: game.turnNumber, paused: isPaused,
    winner: game.winner, finishReason: game.finishReason, duel: duelView,
    legalMoves: isParticipant && game.phase === 'playing' && !isPaused && game.currentTurn === id ? legalMovesFor(game, id) : {},
    log: [...game.log],
  };
}
