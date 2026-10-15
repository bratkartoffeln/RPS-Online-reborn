import type { FighterKind, GameActionView, PieceView } from '../shared/game';
import type { Snapshot } from '../shared/protocol';
import { escapeHtml as esc, icon } from './icons';
import { atlasIcon, pieceIcon, weaponIcon } from './skin-ui';
import type { LoadedSkin, TeamColor } from './skin-types';
import { teamColorForSeat, teamColorName } from './team-ui';

const WEAPONS: FighterKind[] = ['rock', 'paper', 'scissors'];
const LABELS = { rock: 'Stein', paper: 'Papier', scissors: 'Schere', trap: 'Falle', flag: 'Flagge', unknown: 'Verdeckte Figur' };
export const COMBAT_TIMING = Object.freeze({ impact: 600, shatter: 1200, winner: 1900, complete: 3000, reduced: 350 });
export type CombatStage = 'approach' | 'impact' | 'shatter' | 'winner' | 'result';
export interface CombatOptions { connected: boolean; pending: boolean }
export interface Combatant {
  id: string;
  ownerId: string;
  name: string;
  team: TeamColor;
  kind: PieceView['kind'];
  own: boolean;
  role: 'Angriff' | 'Verteidigung';
  result: 'winner' | 'loser' | 'neutral';
}
export interface CombatModel {
  identity: string;
  actionId: number;
  turn: number;
  round: number | null;
  attacker: Combatant;
  defender: Combatant;
  winnerOwnerId: string | null;
  outcome: GameActionView['outcome'];
  heading: string;
  result: string;
}
export interface DuelChoiceState {
  identity: string;
  duelId: string;
  round: number;
  team: TeamColor;
  selected: FighterKind | null;
  locked: boolean;
  disabled: boolean;
  status: string;
}
interface QueuedCombat {
  model: CombatModel;
  action: GameActionView;
}

/** One animation endpoint, with a bounded fallback for missing CSS/events. Returns an idempotent cancellation. */
export function waitForCombatAnimation(target: EventTarget | null, animationName: string, fallbackMs: number, complete: () => void): () => void {
  let listening = true;
  const cancel = (): void => {
    if (!listening) return;
    listening = false;
    clearTimeout(timer);
    target?.removeEventListener('animationend', onEnd);
  };
  const finish = (): void => {
    if (!listening) return;
    cancel();
    complete();
  };
  const onEnd = (event: Event): void => {
    if (event.target === target && (event as AnimationEvent).animationName === animationName) finish();
  };
  const timer = setTimeout(finish, fallbackMs);
  target?.addEventListener('animationend', onEnd);
  return cancel;
}

function matchKey(view: Snapshot): string {
  return JSON.stringify([view.roomId, view.series.id, view.series.matchId, view.you]);
}

/** Read only the public action DTO. Never recover a weapon from board history or a private choice. */
export function combatModel(action: GameActionView, view: Snapshot): CombatModel | null {
  if (action.kind === 'move' || !action.defender || action.attacker.id === action.defender.id) return null;
  const attackerPlayer = view.players.find((player) => player.id === action.attacker.owner);
  const defenderPlayer = view.players.find((player) => player.id === action.defender!.owner);
  if (!attackerPlayer || !defenderPlayer || attackerPlayer.id === defenderPlayer.id) return null;
  const resolved = ['attacker', 'defender', 'trap', 'flag'].includes(action.outcome);
  const candidates = [action.attacker, action.defender];
  const winner = resolved ? candidates.find((piece) => piece.id === action.winnerId && !action.removedIds.includes(piece.id)) : null;
  const loser = winner ? candidates.find((piece) => piece.id !== winner.id && action.removedIds.includes(piece.id)) : null;
  const winnerOwnerId = winner && loser ? winner.owner : null;
  const fighter = (piece: PieceView, role: Combatant['role']): Combatant => {
    const player = piece.owner === attackerPlayer.id ? attackerPlayer : defenderPlayer;
    return {
      id: piece.id, ownerId: piece.owner, name: player.name, team: teamColorForSeat(player.seat),
      kind: piece.revealed ? piece.kind : null, own: piece.owner === view.you, role,
      result: winnerOwnerId && piece.id === winner?.id ? 'winner' : winnerOwnerId && piece.id === loser?.id ? 'loser' : 'neutral',
    };
  };
  const attacker = fighter(action.attacker, 'Angriff'), defender = fighter(action.defender, 'Verteidigung');
  const winnerName = winnerOwnerId === attacker.ownerId ? attacker.name : defender.name;
  const heading = `${LABELS[attacker.kind ?? 'unknown']} gegen ${LABELS[defender.kind ?? 'unknown']}`;
  let result = 'Der Kampf ist entschieden.';
  if (action.outcome === 'duel') result = 'Gleiche Waffen. Beide wählen neu.';
  else if (action.outcome === 'tie') result = 'Unentschieden. Wählt eure Waffen erneut.';
  else if (winnerOwnerId && action.outcome === 'trap') result = `Die Falle von ${winnerName} hält stand.`;
  else if (winnerOwnerId && action.outcome === 'flag') result = `${winnerName} erobert die Flagge.`;
  else if (winnerOwnerId) result = `${winnerName} gewinnt den Kampf.`;
  return { identity: matchKey(view), actionId: action.id, turn: action.turnNumber, round: action.duelRound, attacker, defender, winnerOwnerId, outcome: action.outcome, heading, result };
}

/** The only selected weapon shown here is the viewing player's own private choice. */
export function duelChoiceState(view: Snapshot | null, options: CombatOptions, busy = false): DuelChoiceState | null {
  if (!view || busy || view.phase !== 'duel' || !view.duel ||
      (view.duel.attacker !== view.you && view.duel.defender !== view.you)) return null;
  const player = view.players.find((entry) => entry.id === view.you);
  if (!player) return null;
  const duel = view.duel;
  const locked = duel.choiceLocked[view.you] === true;
  const selected = duel.yourChoice && WEAPONS.includes(duel.yourChoice) ? duel.yourChoice : null;
  const disabled = !options.connected || options.pending || view.paused || locked;
  const otherLocked = Object.entries(duel.choiceLocked).some(([id, value]) => id !== view.you && value === true);
  const status = !options.connected || view.paused ? 'Die Partie pausiert. Sobald beide verbunden sind, geht es weiter.' :
    locked ? selected ? `Du hast ${LABELS[selected]} gewählt. Warte auf deinen Gegner.` : 'Deine Wahl ist verdeckt abgegeben.' :
    options.pending ? 'Deine Wahl wird bestätigt …' :
    otherLocked ? 'Dein Gegner hat verdeckt gewählt. Jetzt bist du dran.' : 'Dein Gegner kann deine Wahl nicht sehen.';
  return { identity: JSON.stringify([matchKey(view), duel.id, duel.round]), duelId: duel.id, round: duel.round, team: teamColorForSeat(player.seat), selected, locked, disabled, status };
}

/** An arriving choice must not interrupt a message or another text entry. */
export function isTextEntry(element: Element | null): boolean {
  if (!element) return false;
  if (element.tagName === 'TEXTAREA' || (element as HTMLElement).isContentEditable) return true;
  return element.tagName === 'INPUT' && !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes((element as HTMLInputElement).type);
}

function artwork(skin: LoadedSkin, fighter: Pick<Combatant, 'kind' | 'team' | 'own'>, size: number): string {
  if (skin.id === 'icq-retro' || skin.id === 'icq-retro-dark') {
    if (fighter.kind === 'paper') return paperSheet();
    if (fighter.kind === 'scissors') return scissorsArtwork();
  }
  return fighter.kind && WEAPONS.includes(fighter.kind as FighterKind)
    ? weaponIcon(skin, fighter.kind as FighterKind, size, fighter.team)
    : pieceIcon(skin, fighter.kind ?? 'unknown', size, fighter.own ? 'own' : 'enemy', fighter.kind !== null, fighter.team);
}

const CLOUD = '<svg class="combat-cloud" viewBox="0 0 240 150" aria-hidden="true"><path d="M44 110C16 110 9 81 29 64C15 35 47 15 70 28C81 0 121 6 132 25C160 4 190 24 188 44C225 35 246 70 224 92C243 120 208 145 183 129C168 153 132 145 120 131C89 149 60 134 62 120C56 122 48 119 44 110Z" fill="#f6f6df" stroke="#737b60" stroke-width="4"/><path d="M35 72Q53 58 67 74M153 35Q176 32 183 50M164 111Q184 94 202 109M66 112Q64 94 82 91" fill="none" stroke="#b6bba0" stroke-width="5" stroke-linecap="round"/><path d="m99 35 11 23 18-25-3 29 25-6-25 20 17 15-29-3-8 28-7-25-25 8 17-23-18-15 25 3Z" fill="#e3ba48" stroke="#7a6330" stroke-width="3"/></svg>';

function paperSheet(): string {
  return '<svg class="combat-paper-sheet" viewBox="0 0 128 128" aria-hidden="true"><path d="M24 12 108 18 102 116 17 108Z" fill="#fffef6" stroke="#10120e" stroke-width="4" stroke-linejoin="round"/><path d="m34 34 56 4m-58 14 56 4m-58 14 56 4m-58 14 39 3" fill="none" stroke="#bfc6be" stroke-width="2"/></svg>';
}

/** Two complete blade/handle assemblies, sharing the ICQ weapon silhouette. */
function scissorsArtwork(blade?: number): string {
  const halves = [
    '<g class="combat-blade combat-blade-0"><path d="M117 119 139 128C149 154 166 190 177 232C152 218 129 186 109 147Z" fill="#bbc2c1"/><path d="M114 125C98 112 77 91 71 67C66 43 73 20 89 17C110 13 121 38 125 62C129 84 126 103 125 111L136 125Z M106 94C96 82 88 67 87 53C86 42 88 34 92 35C100 36 108 58 109 73C111 82 111 90 110 95Z" fill="#f3cf46" fill-rule="evenodd"/></g>',
    '<g class="combat-blade combat-blade-1"><path d="M139 116 154 135C139 175 114 217 81 237C85 189 101 147 123 121Z" fill="#e3e8e5"/><path d="M131 144C119 173 108 198 93 220" fill="none" stroke="#fff" stroke-width="5"/><path d="M129 124C135 98 138 67 150 44C160 24 179 17 190 29C204 42 195 69 182 87C169 105 152 122 147 132Z M150 104C154 80 165 52 175 44C180 40 182 47 178 59C173 77 159 95 150 104Z" fill="#f3cf46" fill-rule="evenodd"/></g>',
  ];
  return `<svg viewBox="0 0 320 320" aria-hidden="true"><g transform="translate(32 32) rotate(24 128 128)" stroke="#10120e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${blade === undefined ? halves.join('') + '<circle cx="133" cy="133" r="12" fill="#d9ded8" stroke-width="6"/>' : halves[blade]}</g></svg>`;
}

export function icqCombatScene(skin: LoadedSkin, model: CombatModel): 'wrap' | 'cut' | 'split' | 'standard' {
  if (skin.id !== 'icq-retro' && skin.id !== 'icq-retro-dark') return 'standard';
  const winner = [model.attacker, model.defender].find(piece => piece.result === 'winner');
  const loser = [model.attacker, model.defender].find(piece => piece.result === 'loser');
  if (winner?.kind === 'paper' && loser?.kind === 'rock') return 'wrap';
  if (winner?.kind === 'scissors' && loser?.kind === 'paper') return 'cut';
  if (winner?.kind === 'rock' && loser?.kind === 'scissors') return 'split';
  return 'standard';
}

/** Persistent board overlay. Main delegates the existing data-action="duel" buttons. */
export class CombatOverlay {
  private view: Snapshot | null = null;
  private skin: LoadedSkin | null = null;
  private options: CombatOptions = { connected: false, pending: false };
  private identity: string | null = null;
  private active: CombatModel | null = null;
  private activeAction: GameActionView | null = null;
  private activeStarted = false;
  private waitingForBoard = false;
  private effectPlayed = false;
  private resultPlayed = false;
  private effectPlayback: Promise<void> | null = null;
  private provisionalChoice: { identity: string; kind: FighterKind } | null = null;
  private queue: QueuedCombat[] = [];
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private cancelAnimation: (() => void) | null = null;
  private epoch = 0;
  private activeStage: CombatStage = 'approach';
  private activeReduced = false;
  private animationsEnabled = true;
  private busyState = false;
  private mountedChoice: string | null = null;
  private paintedSkin: LoadedSkin | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement, private readonly callbacks: {
    onBusyChange: (busy: boolean) => void;
    onCelebrate: (ownerId: string) => void;
    onBattleStart?: (action: GameActionView) => void;
    onBattleEffect?: (action: GameActionView) => Promise<void>;
    onBattleResult?: (action: GameActionView) => void;
    beforeBattle?: () => Promise<void>;
  }) {
    root.classList.add('combat-overlay');
    root.hidden = true;
    root.dataset.mode = 'idle';
  }

  get busy(): boolean { return this.busyState; }

  previewChoice(kind: FighterKind): void {
    const choice = duelChoiceState(this.view, this.options);
    if (choice && WEAPONS.includes(kind)) this.provisionalChoice = { identity: choice.identity, kind };
  }

  clearPreviewChoice(): void { this.provisionalChoice = null; }

  update(view: Snapshot | null, skin: LoadedSkin, options: CombatOptions): void {
    if (!view || this.identity !== null && this.identity !== matchKey(view)) this.reset();
    this.view = view;
    this.skin = skin;
    this.options = { ...options };
    const choice = duelChoiceState(view, this.options);
    if (this.provisionalChoice?.identity !== choice?.identity) this.provisionalChoice = null;
    this.identity = view ? matchKey(view) : null;
    if (!view) return;
    if (!options.connected || view.paused || view.players.some(player => !player.connected)) this.cancelBattles();
    if (!this.active && this.queue.length && options.connected && !view.paused) this.startNext();
    this.paint();
  }

  present(action: GameActionView, view: Snapshot): void {
    const model = combatModel(action, view);
    if (!model || view.paused || view.players.some((player) => !player.connected)) return;
    if (this.identity !== null && this.identity !== model.identity) this.reset();
    this.identity = model.identity;
    this.view = view;
    this.queue.push({
      model,
      action: { ...action, attacker: { ...action.attacker }, defender: action.defender ? { ...action.defender } : null, removedIds: [...action.removedIds] },
    });
    if (!this.active && this.skin && this.options.connected) this.startNext();
  }

  setAnimationsEnabled(enabled: boolean): void {
    this.animationsEnabled = enabled;
    if (!enabled && this.activeStarted && this.active && !this.activeReduced) {
      this.clearTimers();
      this.activeReduced = true;
      this.activeStage = 'result';
      this.paintBattle();
    }
  }

  reset(): void {
    this.cancelBattles();
    this.view = null;
    this.identity = null;
    this.options = { connected: false, pending: false };
    this.hide();
  }

  private setBusy(busy: boolean): void {
    if (this.busyState === busy) return;
    this.busyState = busy;
    this.callbacks.onBusyChange(busy);
  }

  private clearTimers(): void {
    this.cancelAnimation?.();
    this.cancelAnimation = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    this.epoch += 1;
  }

  private schedule(delay: number, callback: () => void): void {
    const epoch = this.epoch;
    this.timers.push(setTimeout(() => { if (epoch === this.epoch && this.active) callback(); }, delay));
  }

  private cancelBattles(): void {
    this.clearTimers();
    this.queue = [];
    this.active = null;
    this.activeAction = null;
    this.activeStarted = false;
    this.waitingForBoard = false;
    this.provisionalChoice = null;
    this.effectPlayback = null;
    this.setBusy(false);
  }

  private startNext(): void {
    if (!this.skin || !this.view || !this.options.connected || this.view.paused) return;
    this.clearTimers();
    const next = this.queue.shift();
    this.active = next?.model ?? null;
    this.activeAction = next?.action ?? null;
    this.activeStarted = false;
    this.effectPlayed = false;
    this.resultPlayed = false;
    this.effectPlayback = null;
    if (!this.active) { this.setBusy(false); return; }
    this.setBusy(true);
    if (this.callbacks.beforeBattle && this.activeAction?.kind !== 'duel') {
      this.waitingForBoard = true;
      this.root.hidden = true;
      const epoch = this.epoch;
      void this.callbacks.beforeBattle().then(() => {
        if (epoch !== this.epoch || !this.active) return;
        this.waitingForBoard = false;
        this.revealBattle();
      });
    } else this.revealBattle();
  }

  private revealBattle(): void {
    this.beginBattle();
  }

  private beginBattle(): void {
    if (!this.active || !this.activeAction || this.activeStarted) return;
    this.clearTimers();
    this.activeStarted = true;
    this.activeReduced = !this.animationsEnabled || this.root.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.activeStage = this.activeReduced ? 'result' : 'approach';
    this.mountedChoice = null;
    this.paintBattle();
    this.callbacks.onBattleStart?.(this.activeAction);
  }

  /** Later phases start only after the current CSS animation has run, including on a cold SVG renderer. */
  private continueBattle(): void {
    this.clearTimers();
    if (!this.active) return;
    if (!this.effectPlayed && this.activeAction && (this.activeStage === 'shatter' ||
        this.activeStage === 'impact' && !this.active.winnerOwnerId || this.activeStage === 'result' && this.activeReduced)) {
      this.effectPlayed = true;
      this.effectPlayback = this.callbacks.onBattleEffect?.(this.activeAction) ?? null;
    }
    if (this.activeReduced || this.activeStage === 'result') {
      const epoch = this.epoch;
      const finish = () => { if (epoch === this.epoch && this.active) this.finish(); };
      this.schedule(this.activeReduced ? COMBAT_TIMING.reduced : COMBAT_TIMING.complete - COMBAT_TIMING.shatter,
        () => { if (this.effectPlayback) void this.effectPlayback.then(finish); else finish(); });
      return;
    }
    const stages = {
      approach: { selector: '.combat-fighter:first-child .combat-art', name: 'combat-approach-left', duration: COMBAT_TIMING.impact, next: 'impact' },
      impact: { selector: '.combat-cloud', name: 'combat-impact', duration: COMBAT_TIMING.shatter - COMBAT_TIMING.impact, next: this.active.winnerOwnerId ? 'shatter' : 'result' },
      shatter: { selector: '.combat-fighter:first-child .combat-art', name: 'combat-return-left', duration: COMBAT_TIMING.winner - COMBAT_TIMING.shatter, next: 'winner' },
      winner: { selector: '.combat-fighter[data-result="winner"] .combat-art', name: 'combat-winner-pulse', duration: COMBAT_TIMING.complete - COMBAT_TIMING.winner, next: null },
    } as const;
    const stage = stages[this.activeStage];
    const epoch = this.epoch;
    this.cancelAnimation = waitForCombatAnimation(this.root.querySelector(stage.selector), stage.name, stage.duration + 1000, () => {
      if (epoch !== this.epoch || !this.active) return;
      const advance = () => {
        if (epoch !== this.epoch || !this.active) return;
        if (stage.next === null) this.finish();
        else { this.setStage(stage.next); this.continueBattle(); }
      };
      if (this.effectPlayback) void this.effectPlayback.then(advance);
      else advance();
    });
  }

  private finish(): void {
    const model = this.active;
    if (!model) return;
    if (this.activeReduced) this.playResult();
    this.clearTimers();
    this.active = null;
    this.activeAction = null;
    this.activeStarted = false;
    if (this.queue.length) this.startNext();
    else { this.setBusy(false); this.paint(); }
    if (model.winnerOwnerId && this.view && model.identity === this.identity && this.options.connected && !this.view.paused) {
      this.callbacks.onCelebrate(model.winnerOwnerId);
    }
  }

  private setStage(stage: CombatStage): void {
    if (stage === 'winner') this.playResult();
    this.activeStage = stage;
    this.root.dataset.stage = stage;
    const stageElement = this.root.querySelector<HTMLElement>('.combat-stage');
    if (stageElement) stageElement.dataset.stage = stage;
    const result = this.root.querySelector<HTMLElement>('.combat-result');
    if (result && this.active) result.textContent = stage === 'shatter' || stage === 'winner' || stage === 'result' ? this.active.result : this.active.outcome === 'trap' ? 'Die Figur klappt wie eine Falltür auf …' : this.active.outcome === 'flag' ? 'Die Flagge wird erobert …' : 'Die Waffen treffen aufeinander.';
  }

  private paint(): void {
    if (this.waitingForBoard) { this.root.hidden = true; return; }
    if (this.active) {
      if (this.paintedSkin !== this.skin || this.root.dataset.mode !== 'battle') this.paintBattle();
      return;
    }
    const choice = duelChoiceState(this.view, this.options);
    if (choice && this.skin) {
      const selected = choice.selected ?? (this.provisionalChoice?.identity === choice.identity ? this.provisionalChoice.kind : null);
      if (choice.locked || this.provisionalChoice?.identity === choice.identity) this.paintWaitingBattle(choice, selected);
      else this.paintChoice(choice);
    }
    else this.hide();
  }

  private playResult(): void {
    if (this.resultPlayed || !this.activeAction || !this.active?.winnerOwnerId) return;
    this.resultPlayed = true;
    this.callbacks.onBattleResult?.(this.activeAction);
  }

  private rememberFocus(): void {
    if (this.previousFocus) return;
    const current = this.root.ownerDocument.activeElement;
    if (current && current !== this.root.ownerDocument.body && !this.root.contains(current) && 'focus' in current) this.previousFocus = current as HTMLElement;
  }

  private paintBattle(): void {
    if (!this.active || !this.skin) return;
    const hadFocus = this.root.contains(this.root.ownerDocument.activeElement);
    this.rememberFocus();
    const model = this.active, skin = this.skin;
    const scene = icqCombatScene(skin, model);
    const special = model.outcome === 'trap' || model.outcome === 'flag';
    const fighter = (piece: Combatant): string => {
      const tile = (name: string) => atlasIcon(skin, name, 104) ?? '';
      const perspective = model.outcome === 'trap' && piece.own ? 'own' : 'enemy';
      const figure = skin.definition.teamPieces?.[piece.team]?.[perspective]?.unknown ?? skin.definition.pieces?.[piece.team === 'blue' ? 'own' : 'enemy']?.unknown;
      // The door uses the normal concealed board figure, including its color
      // and viewing direction, rather than a separate decoy illustration.
      const art = special ? model.outcome === 'trap' || figure ? pieceIcon(skin, 'unknown', 104, perspective, false, piece.team) : tile('combat-figure-' + piece.team) : artwork(skin, piece, 104);
      const extras = model.outcome === 'trap' && piece.kind === 'trap' ? `<span class="combat-trap-hole">${tile('combat-trap-hole')}</span>` : model.outcome === 'flag' ? `<span class="combat-capture-flag">${tile('combat-flag-' + model.defender.team)}</span>${piece.result === 'loser' ? '<span class="combat-puff">' + tile('combat-puff') + '</span>' : ''}` : '';
      const shards = !special && scene !== 'wrap' && piece.result === 'loser' ? '<span class="combat-shards" aria-hidden="true">' + Array.from({ length: scene === 'standard' ? 6 : 2 }, (_, index) => `<span class="combat-shard combat-shard-${index}">${scene === 'split' ? scissorsArtwork(index) : art}</span>`).join('') + '</span>' : '';
      const wrap = scene === 'wrap' && piece.kind === 'rock' ? '<span class="combat-wrap" aria-hidden="true">' + paperSheet() + '</span>' : '';
      return `<div class="combat-fighter" data-kind="${piece.kind ?? 'unknown'}" data-piece-id="${esc(piece.id)}" data-owner-id="${esc(piece.ownerId)}" data-team-color="${piece.team}" data-result="${piece.result}"><p class="combat-fighter-role">${piece.role}</p><div class="combat-art"><span class="combat-art-main">${art}</span>${extras}${wrap}${shards}</div><div class="combat-fighter-caption"><strong>${esc(piece.name)}</strong><span>${teamColorName(piece.team)} · ${LABELS[piece.kind ?? 'unknown']}</span><span class="combat-fighter-result">${piece.result === 'winner' ? 'Sieger' : piece.result === 'loser' ? 'Besiegt' : 'Neue Wahl'}</span></div></div>`;
    };
    this.root.hidden = false;
    this.root.dataset.mode = 'battle';
    this.root.dataset.actionId = String(model.actionId);
    this.root.dataset.motion = this.activeReduced ? 'reduced' : 'full';
    delete this.root.dataset.transition;
    delete this.root.dataset.duelId;
    delete this.root.dataset.duelRound;
    this.root.innerHTML = `<section class="combat-stage" data-scene="${scene}" data-outcome="${model.outcome}" data-stage="${this.activeStage}" data-motion="${this.root.dataset.motion}" aria-label="Kampf" tabindex="-1"><header class="combat-heading"><p>${model.round ? 'DUELL · RUNDE ' + model.round : 'KAMPF · ZUG ' + model.turn}</p><h2>${esc(model.heading)}</h2></header><div class="combat-fighters">${fighter(model.attacker)}${fighter(model.defender)}${CLOUD}</div><p class="combat-result" role="status" aria-live="polite"></p></section>`;
    this.paintedSkin = skin;
    this.setStage(this.activeStage);
    if (hadFocus) this.root.querySelector<HTMLElement>('.combat-stage')?.focus({ preventScroll: true });
    // A skin switch replaces animated nodes. Rebind only the current phase and discard its old listener/timer.
    this.continueBattle();
  }

  private paintWaitingBattle(choice: DuelChoiceState, selected: FighterKind | null): void {
    if (!this.skin || !this.view) return;
    const markup = `<section class="combat-stage" data-stage="waiting" aria-label="Kampf vorbereitet"><header class="combat-heading"><p>DUELL · RUNDE ${choice.round}</p><h2>Waffen werden aufgedeckt …</h2></header><div class="combat-fighters"><div class="combat-fighter" data-team-color="${choice.team}"><p class="combat-fighter-role">Deine Waffe</p><div class="combat-art"><span class="combat-art-main">${selected ? artwork(this.skin, { kind: selected, team: choice.team, own: true }, 104) : icon('unknown', '', 104)}</span></div></div><div class="combat-fighter"><p class="combat-fighter-role">Gegnerische Waffe</p><div class="combat-art"><span class="combat-art-main">${icon('unknown', '', 104)}</span></div></div></div><p class="combat-result" role="status">${esc(choice.status)}</p></section>`;
    this.root.hidden = false;
    this.root.dataset.mode = 'waiting';
    delete this.root.dataset.stage;
    delete this.root.dataset.actionId;
    if (this.root.innerHTML !== markup) this.root.innerHTML = markup;
    this.mountedChoice = null;
  }

  private paintChoice(choice: DuelChoiceState): void {
    const mounted = this.mountedChoice !== choice.identity || this.root.dataset.mode !== 'choice';
    const skinChanged = this.paintedSkin !== this.skin;
    const hadFocus = this.root.contains(this.root.ownerDocument.activeElement);
    if (mounted) {
      this.rememberFocus();
      this.root.innerHTML = '<section class="combat-choice-panel" role="dialog" aria-modal="false" aria-labelledby="combat-choice-title" aria-describedby="combat-choice-status" tabindex="-1"><header class="combat-heading"><p class="combat-choice-round"></p><h2 id="combat-choice-title">Wähle deine Waffe</h2></header><div class="combat-choices">' + WEAPONS.map((kind) => `<button type="button" class="combat-choice" data-action="duel" data-kind="${kind}" id="duel-${kind}" aria-pressed="false"><span class="combat-choice-art" aria-hidden="true"></span><strong>${LABELS[kind]}</strong><span class="combat-choice-selected" aria-hidden="true">${icon('check', '', 14)}Gewählt</span></button>`).join('') + '</div><p class="combat-choice-status" id="combat-choice-status" role="status" aria-live="polite"></p></section>';
      this.mountedChoice = choice.identity;
    }
    this.root.hidden = false;
    this.root.dataset.mode = 'choice';
    this.root.dataset.duelId = choice.duelId;
    this.root.dataset.duelRound = String(choice.round);
    delete this.root.dataset.stage;
    delete this.root.dataset.actionId;
    delete this.root.dataset.motion;
    delete this.root.dataset.transition;
    const panel = this.root.querySelector<HTMLElement>('.combat-choice-panel')!;
    panel.dataset.teamColor = choice.team;
    panel.dataset.locked = String(choice.locked);
    this.root.querySelector<HTMLElement>('.combat-choice-round')!.textContent = choice.round > 1 ? `UNENTSCHIEDEN · RUNDE ${choice.round}` : 'GLEICHE WAFFEN · NEUES DUELL';
    for (const kind of WEAPONS) {
      const button = this.root.querySelector<HTMLButtonElement>('#duel-' + kind)!;
      button.disabled = choice.disabled;
      button.classList.toggle('selected', choice.selected === kind);
      button.setAttribute('aria-pressed', String(choice.selected === kind));
      if ((mounted || skinChanged) && this.skin) button.querySelector<HTMLElement>('.combat-choice-art')!.innerHTML = weaponIcon(this.skin, kind, 88, choice.team);
    }
    const status = this.root.querySelector<HTMLElement>('.combat-choice-status')!;
    if (status.textContent !== choice.status) status.textContent = choice.status;
    this.paintedSkin = this.skin;
    const focused = this.root.ownerDocument.activeElement;
    const editingOutside = !this.root.contains(focused) && isTextEntry(focused);
    if (mounted && !editingOutside && !this.root.ownerDocument.querySelector('[aria-modal="true"]')) {
      const first = !choice.disabled ? this.root.querySelector<HTMLButtonElement>('#duel-' + (choice.selected ?? 'rock')) : panel;
      first?.focus({ preventScroll: true });
    } else if (hadFocus && choice.disabled && this.root.ownerDocument.activeElement !== panel) panel.focus({ preventScroll: true });
  }

  private hide(): void {
    const hadFocus = this.root.contains(this.root.ownerDocument.activeElement);
    this.root.hidden = true;
    this.root.dataset.mode = 'idle';
    delete this.root.dataset.stage;
    delete this.root.dataset.actionId;
    delete this.root.dataset.motion;
    delete this.root.dataset.duelId;
    delete this.root.dataset.duelRound;
    delete this.root.dataset.transition;
    if (this.root.childElementCount) this.root.replaceChildren();
    this.mountedChoice = null;
    this.paintedSkin = null;
    if (hadFocus) {
      const target = this.previousFocus?.isConnected ? this.previousFocus : this.root.parentElement?.querySelector<HTMLElement>('#board[tabindex]');
      target?.focus({ preventScroll: true });
    }
    this.previousFocus = null;
  }
}
