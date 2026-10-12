import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameActionView, GameView, PieceView } from '../shared/game';
import {
  artworkForPiece, artworkFrame, canContinueEffect, captureMotionFrame, CELEBRATION_MS,
  celebrationOffset, clipDuration, freshAction, freshActionFromFrame, sameMotionFrame,
} from './board-motion';
import type { PieceArtwork } from './skin-types';
import { DEFAULT_SKIN } from './skins';

function fixture(): GameView & { roomId: string } {
  const board: (PieceView | null)[] = Array.from({ length: 42 }, () => null);
  board[21] = { id: 'a', owner: 'me', kind: 'rock', revealed: false };
  board[14] = { id: 'b', owner: 'peer', kind: null, revealed: false };
  return {
    roomId: 'private01', revision: 10, phase: 'playing', you: 'me',
    players: [
      { id: 'me', name: 'Ich', seat: 0, connected: true, ready: true, restartRequested: false, newSeriesRequested: false },
      { id: 'peer', name: 'Du', seat: 1, connected: true, ready: true, restartRequested: false, newSeriesRequested: false },
    ],
    series: {
      id: 'series-1', number: 1, mode: 'free', matchId: 'match-1', gameNumber: 1,
      completedGames: 0, draws: 0, winsByPlayer: { me: 0, peer: 0 }, targetWins: null,
      winner: null, startingSeat: 0, startingPlayer: 'me',
    },
    board, currentTurn: 'me', turnNumber: 0, paused: false, winner: null,
    finishReason: null, duel: null, lastAction: null, legalMoves: { 21: [14, 22, 28] }, log: [],
  };
}

function battle(previous = fixture()): GameView & { roomId: string } {
  const next = structuredClone(previous);
  const attacker: PieceView = { ...previous.board[21]!, revealed: true };
  const defender: PieceView = { ...previous.board[14]!, kind: 'scissors', revealed: true };
  const action: GameActionView = {
    id: previous.revision + 1, kind: 'battle', turnNumber: 1, from: 21, to: 14,
    attacker, defender, outcome: 'attacker', winnerId: attacker.id,
    removedIds: [defender.id], duelRound: null,
  };
  next.revision = action.id;
  next.lastAction = action;
  next.board[21] = null;
  next.board[14] = attacker;
  next.currentTurn = 'peer';
  next.legalMoves = {};
  return next;
}

test('a direct public battle animates once; repeated render/sync never replays it', () => {
  const previous = fixture();
  const next = battle(previous);
  assert.equal(freshAction(previous, next), next.lastAction);
  assert.equal(freshAction(next, next), null);
  const sync = structuredClone(next);
  assert.equal(freshAction(next, sync), null);
  assert.equal(sameMotionFrame(captureMotionFrame(next), captureMotionFrame(sync)), true);
  assert.equal(canContinueEffect(captureMotionFrame(next), captureMotionFrame(sync)), true);
});

test('joining, reconnect gaps, paused states, changed room and new game do not replay', () => {
  const previous = fixture();
  const next = battle(previous);
  assert.equal(freshAction(null, next), null);
  assert.equal(freshAction(previous, null), null);
  for (const mutate of [
    (view: typeof next) => { view.revision += 1; view.lastAction!.id = view.revision; },
    (view: typeof next) => { view.paused = true; },
    (view: typeof next) => { view.players[1].connected = false; },
    (view: typeof next) => { view.roomId = 'different'; },
    (view: typeof next) => { view.you = 'peer'; },
    (view: typeof next) => { view.players[1].id = 'replacement'; },
    (view: typeof next) => { view.phase = 'setup'; view.lastAction = null; },
  ]) {
    const changed = structuredClone(next);
    mutate(changed);
    assert.equal(freshAction(previous, changed), null);
  }
  const pausedBefore = structuredClone(previous);
  pausedBefore.paused = true;
  assert.equal(freshAction(pausedBefore, next), null);
});

test('the final flag capture is animated even though its snapshot is finished', () => {
  const previous = fixture();
  const next = battle(previous);
  next.phase = 'finished';
  next.finishReason = 'flag';
  next.winner = 'me';
  next.currentTurn = null;
  next.lastAction!.outcome = 'flag';
  next.lastAction!.defender!.kind = 'flag';
  assert.equal(freshAction(previous, next), next.lastAction);
  assert.equal(freshAction(next, next), null);
});

test('the first private duel choice continues the visible effect; resolution gets its own event', () => {
  const previous = fixture();
  const contact = battle(previous);
  contact.phase = 'duel';
  contact.board[21] = contact.lastAction!.attacker;
  contact.board[14] = { ...contact.lastAction!.defender!, kind: 'rock' };
  contact.lastAction!.outcome = 'duel';
  contact.lastAction!.winnerId = null;
  contact.lastAction!.removedIds = [];
  contact.duel = {
    id: 'duel-1', attacker: 'me', defender: 'peer', from: 21, to: 14, round: 1,
    choiceLocked: { me: false, peer: false }, yourChoice: null,
  };
  const firstChoice = structuredClone(contact);
  firstChoice.revision++;
  firstChoice.duel!.choiceLocked.me = true;
  firstChoice.duel!.yourChoice = 'paper';
  assert.equal(freshAction(contact, firstChoice), null);
  assert.equal(canContinueEffect(captureMotionFrame(contact), captureMotionFrame(firstChoice)), true);
  const resolved = battle(firstChoice);
  resolved.phase = 'playing';
  resolved.duel = null;
  resolved.lastAction!.kind = 'duel';
  resolved.lastAction!.duelRound = 1;
  resolved.lastAction!.attacker.kind = 'paper';
  assert.equal(freshAction(firstChoice, resolved), resolved.lastAction);
  assert.equal(canContinueEffect(captureMotionFrame(firstChoice), captureMotionFrame(resolved)), false);
});

test('unknown movers remain unknown; battle ghosts require explicit public kinds', () => {
  const previous = fixture();
  previous.board[14] = null;
  previous.board[21] = { id: 'hidden', owner: 'peer', kind: null, revealed: false };
  const next = structuredClone(previous);
  next.revision++;
  next.board[14] = next.board[21];
  next.board[21] = null;
  next.lastAction = {
    id: next.revision, kind: 'move', turnNumber: 1, from: 21, to: 14,
    attacker: next.board[14]!, defender: null, outcome: 'move',
    winnerId: null, removedIds: [], duelRound: null,
  };
  assert.equal(freshAction(previous, next)?.attacker.kind, null);
  for (const change of [
    (view: GameView) => { view.lastAction!.attacker.kind = null; },
    (view: GameView) => { view.lastAction!.defender!.kind = null; },
    (view: GameView) => { view.lastAction!.attacker.revealed = false; },
    (view: GameView) => { view.lastAction!.defender!.revealed = false; },
  ]) {
    const before = fixture();
    const after = battle(before);
    change(after);
    assert.equal(freshAction(before, after), null);
  }
});

test('nonadjacent or mismatched piece transitions cannot fabricate an effect', () => {
  for (const change of [
    (view: GameView) => { view.lastAction!.from = 20; },
    (view: GameView) => { view.lastAction!.to = 7; },
    (view: GameView) => { view.lastAction!.attacker.id = 'another'; },
    (view: GameView) => { view.lastAction!.defender!.owner = 'me'; },
    (view: GameView) => { view.lastAction!.id--; },
  ]) {
    const previous = fixture();
    const next = battle(previous);
    change(next);
    assert.equal(freshAction(previous, next), null);
  }
});

test('captured motion identity survives caller mutation without retaining hidden kinds', () => {
  const previous = fixture();
  const captured = captureMotionFrame(previous);
  const next = battle(previous);
  previous.board[21] = null;
  previous.revision = 11;
  assert.equal(freshActionFromFrame(captured, next), next.lastAction);
  assert.equal(Object.hasOwn(captured!.cells[21]!, 'kind'), false);
});

test('a new action, disconnect, phase reset or revision gap ends an existing effect', () => {
  const after = battle();
  const frame = captureMotionFrame(after);
  for (const change of [
    (view: typeof after) => { view.lastAction!.id++; },
    (view: typeof after) => { view.players[1].connected = false; },
    (view: typeof after) => { view.paused = true; },
    (view: typeof after) => { view.phase = 'setup'; },
    (view: typeof after) => { view.revision += 2; },
    (view: typeof after) => { view.board[15] = view.board[14]; view.board[14] = null; },
  ]) {
    const changed = structuredClone(after);
    change(changed);
    assert.equal(canContinueEffect(frame, captureMotionFrame(changed)), false);
  }
});

test('artwork selection never substitutes a known figure or the other team for unknown', () => {
  const ownRock = { frame: 'own-rock' };
  const enemyRock = { frame: 'enemy-rock' };
  const unknown = { frame: 'enemy-unknown' };
  const skin = {
    ...DEFAULT_SKIN,
    pieces: { own: { rock: ownRock }, enemy: { rock: enemyRock, unknown } },
  };
  assert.equal(artworkForPiece(skin, true, 'rock'), ownRock);
  assert.equal(artworkForPiece(skin, false, 'rock'), enemyRock);
  assert.equal(artworkForPiece(skin, false, null), unknown);
  assert.equal(artworkForPiece(skin, true, null), undefined);
  assert.equal(artworkForPiece({ ...skin, pieces: { enemy: { rock: enemyRock } } }, false, null), undefined);
});

test('colored artwork varies its viewing direction without exchanging the owner color', () => {
  const blueBack = { frame: 'blue-back-rock', revealed: { frame: 'blue-back-rock-revealed' } };
  const blueFront = { frame: 'blue-front-rock' };
  const redBack = { frame: 'red-back-rock', revealed: { frame: 'red-back-rock-revealed' } };
  const redFront = { frame: 'red-front-rock' };
  const skin = {
    ...DEFAULT_SKIN,
    teamPieces: {
      blue: { own: { rock: blueBack }, enemy: { rock: blueFront } },
      red: { own: { rock: redBack }, enemy: { rock: redFront } },
    },
  };
  // The blue browser sees its blue rear pose and the opposing red front pose.
  assert.equal(artworkForPiece(skin, true, 'rock', false, 'blue'), blueBack);
  assert.equal(artworkForPiece(skin, false, 'rock', false, 'red'), redFront);
  // Rotating for the red browser changes perspective only.
  assert.equal(artworkForPiece(skin, true, 'rock', false, 'red'), redBack);
  assert.equal(artworkForPiece(skin, false, 'rock', false, 'blue'), blueFront);
  assert.equal(artworkForPiece(skin, true, 'rock', true, 'blue'), blueBack.revealed);
  assert.equal(artworkForPiece(skin, true, 'rock', true, 'red'), redBack.revealed);
  assert.equal(artworkForPiece(skin, false, 'rock', true, 'blue'), blueFront);
  assert.equal(artworkForPiece(skin, false, 'rock', true, 'red'), redFront);
});

test('partial colored packs fall back only to the matching absolute legacy color slot', () => {
  const blueLegacy = { frame: 'legacy-blue-rock' };
  const redLegacy = { frame: 'legacy-red-rock' };
  const blueBack = { frame: 'blue-back-rock' };
  const skin = {
    ...DEFAULT_SKIN,
    pieces: { own: { rock: blueLegacy }, enemy: { rock: redLegacy } },
    teamPieces: { blue: { own: { rock: blueBack } } },
  };
  assert.equal(artworkForPiece(skin, true, 'rock', false, 'blue'), blueBack);
  assert.equal(artworkForPiece(skin, false, 'rock', false, 'blue'), blueLegacy);
  assert.equal(artworkForPiece(skin, true, 'rock', false, 'red'), redLegacy);
  assert.equal(artworkForPiece(skin, false, 'rock', false, 'red'), redLegacy);
  const legacyOnly = { ...skin, teamPieces: undefined };
  for (const own of [true, false]) {
    assert.equal(artworkForPiece(legacyOnly, own, 'rock', false, 'blue'), blueLegacy);
    assert.equal(artworkForPiece(legacyOnly, own, 'rock', false, 'red'), redLegacy);
  }
  assert.equal(artworkForPiece({ ...skin, pieces: undefined }, true, 'rock', false, 'red'), undefined);
  assert.equal(artworkForPiece({ ...skin, pieces: undefined }, false, 'rock', false, 'blue'), undefined);
});

test('hidden colored figures only use unknown artwork and never a revealed or other-color pose', () => {
  const unknown = { frame: 'blue-front-unknown', revealed: { frame: 'must-not-be-shown' } };
  const legacyUnknown = { frame: 'legacy-red-unknown' };
  const skin = {
    ...DEFAULT_SKIN,
    pieces: { enemy: { unknown: legacyUnknown } },
    teamPieces: {
      blue: { enemy: { rock: { frame: 'blue-front-rock' }, unknown } },
      red: { own: { rock: { frame: 'red-back-rock' } } },
    },
  };
  for (const kind of [null, 'unknown'] as const) {
    for (const revealed of [true, false]) {
      assert.equal(artworkForPiece(skin, false, kind, revealed, 'blue'), unknown);
      assert.equal(artworkForPiece(skin, true, kind, revealed, 'red'), legacyUnknown);
      assert.equal(artworkForPiece(skin, true, kind, revealed, 'blue'), undefined);
      assert.equal(artworkForPiece({ ...skin, pieces: undefined }, true, kind, revealed, 'red'), undefined);
    }
  }
});

test('idle/selected/duel loop; move and battle clips play once and hold their last frame', () => {
  const artwork: PieceArtwork = {
    frame: 'base',
    animations: {
      idle: { frames: ['idle-0', 'idle-1'], fps: 10 },
      selected: { frames: ['select-0', 'select-1'], fps: 10 },
      duel: { frames: ['duel-0', 'duel-1'], fps: 10 },
      move: { frames: ['move-0', 'move-1'], fps: 10 },
      attack: { frames: ['attack-0', 'attack-1'], fps: 10 },
      win: { frames: ['win-0', 'win-1'], fps: 10 },
      lose: { frames: ['lose-0', 'lose-1'], fps: 10 },
    },
  };
  assert.equal(artworkFrame(artwork, 'idle', 250, true), 'idle-0');
  assert.equal(artworkFrame(artwork, 'selected', 250, true), 'select-0');
  assert.equal(artworkFrame(artwork, 'duel', 250, true), 'duel-0');
  for (const state of ['move', 'attack', 'win', 'lose'] as const) {
    assert.equal(artworkFrame(artwork, state, 0, true), state + '-0');
    assert.equal(artworkFrame(artwork, state, 120, true), state + '-1');
    assert.equal(artworkFrame(artwork, state, 10000, true), state + '-1');
  }
  assert.equal(clipDuration(artwork, 'attack'), 200);
});

test('reduced motion always uses the base frame; missing one-shot art stays static', () => {
  const artwork: PieceArtwork = { frame: 'base', animations: { idle: { frames: ['idle-0', 'idle-1'], fps: 8 } } };
  for (const state of ['idle', 'selected', 'move', 'duel', 'attack', 'win', 'lose'] as const) {
    assert.equal(artworkFrame(artwork, state, 400, false), 'base');
  }
  assert.equal(artworkFrame(artwork, 'attack', 400, true), 'base');
  assert.equal(artworkFrame(artwork, 'selected', 400, true), 'idle-1');
  assert.equal(clipDuration(undefined, 'win'), 0);
});

test('team celebration has exactly two bounded hops and returns to the base position', () => {
  assert.equal(celebrationOffset(0, 0), 0);
  assert.equal(celebrationOffset(170, 0), -16);
  assert.equal(celebrationOffset(340, 0), 0);
  assert.equal(celebrationOffset(510, 0), -13);
  assert.equal(celebrationOffset(680, 0), 0);
  assert.ok(CELEBRATION_MS >= 650 && CELEBRATION_MS <= 850);
  for (const time of [-1, CELEBRATION_MS, 10000, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(celebrationOffset(time, 0), 0);
  }
  for (let time = 0; time <= CELEBRATION_MS; time++) {
    const offset = celebrationOffset(time, 0);
    assert.ok(Number.isFinite(offset) && offset >= -16 && offset <= 0);
  }
});

test('a whole army staggers briefly and every piece lands within the shared duration', () => {
  assert.equal(celebrationOffset(96, 4), 0);
  assert.equal(celebrationOffset(266, 4), -16);
  assert.equal(celebrationOffset(606, 4), -13);
  for (let ordinal = 0; ordinal < 42; ordinal++) {
    assert.equal(celebrationOffset(0, ordinal), 0);
    assert.equal(celebrationOffset(CELEBRATION_MS, ordinal), 0);
    assert.equal(celebrationOffset(CELEBRATION_MS + 1000, ordinal), 0);
    assert.equal(celebrationOffset(240, ordinal), celebrationOffset(240, ordinal % 5));
  }
});
