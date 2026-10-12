import { mobileGraphics } from './mobile-graphics';
import type { FighterKind, GameActionView, PieceView } from '../shared/game';
import type { Snapshot } from '../shared/protocol';
import { escapeHtml as esc, icon } from './icons';
import { pieceIcon, weaponIcon } from './skin-ui';
import type { LoadedSkin, TeamColor } from './skin-types';
import { teamColorForSeat, teamColorName } from './team-ui';

const WEAPONS: FighterKind[] = ['rock', 'paper', 'scissors'];
const LABELS = { rock: 'Stein', paper: 'Papier', scissors: 'Schere', trap: 'Falle', flag: 'Flagge', unknown: 'Verdeckte Figur' };
export const COMBAT_TIMING = Object.freeze({ choicePause: 600, impact: 600, shatter: 1200, winner: 1900, complete: 3000, reduced: 350 });
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
  choice: DuelChoiceState | null;
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

/** Hold only the viewer's confirmed weapon; the opponent and result are painted after the pause. */
export function confirmedDuelChoice(model: CombatModel, previous: DuelChoiceState | null): DuelChoiceState | null {
  if (model.round === null) return null;
  const own = model.attacker.own ? model.attacker : model.defender.own ? model.defender : null;
  if (!own) return null;
  const sameRound = previous?.round === model.round ? previous : null;
  // The second submitter may receive the resolved action without an intermediate
  // yourChoice snapshot. Their own public action piece confirms that selection.
  const selected = own.kind && WEAPONS.includes(own.kind as FighterKind) ? own.kind as FighterKind : null;
  return {
    identity: sameRound?.identity ?? JSON.stringify([model.identity, model.actionId, 'confirmed-choice']),
    duelId: sameRound?.duelId ?? 'confirmed-' + model.actionId,
    round: model.round, team: own.team, selected, locked: true, disabled: true,
    status: 'Beide Waffen sind bestätigt. Der Kampf beginnt gleich …',
  };
}

/** An arriving choice must not interrupt a message or another text entry. */
export function isTextEntry(element: Element | null): boolean {
  if (!element) return false;
  if (element.tagName === 'TEXTAREA' || (element as HTMLElement).isContentEditable) return true;
  return element.tagName === 'INPUT' && !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes((element as HTMLInputElement).type);
}

function artwork(skin: LoadedSkin, fighter: Combatant, size: number): string {
  return fighter.kind && WEAPONS.includes(fighter.kind as FighterKind)
    ? weaponIcon(skin, fighter.kind as FighterKind, size, fighter.team)
    : pieceIcon(skin, fighter.kind ?? 'unknown', size, fighter.own ? 'own' : 'enemy', fighter.kind !== null, fighter.team);
}

const CLOUD = '<svg class="combat-cloud" viewBox="0 0 240 150" aria-hidden="true"><path d="M44 110C16 110 9 81 29 64C15 35 47 15 70 28C81 0 121 6 132 25C160 4 190 24 188 44C225 35 246 70 224 92C243 120 208 145 183 129C168 153 132 145 120 131C89 149 60 134 62 120C56 122 48 119 44 110Z" fill="#f6f6df" stroke="#737b60" stroke-width="4"/><path d="M35 72Q53 58 67 74M153 35Q176 32 183 50M164 111Q184 94 202 109M66 112Q64 94 82 91" fill="none" stroke="#b6bba0" stroke-width="5" stroke-linecap="round"/><path d="m99 35 11 23 18-25-3 29 25-6-25 20 17 15-29-3-8 28-7-25-25 8 17-23-18-15 25 3Z" fill="#e3ba48" stroke="#7a6330" stroke-width="3"/></svg>';

/** Persistent board overlay. Main delegates the existing data-action="duel" buttons. */
export class CombatOverlay {
  private view: Snapshot | null = null;
  private skin: LoadedSkin | null = null;
  private options: CombatOptions = { connected: false, pending: false };
  private identity: string | null = null;
  private active: CombatModel | null = null;
  private activeAction: GameActionView | null = null;
  private activeStarted = false;
  private waitingChoice: DuelChoiceState | null = null;
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
  }) {
    root.classList.add('combat-overlay');
    root.hidden = true;
    root.dataset.mode = 'idle';
  }

  get busy(): boolean { return this.busyState; }
  get waitingForReveal(): boolean { return this.waitingChoice !== null; }

  update(view: Snapshot | null, skin: LoadedSkin, options: CombatOptions): void {
    if (!view || this.identity !== null && this.identity !== matchKey(view)) this.reset();
    this.view = view;
    this.skin = skin;
    this.options = { ...options };
    this.identity = view ? matchKey(view) : null;
    if (!view) return;
    if (!options.connected || view.paused) this.cancelBattles();
    if (!this.active && this.queue.length && options.connected && !view.paused) this.startNext();
    this.paint();
  }

  present(action: GameActionView, view: Snapshot): void {
    const model = combatModel(action, view);
    if (!model || view.paused || view.players.some((player) => !player.connected)) return;
    if (this.identity !== null && this.identity !== model.identity) this.reset();
    const previousChoice = duelChoiceState(this.view, this.options);
    this.identity = model.identity;
    this.view = view;
    this.queue.push({
      model,
      action: { ...action, attacker: { ...action.attacker }, defender: action.defender ? { ...action.defender } : null, removedIds: [...action.removedIds] },
      choice: action.kind === 'duel' ? confirmedDuelChoice(model, previousChoice) : null,
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
    this.waitingChoice = null;
    this.setBusy(false);
  }

  private startNext(): void {
    if (!this.skin || !this.view || !this.options.connected || this.view.paused) return;
    this.clearTimers();
    const next = this.queue.shift();
    this.active = next?.model ?? null;
    this.activeAction = next?.action ?? null;
    this.activeStarted = false;
    this.waitingChoice = next?.choice ?? null;
    if (!this.active) { this.setBusy(false); return; }
    this.setBusy(true);
    if (this.waitingChoice) {
      this.paintRevealChoice();
      this.schedule(COMBAT_TIMING.choicePause, () => this.beginBattle());
    } else this.beginBattle();
  }

  private beginBattle(): void {
    if (!this.active || !this.activeAction || this.activeStarted) return;
    this.clearTimers();
    this.waitingChoice = null;
    this.activeStarted = true;
    this.activeReduced = mobileGraphics() || !this.animationsEnabled || this.root.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.activeStage = this.activeReduced ? 'result' : 'approach';
    this.mountedChoice = null;
    this.paintBattle();
    this.callbacks.onBattleStart?.(this.activeAction);
  }

  /** Later phases start only after the current CSS animation has run, including on a cold SVG renderer. */
  private continueBattle(): void {
    this.clearTimers();
    if (!this.active) return;
    if (this.activeReduced || this.activeStage === 'result') {
      this.schedule(this.activeReduced ? COMBAT_TIMING.reduced : COMBAT_TIMING.complete - COMBAT_TIMING.shatter, () => this.finish());
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
      if (stage.next === null) this.finish();
      else {
        this.setStage(stage.next);
        this.continueBattle();
      }
    });
  }

  private finish(): void {
    const model = this.active;
    if (!model) return;
    this.clearTimers();
    this.active = null;
    this.activeAction = null;
    this.activeStarted = false;
    this.waitingChoice = null;
    if (this.queue.length) this.startNext();
    else { this.setBusy(false); this.paint(); }
    if (model.winnerOwnerId && this.view && model.identity === this.identity && this.options.connected && !this.view.paused) {
      this.callbacks.onCelebrate(model.winnerOwnerId);
    }
  }

  private setStage(stage: CombatStage): void {
    this.activeStage = stage;
    this.root.dataset.stage = stage;
    const stageElement = this.root.querySelector<HTMLElement>('.combat-stage');
    if (stageElement) stageElement.dataset.stage = stage;
    const result = this.root.querySelector<HTMLElement>('.combat-result');
    if (result && this.active) result.textContent = stage === 'shatter' || stage === 'winner' || stage === 'result' ? this.active.result : 'Die Waffen treffen aufeinander.';
  }

  private paint(): void {
    if (this.active) {
      if (this.waitingChoice) this.paintRevealChoice();
      else if (this.paintedSkin !== this.skin || this.root.dataset.mode !== 'battle') this.paintBattle();
      return;
    }
    const choice = duelChoiceState(this.view, this.options);
    if (choice && this.skin) this.paintChoice(choice);
    else this.hide();
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
    const mobile = mobileGraphics();
    const fighter = (piece: Combatant): string => {
      const art = artwork(skin, piece, 104);
      const shards = !mobile && piece.result === 'loser' ? '<span class="combat-shards" aria-hidden="true">' + Array.from({ length: 6 }, (_, index) => `<span class="combat-shard combat-shard-${index}">${art}</span>`).join('') + '</span>' : '';
      return `<div class="combat-fighter" data-piece-id="${esc(piece.id)}" data-owner-id="${esc(piece.ownerId)}" data-team-color="${piece.team}" data-result="${piece.result}"><p class="combat-fighter-role">${piece.role}</p><div class="combat-art"><span class="combat-art-main">${art}</span>${shards}</div><div class="combat-fighter-caption"><strong>${esc(piece.name)}</strong><span>${teamColorName(piece.team)} · ${LABELS[piece.kind ?? 'unknown']}</span><span class="combat-fighter-result">${piece.result === 'winner' ? 'Sieger' : piece.result === 'loser' ? 'Besiegt' : 'Neue Wahl'}</span></div></div>`;
    };
    this.root.hidden = false;
    this.root.dataset.mode = 'battle';
    this.root.dataset.actionId = String(model.actionId);
    this.root.dataset.motion = this.activeReduced ? 'reduced' : 'full';
    delete this.root.dataset.transition;
    delete this.root.dataset.duelId;
    delete this.root.dataset.duelRound;
    this.root.innerHTML = `<section class="combat-stage" data-stage="${this.activeStage}" data-motion="${this.root.dataset.motion}" aria-label="Kampf" tabindex="-1"><header class="combat-heading"><p>${model.round ? 'DUELL · RUNDE ' + model.round : 'KAMPF · ZUG ' + model.turn}</p><h2>${esc(model.heading)}</h2></header><div class="combat-fighters">${fighter(model.attacker)}${fighter(model.defender)}${mobile ? '' : CLOUD}</div><p class="combat-result" role="status" aria-live="polite"></p></section>`;
    this.paintedSkin = skin;
    this.setStage(this.activeStage);
    if (hadFocus) this.root.querySelector<HTMLElement>('.combat-stage')?.focus({ preventScroll: true });
    // A skin switch replaces animated nodes. Rebind only the current phase and discard its old listener/timer.
    this.continueBattle();
  }

  private paintRevealChoice(): void {
    if (!this.waitingChoice) return;
    this.paintChoice(this.waitingChoice);
    this.root.dataset.transition = 'reveal';
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
