import { mobileGraphics } from './mobile-graphics';
import { inactivityKey, RefereeInactivity } from './idle-motion';
import { skinAssetUrl } from './skin-assets';
import './styles.css';
import './series.css';
import './retro.css';
import './combat-ui.css';
import './chat-ui.css';
import './lobby.css';
import './endgame-ui.css';
import type { FighterKind, PlayerView } from '../shared/game';
import type { ChatMessage, Snapshot } from '../shared/protocol';
import { ArenaBoard, coordinate, kindName } from './board';
import { escapeHtml as esc, icon } from './icons';
import { RpsConnection, readSession, roomCodeFrom, writeSession, type NetworkStatus, type SessionEnd } from './network';
import { builtInSkin, loadSkin, loadSkinCatalog } from './skins';
import { applyUiPalette, atlasIcon, pieceIcon, weaponIcon } from './skin-ui';
import type { LoadedSkin, SkinCatalog, SkinEntry, SoundCue, TeamColor } from './skin-types';
import { freshAction } from './board-motion';
import { GameSounds, freshRefereeCue } from './sound';
import { RefereeDelay } from './referee-delay';
import { readSeriesMode, seriesAnnouncement, seriesModeDescription, seriesModeLabel, seriesScoreMarkup, seriesInfoMarkup, seriesVoteStatus, seriesWinnerText } from './series-ui';
import { refereePortrait } from './referee-ui';
import { otherTeamColor, teamColorForPlayer, teamColorName } from './team-ui';
import { CombatOverlay, COMBAT_TIMING } from './combat-ui';
import { chatBubbleDuration, chatBubbleText, RoomChat } from './chat-ui';
import { freshVictory } from './match-victory';
import { EndgameOverlay } from './endgame-ui';
import { freshMatchStart, gongMarkup, preloadGongArtwork, GONG_TIMING } from './gong-ui';
import './gong-ui.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const legalLinks = '<nav aria-label="Rechtliche Informationen"><a href="/copyright.html" target="_blank" rel="noopener">Copyright<span class="sr-only"> (öffnet in neuem Tab)</span></a><a href="/impressum.html" target="_blank" rel="noopener">Impressum<span class="sr-only"> (öffnet in neuem Tab)</span></a></nav>';
const legalFooter = '<footer class="legal-footer">' + legalLinks + '</footer>';
app.innerHTML = [
  '<div class="app-shell" id="shell">',
  '<header class="app-header"><div class="header-arena"><a class="brand" href="' + esc(location.pathname) + '" aria-label="RPS Arena Startseite" data-action="home">',
  '<span class="brand-emblem" id="brand-emblem">' + icon('rock', '', 29) + '</span><span><span class="brand-title">RPS ARENA</span><span class="brand-tagline" style="display:block">Stein. Papier. Schere.</span></span></a>',
  '<section class="series-scoreboard" id="series-scoreboard" aria-label="Spielstand der Serie" aria-live="polite" aria-atomic="true" hidden></section></div><div class="header-right"><span class="header-note" id="header-note"><span class="status-dot"></span>PRIVATE PARTIEN</span><details class="appearance-menu" id="appearance-menu"><summary>Design ' + icon('chevron', '', 12) + '</summary><div class="appearance-panel"><label class="appearance-label" for="skin-select">Dein Design</label><select id="skin-select" aria-describedby="skin-status"><option value="classic">Klassisch</option></select><p class="appearance-status" id="skin-status" role="status">Grafiksets werden geladen …</p><label class="motion-option"><input id="animations-enabled" type="checkbox" checked />Animationen</label><p class="appearance-hint" id="motion-hint">Deine Auswahl gilt für diesen Browser.</p><label class="motion-option"><input id="sounds-enabled" type="checkbox" />Spielsounds</label><p class="appearance-hint">Designsounds und Schiedsrichter-Ansagen.</p></div></details><span class="version">v' + esc(__APP_VERSION__) + '</span></div></header>',
  '<div class="intro-row"><div><p class="eyebrow" id="page-eyebrow">DAS TAKTISCHE DUELL FÜR ZWEI</p><h1 class="page-title" id="page-title">Dein Zug beginnt hier.</h1></div><p class="page-subtitle" id="page-subtitle">Figuren verdecken.<br>Gedanken lesen. Flagge holen.</p></div>',
  '<div class="notice" id="notice" role="alert" hidden></div>',
  '<main class="arena-grid"><section id="phase-top-host" class="phase-top-host" aria-label="Spielaktionen" hidden><div id="phase-controls" class="phase-controls"></div></section><section class="play-panel" aria-label="Spielbereich">',
  '<div class="board-region"><div class="board-surface"><div id="board" class="canvas-wrap" tabindex="0" role="application" aria-label="Spielfeld mit sieben Spalten und sechs Reihen" aria-describedby="board-help board-focus"></div><div id="combat-overlay" class="combat-overlay" hidden></div><div id="endgame-overlay" hidden></div><div id="board-chat-notices" class="board-chat-notices" aria-live="polite" aria-relevant="additions text"></div></div>',
  '<div class="preview-banner" id="preview-banner">' + icon('unknown', '', 18) + '<span>Ein guter Plan bleibt erst einmal geheim.</span></div></div>',
  '<section id="room-chat" hidden></section></section>',
  '<aside class="side-column" id="match-sidebar" aria-label="Spielsteuerung"><details class="match-overview" id="match-overview"><summary class="match-status" title="Spielstatus und Seriendetails"><span class="eyebrow">SPIELSTATUS</span><span class="pill accent" id="board-phase">DEINE ARENA</span></summary><div class="match-status-details"><div id="series-info"></div><div class="match-team-counts"><span class="team-key" id="own-team-key" data-team-color="blue"><span class="team-square"></span><span id="own-count">Dein Team</span></span><span class="team-key enemy" id="enemy-team-key" data-team-color="red"><span class="team-square"></span><span id="enemy-count">Gegner</span></span><span class="board-hint" id="board-hint">Erstelle oder betrete einen Raum.</span></div></div></details><div class="match-controls" id="sidebar"></div></aside><section id="lobby-overlay" class="lobby-overlay" aria-label="Spiel starten"></section></main>',
  '<footer class="footer"><div class="footer-legal"><span>' + icon('info', '', 13) + 'Ein unabhängiges Remake · vorläufige Regeln für Version ' + esc(__APP_VERSION__) + '</span>' + legalLinks + '</div><span>Figur anklicken oder <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> + <kbd>Enter</kbd></span></footer></div>',
  '<p class="sr-only" id="board-help">Mit den Pfeiltasten ein Feld wählen. Mit Enter oder Leertaste eine eigene Figur und anschließend ein Zielfeld wählen. Escape hebt die Auswahl auf. In der Aufstellung tauschen zwei eigene Figuren die Plätze. Alternativ eine eigene Figur auf eine zweite eigene Figur ziehen. Im Spiel sind markierte Felder erlaubte Ziele.</p>',
  '<p class="sr-only" id="board-focus" aria-live="polite"></p><p class="sr-only" id="announcement" aria-live="polite" aria-atomic="true"></p>',
  '<div class="toast" id="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>',
].join('');

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const phaseControls = el('phase-controls');
const phaseSidebarHost = document.createElement('div');
phaseSidebarHost.className = 'phase-sidebar-host';
el('match-sidebar').insertBefore(phaseSidebarHost, el('sidebar'));
let view: Snapshot | null = null;
let networkStatus: NetworkStatus = 'idle';
let sessionEnd: SessionEnd | null = null;
let selected: number | null = null;
let pending = false;
let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
let toastTimeout: ReturnType<typeof setTimeout> | undefined;
let chatNoticeRoom: string | null = null;
const chatNotices = new Map<string, ChatMessage>();
let chatNoticeTimer: ReturnType<typeof setTimeout> | undefined;
let chatNoticeExitTimer: ReturnType<typeof setTimeout> | undefined;
let chatNoticeLeaving = false;
let chatNoticeOpacity = '.9';
let renderedChatNotice = '';
let name = readSession('rps-arena:name') ?? '';
let seriesMode = readSeriesMode(readPreference('rps-arena:series-mode'));
let inputRoom = roomCodeFrom(new URL(location.href).searchParams.get('room') ?? '');
let notice = '';
let lastAnnouncement = '';
let confirmAction: (() => void) | null = null;
let lastModalFocus: HTMLElement | null = null;
let currentSkin = builtInSkin();
let startCueActive = false;
let startCueSequence = 0;
let startCueTimer: ReturnType<typeof setTimeout> | undefined;
let pendingRefereeCue: SoundCue | null = null;
let shuffleSoundPending = false;
const refereeDelay = new RefereeDelay();
const refereeInactivity = new RefereeInactivity();
let yawnSequence = 0;

function updateRefereeInactivity(): void {
  const active = !!view && (view.phase === 'playing' || view.phase === 'duel') && !view.paused &&
    view.players.every(player => player.connected) && networkStatus === 'connected' && !document.hidden &&
    !!currentSkin.definition.audio?.yawn && !startCueActive;
  if (refereeInactivity.update(view ? inactivityKey(view) : '', active, performance.now())) {
    if (refereeInactivity.yawning) { yawnSequence++; sounds.playCue('yawn'); }
    render();
  }
}
setInterval(updateRefereeInactivity, 250);

function cancelReferee(): void {
  pendingRefereeCue = null;
  refereeDelay.cancel();
}

function turnAnnouncementPending(): boolean {
  return view?.phase === 'playing' && (refereeDelay.waiting || pendingRefereeCue === 'blueTurn' || pendingRefereeCue === 'redTurn');
}

function refereeView() {
  return view && turnAnnouncementPending() ? { ...view, currentTurn: null } : view;
}

function announceReferee(): void {
  if (!pendingRefereeCue || combat.busy || startCueActive || view?.paused || networkStatus !== 'connected') return;
  const cue = pendingRefereeCue;
  pendingRefereeCue = null;
  refereeDelay.schedule(async () => {
    await Promise.all([board.whenEffectsComplete(), sounds.whenIdle()]);
  }, () => {
    sounds.playCue(cue);
    render();
  }, cue === 'blueTurn' || cue === 'redTurn' ? 1000 : 0);
}

function cancelStartCue(): void {
  startCueSequence++;
  clearTimeout(startCueTimer);
  startCueTimer = undefined;
  startCueActive = false;
}
const fallbackEntry: SkinEntry = { id: 'classic', name: 'Klassisch', file: 'classic/skin.json' };
let skinCatalog: SkinCatalog = { version: 1, default: 'classic', skins: [fallbackEntry] };
let skinLoadSequence = 0;
const skinPreviews = new Map<string, LoadedSkin>();
const skinLoads = new Map<string, Promise<LoadedSkin>>();
let animationsPreferred = readPreference('rps-arena:animations') !== 'off';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactLayout = window.matchMedia('(max-width: 1000px), (max-height: 800px)');
const sounds = new GameSounds();
let soundsPreferred = readPreference('rps-arena:sounds') !== 'off';

const chat: RoomChat = new RoomChat(el('room-chat'), message => connection.send('chat_send', message), message => {
  if (!view || message.playerId === view.you) return;
  clearTimeout(chatNoticeTimer);
  clearTimeout(chatNoticeExitTimer);
  chatNoticeLeaving = false;
  chatNoticeRoom = view?.roomId ?? null;
  chatNotices.set(message.playerId, message);
  paintChatNotice();
  // The final second belongs to the fade-out, within the 5–15 second reading window.
  chatNoticeTimer = setTimeout(hideChatNotice, chatBubbleDuration(message.text) - 1000);
});
const connection = new RpsConnection({
  onStatus(status) {
    networkStatus = status;
    if (status !== 'connected') {
      if (status !== 'connecting') shuffleSoundPending = false;
      cancelStartCue();
      cancelReferee();
      sounds.cancel();
    }
    if (status === 'connecting' || status === 'connected') sessionEnd = null;
    if (status === 'reconnecting') {
      clearPending();
      el('announcement').textContent = 'Verbindung unterbrochen. Die Arena versucht, dich wieder zu verbinden.';
    }
    render();
  },
  onSnapshot(snapshot) {
    const start = networkStatus === 'connected' && freshMatchStart(view, snapshot);
    const refereeCue = networkStatus === 'connected' ? freshRefereeCue(view, snapshot) : null;
    if (!view || snapshot.paused || snapshot.series.matchId !== view.series.matchId ||
        ((snapshot.phase === 'waiting' || snapshot.phase === 'setup') && snapshot.phase !== view.phase) || snapshot.revision > view.revision + 1) {
      cancelReferee();
      sounds.cancel();
    }
    const preparing = snapshot.phase === 'waiting' || snapshot.phase === 'setup';
    const nextSetup = preparing && view?.phase === 'finished' && snapshot.series.matchId !== view.series.matchId;
    if (preparing && (shuffleSoundPending || nextSetup)) {
      shuffleSoundPending = false;
      sounds.cancel();
      sounds.playCue('shuffle');
    }
    if (snapshot.phase !== 'playing' || view?.series.matchId !== snapshot.series.matchId) cancelStartCue();
    if (start) {
      cancelStartCue();
      startCueActive = true;
      startCueSequence++;
      const animated = animationsPreferred && !reducedMotion.matches;
      const gong = currentSkin.definition.artwork?.gong;
      const sequence = startCueSequence;
      const playback = sounds.playStartGong(animated ? gong?.strikeMs ?? GONG_TIMING.strike : 0);
      const strike = new Promise<void>(resolve => {
        startCueTimer = setTimeout(resolve, animated ? gong?.durationMs ?? GONG_TIMING.complete : 350);
      });
      // Keep the ringing artwork mounted until the actual audio source ends.
      void Promise.all([strike, playback]).then(() => {
        if (!startCueActive || sequence !== startCueSequence) return;
        cancelStartCue();
        render();
      });
    }
    const action = networkStatus === 'connected' ? freshAction(view, snapshot) : null;
    if (action) cancelReferee();
    const victory = networkStatus === 'connected' ? freshVictory(view, snapshot) : null;
    if (action?.kind === 'move') sounds.playAction(action, snapshot.you, 0, teamColorForPlayer(snapshot, action.attacker.owner));
    if (view?.phase !== snapshot.phase || view?.series.matchId !== snapshot.series.matchId) {
      selected = null;
      if (confirmAction) closeModal();
    }
    view = snapshot;
    updateRefereeInactivity();
    sessionEnd = null;
    inputRoom = snapshot.roomId;
    clearPending();
    notice = '';
    if (selected !== null && snapshot.board[selected]?.owner !== snapshot.you) selected = null;
    setRoomUrl(snapshot.roomId);
    if (action && action.kind !== 'move') combat.present(action, snapshot);
    else if (victory) combat.reset();
    if (refereeCue) {
      cancelReferee();
      pendingRefereeCue = refereeCue;
    }
    render();
    if (victory && (!action || action.kind === 'move')) board.celebrate(victory);
    const latest = snapshot.log.at(-1) ?? '';
    const next = [snapshot.series.id, snapshot.series.matchId, snapshot.phase, snapshot.turnNumber, snapshot.duel?.round ?? 0, latest].join(':');
    if (next !== lastAnnouncement) {
      lastAnnouncement = next;
      el('announcement').textContent = phaseAnnouncement(snapshot) + ' ' + latest +
        (snapshot.phase === 'finished' ? ' ' + seriesAnnouncement(snapshot) : '');
    }
  },
  onProblem(message) {
    shuffleSoundPending = false;
    clearPending();
    render();
    toast(message, true);
    connection.send('sync');
  },
  onChat(state) { chat.receive(state); },
  onChatProblem(problem) { chat.problem(problem); },
  onEnded(end) {
    combat.reset();
    sessionEnd = end;
    notice = end.message;
    inputRoom = '';
    selected = null;
    clearPending();
    setRoomUrl(null);
    closeModal();
    el('announcement').textContent = end.message;
  },
});

const board = new ArenaBoard(el('board'), {
  onCell: handleCell,
  onSwap(from, to) {
    if (!view || pending || networkStatus !== 'connected' || me()?.ready ||
        (view.phase !== 'waiting' && view.phase !== 'setup')) return;
    selected = null;
    send('swap', { from, to, revision: view.revision });
  },
  onCancel() { selected = null; render(); },
  onFocus(description) { el('board-focus').textContent = description; },
});
const endgame = new EndgameOverlay(el('endgame-overlay'));
const combat = new CombatOverlay(el('combat-overlay'), {
  onBusyChange(busy) { updateBoardInteraction(); endgame.update(view, busy, currentSkin); if (!busy) announceReferee(); },
  onCelebrate(ownerId) { board.celebrate(ownerId); },
  beforeBattle() { return board.whenEffectsComplete(); },
  onBattleStart(action) {
    if (view) sounds.playAction(action, view.you, animationsPreferred && !reducedMotion.matches ? COMBAT_TIMING.shatter : 0);
  },
});
el('board').addEventListener('pointerdown', () => el('board').focus({ preventScroll: true }));

function updateBoardInteraction(): void {
  board.update(view, selected, networkStatus === 'connected' && !pending && !combat.busy && !startCueActive && !turnAnnouncementPending());
  el('board').setAttribute('aria-busy', String(combat.busy || startCueActive || turnAnnouncementPending()));
  el('board-hint').textContent = boardHint();
}

function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function savePreference(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Private browsing can disable persistence. */ }
}

function updateMotion(): void {
  const enabled = animationsPreferred && !reducedMotion.matches;
  board.setAnimationsEnabled(enabled);
  combat.setAnimationsEnabled(enabled);
  const checkbox = el<HTMLInputElement>('animations-enabled');
  checkbox.checked = enabled;
  checkbox.disabled = reducedMotion.matches;
  document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  el('motion-hint').textContent = reducedMotion.matches
    ? 'Animationen sind durch deine Systemeinstellung für reduzierte Bewegung ausgeschaltet.'
    : 'Deine Auswahl gilt für diesen Browser.';
}

function applySkin(skin: LoadedSkin): void {
  currentSkin = skin;
  cancelReferee();
  sounds.setSkin(skin);
  preloadGongArtwork(skin);
  skinPreviews.set(skin.id, skin);
  applyUiPalette(skin);
  board.setSkin(skin);
  const logo = atlasIcon(skin, skin.definition.logo, skin.definition.presentation === 'retro' ? 76 : 42);
  el('brand-emblem').classList.toggle('custom-logo', !!logo);
  el('brand-emblem').innerHTML = logo ?? icon('rock', '', 29);
  render();
}

function showSkinOptions(): void {
  // Keep the built-in escape route available even in an entirely custom catalog.
  const entries = skinCatalog.skins.some((entry) => entry.id === 'classic')
    ? skinCatalog.skins : [fallbackEntry, ...skinCatalog.skins];
  el<HTMLSelectElement>('skin-select').innerHTML = entries.map((entry) =>
    '<option value="' + esc(entry.id) + '">' + esc(entry.name) + '</option>'
  ).join('');
}

function loadSkinPreview(entry: SkinEntry): Promise<LoadedSkin> {
  let loading = skinLoads.get(entry.id);
  if (!loading) {
    loading = loadSkin(entry).then(skin => { skinPreviews.set(entry.id, skin); return skin; });
    skinLoads.set(entry.id, loading);
    // Allow a failed pack to be retried from the design menu.
    void loading.catch(() => skinLoads.delete(entry.id));
  }
  return loading;
}

function lobbyDesigns(): string {
  const entries = skinCatalog.skins.some(entry => entry.id === 'classic') ? skinCatalog.skins : [fallbackEntry, ...skinCatalog.skins];
  return '<fieldset class="lobby-designs"><legend>Dein Design</legend><div class="design-choices">' + entries.map(entry => {
    const skin = skinPreviews.get(entry.id);
    return '<button type="button" class="design-choice" id="design-' + esc(entry.id) + '" data-action="choose-skin" data-skin="' + esc(entry.id) + '" aria-pressed="' + (currentSkin.id === entry.id) + '"' + (skin ? '' : ' disabled') + '><span class="design-preview"' + (skin ? ' style="--preview-background:' + skin.definition.palette.ui.panel + ';--preview-foreground:' + skin.definition.palette.ui.own + '"' : '') + '>' + (skin ? pieceIcon(skin, 'rock', 76) : icon('unknown', '', 48)) + '</span><span>' + esc(entry.name) + '</span></button>';
  }).join('') + '</div><p class="appearance-hint">Deine Auswahl gilt für diesen Browser.</p></fieldset>';
}

async function chooseSkin(id: string): Promise<void> {
  const sequence = ++skinLoadSequence;
  const entry = skinCatalog.skins.find((candidate) => candidate.id === id);
  el('skin-status').textContent = 'Design wird geladen …';
  el('skin-select').setAttribute('aria-busy', 'true');
  try {
    const loaded = entry ? await loadSkinPreview(entry) : builtInSkin();
    if (sequence !== skinLoadSequence) return;
    applySkin(loaded);
    el<HTMLSelectElement>('skin-select').value = loaded.id;
    savePreference('rps-arena:skin', loaded.id);
    el('skin-status').textContent = 'Aktiv: ' + loaded.definition.name;
  } catch (error) {
    if (sequence !== skinLoadSequence) return;
    applySkin(builtInSkin());
    el<HTMLSelectElement>('skin-select').value = 'classic';
    savePreference('rps-arena:skin', 'classic');
    const reason = error instanceof Error ? error.message : 'Die Grafiken konnten nicht geladen werden.';
    el('skin-status').textContent = 'Arena Klassik ist aktiv. ' + reason;
    toast('Das Grafikset konnte nicht geladen werden. Arena Klassik ist aktiv. Details unter „Design“.', true);
  } finally {
    if (sequence === skinLoadSequence) el('skin-select').removeAttribute('aria-busy');
  }
}

async function initializeSkins(): Promise<void> {
  try {
    skinCatalog = await loadSkinCatalog();
    showSkinOptions();
    const saved = readPreference('rps-arena:skin');
    const wanted = saved && (saved === 'classic' || skinCatalog.skins.some((entry) => entry.id === saved))
      ? saved : skinCatalog.default;
    el<HTMLSelectElement>('skin-select').value = wanted;
    await chooseSkin(wanted);
    // Each preview uses its own decoded atlas, independent of the active design.
    void Promise.allSettled(skinCatalog.skins.map(loadSkinPreview)).then(() => { if (!view) render(); });
  } catch (error) {
    showSkinOptions();
    el('skin-status').textContent = 'Arena Klassik ist aktiv. ' + (error instanceof Error ? error.message : 'Die Designauswahl ist nicht erreichbar.');
  } finally {
    // loadSkin has decoded every used atlas; the scene must also have installed
    // its textures and painted before the hidden app becomes visible.
    await board.whenReady();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    app.inert = false;
    app.setAttribute('aria-busy', 'false');
    delete document.documentElement.dataset.startup;
    el('startup-screen')?.remove();
    if (!view) el('player-name').focus({ preventScroll: true });
    else el('board').focus({ preventScroll: true });
  }
}

el('skin-select').addEventListener('change', () => { void chooseSkin(el<HTMLSelectElement>('skin-select').value); });
el('animations-enabled').addEventListener('change', () => {
  animationsPreferred = el<HTMLInputElement>('animations-enabled').checked;
  savePreference('rps-arena:animations', animationsPreferred ? 'on' : 'off');
  updateMotion();
});
el('sounds-enabled').addEventListener('change', () => {
  soundsPreferred = el<HTMLInputElement>('sounds-enabled').checked;
  savePreference('rps-arena:sounds', soundsPreferred ? 'on' : 'off');
  sounds.setEnabled(soundsPreferred);
  if (soundsPreferred) void sounds.unlock();
});
reducedMotion.addEventListener('change', updateMotion);
compactLayout.addEventListener('change', render);
window.addEventListener('resize', fitBoardToViewport);
const layoutObserver = new ResizeObserver(fitBoardToViewport);
layoutObserver.observe(el('shell').querySelector<HTMLElement>('.app-header')!);
layoutObserver.observe(phaseControls);
document.addEventListener('pointerdown', (event) => {
  void sounds.unlock();
  if (!(event.target instanceof Node) || el('appearance-menu').contains(event.target)) return;
  el<HTMLDetailsElement>('appearance-menu').open = false;
});


function clearPending(): void {
  pending = false;
  if (pendingTimeout) clearTimeout(pendingTimeout);
  pendingTimeout = undefined;
}

function send(message: string, payload?: unknown): void {
  if (pending || networkStatus !== 'connected') return;
  pending = true;
  if (!connection.send(message, payload)) {
    shuffleSoundPending = false;
    clearPending();
    toast('Bitte warte, bis die Verbindung wiederhergestellt ist.', true);
    return;
  }
  pendingTimeout = setTimeout(() => {
    shuffleSoundPending = false;
    clearPending();
    connection.send('sync');
    render();
  }, 4000);
  render();
}

function me(): PlayerView | undefined { return view?.players.find((p) => p.id === view?.you); }
function opponent(): PlayerView | undefined { return view?.players.find((p) => p.id !== view?.you); }
function ownTeamColor(): TeamColor { return teamColorForPlayer(view, view?.you); }
function phaseTeamColor(): TeamColor | null {
  const playerId = view?.phase === 'playing' ? view.currentTurn : view?.phase === 'finished' ? view.winner : null;
  return view?.players.some((player) => player.id === playerId) ? teamColorForPlayer(view, playerId) : null;
}

function phaseAnnouncement(snapshot: Snapshot): string {
  if (snapshot.paused) return 'Die Partie pausiert, bis beide Spieler wieder verbunden sind.';
  if (snapshot.phase === 'waiting') return 'Dein Raum ist erstellt. Du kannst dein Team schon aufstellen.';
  if (snapshot.phase === 'setup') return 'Partie ' + snapshot.series.gameNumber + '. Stellt eure Figuren auf und bestätigt mit Ich bin bereit. Den ersten Zug macht ' + (snapshot.players.find((player) => player.id === snapshot.series.startingPlayer)?.name ?? 'der Startspieler') + '.';
  if (snapshot.phase === 'duel') return 'Ein verdecktes Duell beginnt. Runde ' + (snapshot.duel?.round ?? 1) + '.';
  if (snapshot.phase === 'finished') return snapshot.winner === snapshot.you ? 'Du hast die Partie gewonnen.' : snapshot.winner ? 'Die Partie ist beendet.' : 'Die Partie endet unentschieden.';
  return snapshot.currentTurn === snapshot.you ? 'Du bist am Zug.' : 'Dein Gegner ist am Zug.';
}

function handleCell(index: number): void {
  if (!view || pending || combat.busy || startCueActive || turnAnnouncementPending() || networkStatus !== 'connected' || view.paused) return;
  const piece = view.board[index];
  if (view.phase === 'setup' || view.phase === 'waiting') {
    if (me()?.ready || piece?.owner !== view.you) return;
    if (selected === null) selected = index;
    else if (selected === index) selected = null;
    else {
      const from = selected;
      selected = null;
      send('swap', { from, to: index, revision: view.revision });
      return;
    }
    render();
    return;
  }
  if (view.phase !== 'playing' || view.currentTurn !== view.you) return;
  if (selected !== null && view.legalMoves[selected]?.includes(index)) {
    const from = selected;
    selected = null;
    send('move', { from, to: index, revision: view.revision });
    return;
  }
  if (piece?.owner === view.you) {
    if (piece.kind === 'flag' || piece.kind === 'trap') {
      toast(kindName(piece.kind) + ' bleibt während der Partie auf ihrem Feld.');
      selected = null;
    } else if (!view.legalMoves[index]?.length) {
      toast('Diese Figur hat gerade kein freies Zielfeld.');
      selected = null;
    } else selected = selected === index ? null : index;
  } else selected = null;
  render();
}

function rulesCard(): string {
  const color = ownTeamColor();
  return [
    '<section class="card rules-card" data-team-color="' + color + '"><div class="card-heading"><h2>Einfaches Prinzip. Gute Taktik.</h2>' + icon('info', '', 16) + '</div><div class="rps-cycle">',
    '<div class="rule-piece">' + weaponIcon(currentSkin, 'rock', currentSkin.definition.weapons?.rock ? 44 : 29, color) + '<strong>Stein</strong><span>schlägt Schere</span></div>',
    '<div class="rule-piece">' + weaponIcon(currentSkin, 'paper', currentSkin.definition.weapons?.paper ? 44 : 29, color) + '<strong>Papier</strong><span>schlägt Stein</span></div>',
    '<div class="rule-piece">' + weaponIcon(currentSkin, 'scissors', currentSkin.definition.weapons?.scissors ? 44 : 29, color) + '<strong>Schere</strong><span>schlägt Papier</span></div></div>',
    '<p class="rule-description"><strong>Das Ziel: die gegnerische Flagge.</strong><br>Dein Team: je 4 Steine, Papiere und Scheren, eine Flagge und eine Falle.</p>',
    '<details class="rules-details"><summary>So wird gespielt</summary><p>Vor dem Start kannst du deine Figuren durch Anklicken oder Ziehen auf eine zweite eigene Figur tauschen. Wenn beide bereit sind, beginnt die Partie. Kämpfer ziehen jeweils ein Feld waagerecht oder senkrecht. Flagge und Falle bleiben stehen.</p>',
    '<p>Betrittst du ein gegnerisches Feld, werden beide Figuren aufgedeckt. Das stärkere Symbol gewinnt. Gleiche Symbole lösen ein verdecktes Stein-Papier-Schere-Duell aus. Bei Gleichstand wählt ihr erneut; die Figuren übernehmen den gewählten Typ.</p>',
    '<p>Eine Falle entfernt ihren Angreifer und bleibt auf dem Feld. Wer die gegnerische Flagge erobert oder seinem Gegner keinen Zug mehr lässt, gewinnt. Nach 300 Zügen endet die Partie unentschieden. ' + (currentSkin.definition.presentation === 'retro' ? 'Bereits aufgedeckte Waffen bleiben an den Figuren sichtbar.' : 'Der kleine Punkt zeigt eine bereits aufgedeckte Figur.') + '</p></details></section>',
  ].join('');
}

function lobbyMarkup(): string {
  const busy = networkStatus === 'connecting' || networkStatus === 'reconnecting' || networkStatus === 'connected';
  const disabled = busy ? ' disabled' : '';
  return [
    '<span class="version lobby-version">v' + esc(__APP_VERSION__) + '</span><section class="lobby-card"><div class="lobby-logo" aria-label="RPS Arena">' + (atlasIcon(currentSkin, currentSkin.definition.logo, currentSkin.definition.presentation === 'retro' ? 148 : 64) ?? icon('rock', '', 48)) + '<span>RPS ARENA</span></div><div class="lobby-intro"><p class="eyebrow">NAME → RAUM → AUFSTELLUNG → DUELL</p><h1 class="lobby-title">Deine nächste Partie.</h1>',
    '<p class="body-copy">' + (sessionEnd ? 'Die vorige Partie ist beendet. Erstelle eine neue Partie oder tritt einem anderen Raum bei.' : inputRoom ? 'Du hast einen Raumcode. Gib deinen Namen ein und tritt der Partie bei.' : 'Erstelle eine Partie und lade jemanden über deinen Link ein.') + '</p></div>',
    '<label class="field lobby-name"><span>Dein Spielername</span><input id="player-name" name="player-name" autocomplete="nickname" placeholder="Wie heißt du?" maxlength="24" aria-describedby="name-hint" value="' + esc(name) + '"' + disabled + ' /><small class="input-hint" id="name-hint">Mit diesem Namen spielst du. Kein Konto nötig.</small></label><div class="lobby-options' + (inputRoom ? ' has-invitation' : '') + '">',
    '<form id="create-form"><h2>Neuen Raum erstellen</h2>',
    '<label class="field series-mode-field"><span>Spielmodus für deinen neuen Raum</span><select id="series-mode" name="series-mode" aria-describedby="series-mode-hint"' + disabled + '>' + (['free', 'best-of-3', 'best-of-5'] as const).map((mode) => '<option value="' + mode + '"' + (mode === seriesMode ? ' selected' : '') + '>' + seriesModeLabel(mode) + (mode === 'free' ? ' – Siege weiterzählen' : mode === 'best-of-3' ? ' – zuerst 2 Siege' : ' – zuerst 3 Siege') + '</option>').join('') + '</select><small class="input-hint" id="series-mode-hint">' + seriesModeDescription(seriesMode) + '</small></label>',
    '<button class="' + (inputRoom ? 'secondary-button' : 'primary-button') + ' full-width action-button" type="submit" id="create-button"' + disabled + '>' + (busy ? '<span class="spinner" aria-hidden="true"></span> Verbinde …' : (sessionEnd ? 'Neue Partie erstellen ' : 'Raum erstellen ') + icon('arrow', 'button-arrow', 18)) + '</button></form>',
    '<form class="join-form" id="join-form"><h2>Du hast eine Einladung?</h2><label class="field join-field"><span>Raumcode oder Einladungslink</span><input id="room-input" name="room-code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Code oder Link einfügen" aria-describedby="join-hint" value="' + esc(inputRoom) + '"' + disabled + ' /><small class="input-hint" id="join-hint">Der Spielmodus ist bereits vom Raum vorgegeben.</small></label>',
    '<button class="' + (inputRoom ? 'primary-button' : 'secondary-button') + ' full-width action-button" type="submit" id="join-button"' + disabled + '>' + (busy ? '<span class="spinner" aria-hidden="true"></span> Verbinde …' : icon('link', '', 16) + 'Raum beitreten') + '</button></form></div>',
    '<p class="trust-note">' + icon('check', '', 13) + 'Danach stellst du dein Team auf. Wenn beide bereit sind, beginnt die Partie.</p>',
    '<div class="lobby-notice" role="alert"' + (!notice ? ' hidden' : '') + '>' + esc(notice) + '</div><details class="lobby-rules" id="lobby-rules"><summary>So wird gespielt</summary>' + rulesCard() + '</details>' + lobbyDesigns() + legalFooter + '</section>',
  ].join('');
}

function playerMarkup(player: PlayerView | undefined, own: boolean): string {
  const color = teamColorForPlayer(view, player?.id, own ? ownTeamColor() : otherTeamColor(ownTeamColor()));
  if (!player) return '<div class="player-row enemy empty"><span class="player-avatar">' + pieceIcon(currentSkin, 'unknown', 23, 'enemy', false, color) + '</span><div class="player-info"><p class="player-name">' + (networkStatus === 'ended' ? 'Kein Mitspieler' : 'Platz noch frei') + '</p><p class="player-state">' + (networkStatus === 'ended' ? 'Partie beendet.' : 'Teile deinen Einladungslink.') + '</p></div><span class="waiting-dots" aria-hidden="true">···</span></div>';
  const active = view?.currentTurn === player.id && view?.phase === 'playing';
  const preparing = view?.phase === 'waiting' || view?.phase === 'setup';
  const ended = networkStatus === 'ended';
  let status = ended ? 'Partie beendet' : !player.connected ? 'Verbindung unterbrochen' : preparing ? player.ready ? 'Bereit für die Partie' : 'Stellt das Team auf' : active ? 'Am Zug' : view?.phase === 'finished' ? player.newSeriesRequested ? 'Möchte eine neue Serie' : player.restartRequested ? 'Bereit für die nächste Partie' : 'Partie beendet' : 'Verbunden';
  if (view?.phase === 'duel' && player.connected && !ended) status = view.duel?.choiceLocked[player.id] ? 'Wahl verdeckt abgegeben' : 'Wählt im Duell';
  const connected = player.connected && !ended;
  const marker = connected && player.ready && preparing ? icon('check', 'ready-icon', 17) : '<span class="status-dot ' + (connected ? '' : 'offline') + '" aria-label="' + (connected ? 'Verbunden' : 'Getrennt') + '"></span>';
  return '<div class="player-row ' + (own ? '' : 'enemy') + '" data-team-color="' + color + '"><span class="player-avatar">' + pieceIcon(currentSkin, own ? 'flag' : 'unknown', 23, own ? 'own' : 'enemy', false, color) + '</span><div class="player-info"><p class="player-name">' + esc(player.name) + (own ? '<span class="player-you">du</span>' : '') + '</p><p class="player-state">' + teamColorName(color) + ' · ' + status + '</p></div>' + marker + '</div>';
}

function scrollToGameElement(id: string): void {
  const target = el(id);
  target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  (id === 'room-chat' ? el('chat-input') : el('board')).focus({ preventScroll: true });
}

function hideChatNotice(): void {
  if (chatNoticeLeaving) return;
  clearTimeout(chatNoticeTimer);
  const bubble = el('board-chat-notices').querySelector<HTMLElement>('.board-chat-bubble');
  chatNoticeOpacity = bubble ? getComputedStyle(bubble).opacity : '.9';
  chatNoticeLeaving = true;
  paintChatNotice();
  chatNoticeExitTimer = setTimeout(() => {
    chatNotices.clear();
    chatNoticeLeaving = false;
    paintChatNotice();
  }, 1000);
}

function fitBoardToViewport(): void {
  if (!view) return;
  const top = el('board').getBoundingClientRect().top + window.scrollY;
  const available = Math.max(120, Math.floor(window.innerHeight - top - 14));
  const shell = el('shell');
  if (shell.style.getPropertyValue('--board-max-height') !== available + 'px') {
    shell.style.setProperty('--board-max-height', available + 'px');
  }
}

function paintChatNotice(): void {
  const notices = view && chatNoticeRoom === view.roomId ? [...chatNotices.values()].filter(message => message.playerId !== view?.you) : [];
  const markup = notices.map(message => {
    const text = chatBubbleText(message.text);
    const color = teamColorForPlayer(view, message.playerId);
    return '<button type="button" class="board-chat-bubble' + (text ? ' has-text' : '') + (chatNoticeLeaving ? ' is-leaving' : '') + '" style="--bubble-start-opacity:' + chatNoticeOpacity + '" data-message-id="' + message.id + '" data-action="dismiss-chat" data-player-id="' + esc(message.playerId) + '" data-position="top" data-team-color="' + color + '" aria-label="' + esc(message.playerName + ': ' + (text ?? 'Neue Chatnachricht') + ' – zum Chat springen und Sprechblase ausblenden') + '" title="Nachricht im Chat lesen"><strong class="bubble-sender">' + esc(message.playerName) + '</strong>' + (text ? '<span class="bubble-text">' + esc(text) + '</span>' : (atlasIcon(currentSkin, currentSkin.definition.chatNotice, 56) ?? icon('chat', '', 36))) + '</button>';
  }).join('');
  // Do not replace the focused button or repeat live announcements on every game render.
  const root = el('board-chat-notices');
  if (renderedChatNotice !== markup) { root.innerHTML = markup; renderedChatNotice = markup; }
}

function refereeMarkup(size: number): string {
  if (refereeInactivity.yawning && view && !view.paused && (view.phase === 'playing' || view.phase === 'duel')) {
    const animated = animationsPreferred && !reducedMotion.matches;
    const image = animated ? '<img class="referee-yawn" src="' + esc(skinAssetUrl(currentSkin, 'yawn.svg')) + '?play=' + yawnSequence + '" width="' + size + '" height="' + size * .75 + '" alt="" />' : atlasIcon(currentSkin, 'referee-yawn', size);
    return '<span class="referee-portrait" data-referee-state="yawn" role="img" aria-label="Der Schiedsrichter gähnt">' + image + '</span>';
  }
  if (view && (startCueActive || view.phase === 'waiting' || view.phase === 'setup' || view.phase === 'finished')) {
    if (startCueActive && size > 76) size = Math.round(size * 1.2);
    const animated = startCueActive && animationsPreferred && !reducedMotion.matches;
    const resting = !animated && atlasIcon(currentSkin, 'gong-idle', size);
    const image = resting ? '<span class="gong-scene" data-gong-style="' + currentSkin.id + '" data-animated="false">' + resting + '</span>' : gongMarkup(currentSkin, size, animated, startCueSequence);
    return '<span class="referee-portrait" data-referee-state="gong" role="img" aria-label="' + (startCueActive ? 'Die Partie beginnt: Gongschlag' : view.phase === 'finished' ? 'Gong: Partie beendet' : 'Gong: Bereit für den Spielbeginn') + '">' + image + '</span>';
  }
  const state = refereePortrait(currentSkin.definition, refereeView());
  const image = atlasIcon(currentSkin, state.frame, size);
  if (!image) return '';
  return '<span class="referee-portrait" role="group" aria-label="' + esc(state.label) + '" title="' + esc(state.label) + '" data-turn-team="' + (state.team ?? 'neutral') + '" data-turn-direction="' + (state.direction ?? 'neutral') + '">' + image + '</span>';
}

function phaseSection(label: string, title: string, copy: string, controls = '', classes = ''): string {
  const color = phaseTeamColor();
  const referee = view ? refereeMarkup(180) : '';
  const showTurnWithReferee = !compactLayout.matches && referee.includes('class="referee-portrait"') && view?.phase === 'playing' && !view.paused && networkStatus === 'connected';
  const heading = showTurnWithReferee
    ? '<h2 class="phase-referee-turn" aria-label="' + esc(title) + '">' + referee + '</h2>'
    : '<h2>' + esc(title) + '</h2>' + (referee ? '<div class="phase-referee">' + referee + '</div>' : '');
  return '<section class="card phase-card ' + classes + '"' + (color ? ' data-team-color="' + color + '"' : '') + '><p class="phase-label">' + label + '</p>' + heading + '<p class="body-copy">' + esc(copy) + '</p>' + controls + '</section>';
}

function phaseCard(): string {
  if (!view) return '';
  const own = me();
  const other = opponent();
  const disabled = pending || networkStatus !== 'connected' ? ' disabled' : '';
  if (networkStatus === 'ended' && sessionEnd) {
    return phaseSection('PARTIE BEENDET', sessionEnd.reason === 'server_shutdown' ? 'Der Server startet neu.' : 'Dieser Raum ist beendet.', sessionEnd.message,
      '<div class="button-row"><button class="primary-button" data-action="new-game" id="new-game-button">Neue Partie</button><button class="secondary-button" data-action="leave" id="ended-lobby-button">Zur Lobby</button></div>', 'paused');
  }
  if (networkStatus === 'disconnected' || networkStatus === 'idle') {
    return phaseSection('VERBINDUNG BEENDET', 'Die Arena ist nicht erreichbar.', 'Versuche, in deine Partie zurückzukehren. Eine unterbrochene Sitzung bleibt bis zu ' + view.reconnectSeconds + ' Sekunden reserviert.', '<div class="button-row"><button class="primary-button" data-action="retry" id="retry-button">Erneut verbinden</button></div>', 'paused');
  }
  if (networkStatus === 'reconnecting') return phaseSection('<span class="spinner" aria-hidden="true"></span> VERBINDE ERNEUT', 'Eine kurze Pause.', 'Deine Verbindung wird wiederhergestellt. Der Server hält deinen Platz bis zu ' + view.reconnectSeconds + ' Sekunden frei.', '', 'paused');
  if (view.paused) return phaseSection('PARTIE PAUSIERT', 'Wir warten kurz.', (other?.name ?? 'Dein Gegner') + ' hat die Verbindung verloren. Sobald beide wieder da sind, geht es weiter.', '', 'paused');
  if (view.phase === 'waiting' || view.phase === 'setup') {
    const copy = own?.ready ? other ? 'Deine Aufstellung steht. Die Partie beginnt, sobald dein Gegner ebenfalls bereit ist.' : 'Dein Team ist aufgestellt. Lade deinen Gegner über den Link ein.' : selected !== null ? kindName(view.board[selected]?.kind ?? null) + ' auf ' + coordinate(selected) + ' ausgewählt. Klicke eine zweite eigene Figur an, um die Plätze zu tauschen.' : 'Tausche zwei eigene Figuren durch Anklicken oder Ziehen. Oder mische dein Team neu, bis die Aufstellung passt.';
    const lock = own?.ready ? ' disabled' : disabled;
    return phaseSection('01 / AUFSTELLUNG', own?.ready ? 'Du bist bereit.' : 'Dein Plan. Dein Team.', copy,
      '<div class="button-row"><button class="secondary-button" data-action="shuffle" id="shuffle-button"' + lock + '>' + icon('shuffle', '', 16) + 'Mischen</button><button class="primary-button" data-action="ready" id="ready-button"' + lock + '>' + icon('check', '', 16) + (own?.ready ? 'Bereit' : 'Ich bin bereit') + '</button></div>');
  }
  if (view.phase === 'duel' && view.duel) {
    const duel = view.duel;
    const locked = duel.choiceLocked[view.you] === true;
    return phaseSection('DUELL / RUNDE ' + duel.round, duel.round > 1 ? 'Noch einmal. Ganz geheim.' : 'Gleiche Figur. Neues Duell.', locked ? 'Deine Wahl bleibt verborgen, bis dein Gegner ebenfalls gewählt hat.' : 'Wähle Stein, Papier oder Schere. Beide Entscheidungen werden gleichzeitig aufgedeckt.',
      '<p class="duel-confirmation">' + icon(locked ? 'check' : 'unknown', '', 13) + (locked ? 'Deine Auswahl ist gespeichert.' : 'Die Waffenwahl findest du direkt über dem Spielfeld.') + '</p>');
  }
  if (view.phase === 'finished') {
    const won = view.winner === view.you;
    let reason = 'Diese Partie ist entschieden.';
    if (view.finishReason === 'flag') reason = won ? 'Du hast die gegnerische Flagge erobert. Gut gespielt.' : 'Deine Flagge wurde erobert.';
    if (view.finishReason === 'resign') reason = won ? 'Dein Gegner hat die Partie aufgegeben.' : 'Du hast diese Partie aufgegeben.';
    if (view.finishReason === 'no_moves') reason = won ? 'Dein Gegner hat keinen gültigen Zug mehr.' : 'Dein Team hat keinen gültigen Zug mehr.';
    if (view.finishReason === 'turn_limit') reason = 'Nach 300 Zügen endet diese Partie unentschieden.';
    const seriesFinished = view.series.winner !== null;
    const title = seriesFinished ? seriesWinnerText(view) : view.winner === null ? 'Unentschieden.' : won ? 'Du gewinnst die Partie.' : (other?.name ?? 'Dein Gegner') + ' gewinnt.';
    const guard = ' data-series-id="' + esc(view.series.id) + '" data-match-id="' + esc(view.series.matchId) + '"';
    const nextButton = seriesFinished ? '' : '<button class="primary-button" data-action="restart" id="restart-button"' + guard + (own?.restartRequested || !other?.connected ? ' disabled' : disabled) + '>' + icon('refresh', '', 16) + (own?.restartRequested ? 'Nächste Partie angefragt …' : 'Nächste Partie') + '</button>';
    const newButton = '<button class="' + (seriesFinished ? 'primary-button' : 'secondary-button') + '" data-action="new-series" id="new-series-button"' + guard + (own?.newSeriesRequested || !other?.connected ? ' disabled' : disabled) + '>' + (own?.newSeriesRequested ? 'Neue Serie angefragt …' : 'Neue Serie (0 : 0)') + '</button>';
    const hint = seriesFinished
      ? 'Eine neue Serie beginnt im selben Modus bei 0 : 0. Der erste Zug wechselt zum anderen Spieler.'
      : '„Nächste Partie“ zählt eure Siege weiter. „Neue Serie“ setzt den Stand gemeinsam auf 0 : 0. Der erste Zug wechselt bei jeder Partie.';
    return phaseSection(seriesFinished ? 'SERIE ENTSCHIEDEN' : 'PARTIE ' + view.series.gameNumber + ' BEENDET', title, reason,
      '<div class="series-controls">' + nextButton + newButton + '</div><p class="series-vote-status" role="status">' + esc(seriesVoteStatus(view)) + '</p><p class="series-control-hint">' + hint + '</p>');
  }
  const yourTurn = view.currentTurn === view.you;
  const copy = yourTurn ? selected !== null ? kindName(view.board[selected]?.kind ?? null) + ' auf ' + coordinate(selected) + ' ausgewählt. Ziehe auf eines der markierten Felder.' : 'Wähle eine bewegliche Figur. Die Zielmarkierungen zeigen dir ihre möglichen Ziele.' : 'Behalte die aufgedeckten Figuren im Blick und plane deinen nächsten Zug.';
  return phaseSection('02 / ZUG ' + (view.turnNumber + 1), yourTurn ? 'Du bist am Zug.' : (other?.name ?? 'Dein Gegner') + ' ist am Zug.', copy);
}

function gameMarkup(): string {
  if (!view) return '';
  const recent = view.log.slice(-4).reverse();
  const older = view.log.slice(0, -4).reverse();
  const connected = networkStatus === 'connected';
  const ended = networkStatus === 'ended';
  const connectionLabel = connected ? 'VERBUNDEN' : ended ? 'BEENDET' : networkStatus === 'reconnecting' || networkStatus === 'connecting' ? 'VERBINDE …' : 'GETRENNT';
  const preparing = view.phase === 'waiting' || view.phase === 'setup';
  return [
    '<details class="game-details" id="room-details"' + (preparing ? ' open' : '') + '><summary>Raum & Mitspieler · ' + connectionLabel + '</summary>',
    '<section class="card room-card"><div class="card-heading"><p class="eyebrow">PRIVATER RAUM</p><span class="pill ' + (connected ? 'accent' : 'orange') + '">' + connectionLabel + '</span></div>',
    '<div class="room-code-row"><code class="room-code" title="Raumcode">' + esc(view.roomId) + '</code><button class="icon-button" data-action="copy" id="copy-button" aria-label="Einladungslink kopieren" title="Einladungslink kopieren"' + (ended ? ' disabled' : '') + '>' + icon('copy', '', 17) + '</button></div>',
    '<p class="room-help">' + (ended ? 'Dieser Raum ist beendet. Starte eine neue Partie.' : 'Kopiere den Link und lade deinen Mitspieler ein.') + '</p><div class="players">' + playerMarkup(me(), true) + playerMarkup(opponent(), false) + '</div></section>',
    '</details><details class="game-details" id="game-history"><summary>Spielverlauf</summary>',
    '<section class="card history-card"><div class="card-heading"><h2>' + (ended ? 'Die letzte Partie' : 'Was gerade passiert') + '</h2><span class="eyebrow">' + (ended ? 'VERLAUF' : 'LIVE') + '</span></div><ol class="move-log">' + (recent.length ? recent.map((entry) => '<li>' + esc(entry) + '</li>').join('') : '<li>Deine Arena wartet auf den ersten Zug.</li>') + '</ol>' + (older.length ? '<details class="history-details"><summary id="history-toggle">Ältere Ereignisse (' + older.length + ')</summary><p>Die letzten 100 Ereignisse dieser Partie. Neueste zuerst.</p><ol class="move-log history-scroll" id="history-scroll" tabindex="0" aria-label="Ältere Spielereignisse">' + older.map((entry) => '<li>' + esc(entry) + '</li>').join('') + '</ol></details>' : '') + '</section>',
    '</details><details class="game-details" id="game-rules"><summary>Spielregeln</summary>' + rulesCard() + '</details>',
    '<div class="game-actions"><button class="secondary-button full-width lobby-return-button" data-action="leave" id="leave-button">' + icon('leave', '', 20) + 'Zur Lobby</button>',
    !ended && (view.phase === 'playing' || view.phase === 'duel') ? '<button class="secondary-button full-width lobby-return-button" data-action="resign" id="resign-button"' + (!connected || pending ? ' disabled' : '') + '>' + icon('leave', '', 20) + 'Partie aufgeben ' + '</button>' : '',
    '</div>',
  ].join('');
}

function boardHint(): string {
  if (turnAnnouncementPending()) return 'Zug wird beendet. Der Schiedsrichter zeigt gleich den nächsten Spieler an.';
  if (!view) return 'Erstelle oder betrete einen Raum.';
  if (networkStatus === 'ended') return 'Diese Partie ist beendet.';
  if (pending) return 'Zug wird bestätigt …';
  if (view.paused || networkStatus !== 'connected') return 'Die Partie pausiert.';
  if (combat.busy) return 'Der Kampf wird aufgedeckt …';
  if (view.phase === 'waiting' || view.phase === 'setup') return me()?.ready ? 'Deine Aufstellung steht.' : selected !== null ? 'Zweite eigene Figur wählen.' : 'Zwei Figuren zum Tauschen wählen.';
  if (view.phase === 'playing') return view.currentTurn === view.you ? selected !== null ? 'Ein markiertes Ziel wählen.' : 'Wähle eine eigene Figur.' : 'Dein Gegner ist am Zug.';
  return view.phase === 'duel' ? 'Wähle deine Waffe über dem Spielfeld.' : view.series.winner ? 'Die Serie ist entschieden.' : 'Gemeinsam die nächste Partie starten.';
}

const renderedMarkup = new WeakMap<HTMLElement, string>();
function replaceMarkup(target: HTMLElement, markup: string): void {
  if (!mobileGraphics() || renderedMarkup.get(target) !== markup) {
    target.innerHTML = markup;
    if (mobileGraphics()) renderedMarkup.set(target, markup);
  }
}

function render(): void {
  if (chatNoticeRoom !== view?.roomId) {
    chatNoticeRoom = null; chatNotices.clear(); clearTimeout(chatNoticeTimer); clearTimeout(chatNoticeExitTimer); chatNoticeLeaving = false;
  }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusId = active?.closest('#sidebar, #phase-controls, #lobby-overlay') ? active.id : '';
  const selection = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
  const wasLobby = !el('lobby-overlay').hidden;
  const openDetails = new Map(Array.from(app.querySelectorAll<HTMLDetailsElement>('.game-details, .lobby-rules')).map(detail => [detail.id, detail.open]));
  const detailsOpen = el('sidebar').querySelector<HTMLDetailsElement>('.rules-details')?.open;
  const historyOpen = el('sidebar').querySelector<HTMLDetailsElement>('.history-details')?.open;
  el('shell').classList.toggle('game-mode', !!view);
  el('shell').classList.toggle('lobby-mode', !view);
  el('shell').classList.toggle('compact-game', !!view && compactLayout.matches);
  el('shell').classList.toggle('active-match', !!view && (view.phase === 'playing' || view.phase === 'duel'));
  el('match-sidebar').hidden = !view;
  el('shell').querySelector<HTMLElement>('.app-header')!.inert = !view;
  el('shell').querySelector<HTMLElement>('.play-panel')!.inert = !view;
  document.body.classList.toggle('lobby-open', !view);
  el('lobby-overlay').hidden = !!view;
  el('board').inert = !view;
  const topHost = el('phase-top-host');
  topHost.hidden = !view || !compactLayout.matches;
  phaseSidebarHost.hidden = !view || compactLayout.matches;
  const phaseHost = compactLayout.matches ? topHost : phaseSidebarHost;
  if (phaseControls.parentElement !== phaseHost) phaseHost.append(phaseControls);
  replaceMarkup(phaseControls, view ? phaseCard() : '');
  replaceMarkup(el('sidebar'), view ? gameMarkup() : '');
  replaceMarkup(el('lobby-overlay'), view ? '' : lobbyMarkup());
  if (!view && inputRoom) {
    const options = app.querySelector('.lobby-options');
    options?.prepend(el('join-form'));
  }
  for (const detail of app.querySelectorAll<HTMLDetailsElement>('.game-details, .lobby-rules')) {
    if (openDetails.has(detail.id)) detail.open = openDetails.get(detail.id)!;
  }
  // Invitation controls are useful during setup; collapse them when play begins.
  if (el('shell').dataset.phase !== view?.phase && view && (view.phase === 'playing' || view.phase === 'duel')) {
    el<HTMLDetailsElement>('room-details').open = false;
  }
  el('shell').dataset.phase = view?.phase ?? 'lobby';
  if (detailsOpen) {
    const rules = el('sidebar').querySelector<HTMLDetailsElement>('.rules-details');
    if (rules) rules.open = true;
  }
  const historyDetails = el('sidebar').querySelector<HTMLDetailsElement>('.history-details');
  if (historyOpen && historyDetails) {
    historyDetails.open = true;
  }
  if (focusId) {
    const next = el<HTMLInputElement>(focusId);
    next?.focus({ preventScroll: true });
    if (selection && next instanceof HTMLInputElement) next.setSelectionRange(selection[0], selection[1]);
  } else if (!view && (!wasLobby || active === document.body)) {
    el('player-name').focus({ preventScroll: true });
  } else if (view && wasLobby) {
    el('board').focus({ preventScroll: true });
  }
  el('preview-banner').hidden = true;
  const referee = refereePortrait(currentSkin.definition, refereeView());
  const headerReferee = '<div class="score-referee">' + (refereeMarkup(76) || icon('info', '', 28)) + '<span>' + esc(startCueActive ? 'Die Partie beginnt' : referee.caption) + '</span></div>';
  const scores = view ? seriesScoreMarkup(view, headerReferee) : '';
  el('series-scoreboard').hidden = !view;
  if (el('series-scoreboard').innerHTML !== scores) {
    el('series-scoreboard').innerHTML = scores;
  }
  const seriesInfo = view ? seriesInfoMarkup(view) : '';
  if (el('series-info').innerHTML !== seriesInfo) el('series-info').innerHTML = seriesInfo;
  const paused = networkStatus === 'reconnecting' || networkStatus === 'disconnected' || networkStatus === 'ended';
  replaceMarkup(el('header-note'), '<span class="status-dot ' + (paused ? 'offline' : '') + '"></span>' + (networkStatus === 'ended' ? 'PARTIE BEENDET' : view ? networkStatus === 'connected' ? 'VERBUNDEN' : 'VERBINDUNG PAUSIERT' : 'PRIVATE PARTIEN'));
  el('page-title').textContent = view ? networkStatus === 'ended' ? 'Diese Partie ist beendet.' : view.phase === 'waiting' || view.phase === 'setup' ? 'Die Aufstellung zählt.' : view.phase === 'finished' ? view.series.winner ? 'Die Serie ist entschieden.' : 'Die Partie ist entschieden.' : 'Jeder Zug zählt.' : 'Dein Zug beginnt hier.';
  el('page-eyebrow').textContent = view ? 'DEINE PRIVATE ARENA' : 'DAS TAKTISCHE DUELL FÜR ZWEI';
  replaceMarkup(el('page-subtitle'), view ? 'Ein Plan. Ein Gegner.<br>Und eine Flagge.' : 'Figuren verdecken.<br>Gedanken lesen. Flagge holen.');
  const badge = el('board-phase');
  badge.className = 'pill accent';
  delete badge.dataset.teamColor;
  if (!view) badge.textContent = 'DEINE ARENA';
  else if (networkStatus === 'ended') { badge.textContent = 'BEENDET'; badge.className = 'pill orange'; }
  else if (networkStatus !== 'connected' || view.paused) { badge.textContent = 'PAUSE'; badge.className = 'pill orange'; }
  else if (view.phase === 'setup' || view.phase === 'waiting') badge.textContent = 'AUFSTELLUNG';
  else if (view.phase === 'finished') {
    badge.textContent = 'BEENDET';
    const color = phaseTeamColor();
    if (color) { badge.className = 'pill team-pill'; badge.dataset.teamColor = color; }
  }
  else if (view.phase === 'duel') { badge.textContent = 'DUELL · RUNDE ' + view.duel?.round; badge.className = 'pill orange'; }
  else {
    badge.textContent = 'ZUG ' + (view.turnNumber + 1);
    const color = phaseTeamColor();
    if (color) { badge.className = 'pill team-pill'; badge.dataset.teamColor = color; }
  }
  const ownColor = ownTeamColor();
  const enemyColor = teamColorForPlayer(view, opponent()?.id, otherTeamColor(ownColor));
  el('own-team-key').dataset.teamColor = ownColor;
  el('enemy-team-key').dataset.teamColor = enemyColor;
  el('own-count').textContent = view ? 'Dein Team · ' + teamColorName(ownColor) + ' · ' + view.board.filter((p) => p?.owner === view?.you).length : 'Dein Team';
  el('enemy-count').textContent = view ? 'Gegner · ' + teamColorName(enemyColor) + ' · ' + view.board.filter((p) => p && p.owner !== view?.you).length : 'Gegner';
  el('board-hint').textContent = boardHint();
  el('notice').hidden = !notice || !view;
  replaceMarkup(el('notice'), notice ? icon('info', '', 17) + '<span class="notice-content">' + esc(notice) + '</span><button class="notice-button" data-action="dismiss-notice" aria-label="Hinweis schließen">' + icon('close', '', 12) + '</button>' : '');
  chat.updateSession(view, networkStatus === 'connected');
  paintChatNotice();
  combat.update(view, currentSkin, { connected: networkStatus === 'connected', pending });
  endgame.update(view, combat.busy, currentSkin);
  announceReferee();
  updateBoardInteraction();
  fitBoardToViewport();
}

function toast(message: string, error = false): void {
  const target = el('toast');
  target.textContent = message;
  target.className = 'toast visible' + (error ? ' error' : '');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => target.classList.remove('visible'), error ? 6500 : 3800);
}

function setRoomUrl(roomCode: string | null): void {
  const url = new URL(location.href);
  if (roomCode) url.searchParams.set('room', roomCode);
  else url.searchParams.delete('room');
  if (url.href !== location.href) history.replaceState(null, '', url);
}

function playerName(): string | null {
  name = (el<HTMLInputElement>('player-name')?.value ?? name).trim();
  if (!name) { toast('Gib bitte zuerst deinen Spielernamen ein.', true); el('player-name').focus({ preventScroll: true }); return null; }
  writeSession('rps-arena:name', name);
  return name;
}

async function begin(action: 'create' | 'join'): Promise<void> {
  if (networkStatus !== 'idle' && networkStatus !== 'disconnected' && networkStatus !== 'ended') return;
  const chosenName = playerName();
  if (!chosenName) return;
  inputRoom = el<HTMLInputElement>('room-input').value.trim();
  const code = roomCodeFrom(inputRoom);
  if (action === 'join' && !code) {
    toast('Füge einen gültigen Raumcode oder Einladungslink ein. Groß- und Kleinschreibung bleiben erhalten.', true);
    el('room-input').focus({ preventScroll: true });
    return;
  }
  notice = '';
  try {
    if (action === 'create') {
      shuffleSoundPending = true;
      seriesMode = readSeriesMode(el<HTMLSelectElement>('series-mode')?.value ?? seriesMode);
      savePreference('rps-arena:series-mode', seriesMode);
      await connection.create(chosenName, seriesMode);
    }
    else if (connection.hasSavedSession(code)) await connection.resume(code);
    else {
      shuffleSoundPending = true;
      await connection.join(code, chosenName);
    }
  } catch (error) { shuffleSoundPending = false; notice = error instanceof Error ? error.message : 'Die Verbindung konnte nicht hergestellt werden.'; render(); }
}

async function copyInvitation(): Promise<void> {
  if (!view || networkStatus === 'ended') return;
  const url = new URL(location.href);
  url.searchParams.set('room', view.roomId);
  url.hash = '';
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url.href);
    else {
      const field = document.createElement('textarea');
      field.value = url.href;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Clipboard unavailable');
    }
    toast('Einladungslink kopiert. Dein Mitspieler kann direkt beitreten.');
  } catch { showLinkDialog(url.href); }
}

function showLinkDialog(link: string): void {
  lastModalFocus = document.activeElement as HTMLElement | null;
  el('modal-root').innerHTML = '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">Dein Einladungslink</h2><p>Markiere den Link und kopiere ihn für deinen Mitspieler.</p><label class="field"><span>Link zur Partie</span><input id="share-link" readonly value="' + esc(link) + '" /></label><div class="button-row"><button class="primary-button" data-action="cancel-modal">Fertig</button></div></section></div>';
  const field = el<HTMLInputElement>('share-link');
  field.focus({ preventScroll: true });
  field.select();
}

function confirm(title: string, text: string, label: string, action: () => void): void {
  lastModalFocus = document.activeElement as HTMLElement | null;
  confirmAction = action;
  el('modal-root').innerHTML = '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><h2 id="modal-title">' + esc(title) + '</h2><p id="modal-description">' + esc(text) + '</p><div class="button-row"><button class="secondary-button" data-action="cancel-modal" id="cancel-modal">Abbrechen</button><button class="primary-button danger-button" data-action="confirm-modal">' + esc(label) + '</button></div></section></div>';
  el('cancel-modal').focus({ preventScroll: true });
}

function closeModal(): void {
  confirmAction = null;
  el('modal-root').innerHTML = '';
  if (lastModalFocus?.isConnected) lastModalFocus.focus({ preventScroll: true });
}

async function leaveRoom(): Promise<void> {
  view = null;
  combat.reset();
  sessionEnd = null;
  selected = null;
  inputRoom = '';
  notice = '';
  clearPending();
  setRoomUrl(null);
  try { await connection.leave(); } catch { /* A closed socket must not prevent the local lobby. */ }
  render();
}

function requestLeave(): void {
  if (!view) return;
  const playing = networkStatus !== 'ended' && (view.phase === 'playing' || view.phase === 'duel');
  const preparing = networkStatus !== 'ended' && (view.phase === 'waiting' || view.phase === 'setup');
  confirm('Zur Lobby zurück?', playing
    ? 'Bist du sicher? Du brichst die aktuelle Partie ab. Dein Gegner gewinnt.'
    : preparing ? 'Bist du sicher? Du verlässt den Raum und brichst die aktuelle Spielvorbereitung ab.'
    : 'Bist du sicher? Du verlässt diesen Raum.', 'Zur Lobby', () => {
      if (playing) connection.send('resign');
      void leaveRoom();
    });
}

async function newGame(): Promise<void> {
  const chosenName = (me()?.name ?? name).trim();
  seriesMode = view?.series.mode ?? seriesMode;
  await leaveRoom();
  name = chosenName;
  if (!chosenName) { el('player-name').focus({ preventScroll: true }); return; }
  writeSession('rps-arena:name', chosenName);
  try { shuffleSoundPending = true; await connection.create(chosenName, seriesMode); }
  catch (error) { shuffleSoundPending = false; notice = error instanceof Error ? error.message : 'Der neue Raum konnte nicht erstellt werden. Bitte versuche es erneut.'; render(); }
}

async function retry(): Promise<void> {
  const code = view?.roomId ?? inputRoom;
  if (!code || !connection.hasSavedSession(code)) {
    await leaveRoom();
    notice = 'Deine vorige Sitzung ist nicht mehr verfügbar. Erstelle eine neue Partie oder tritt mit einem neuen Link bei.';
    render();
    return;
  }
  try { await connection.resume(code); }
  catch (error) { notice = error instanceof Error ? error.message : 'Die Sitzung konnte nicht wiederhergestellt werden.'; render(); }
}

app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id === 'create-form' || form.id === 'join-form') { event.preventDefault(); void begin(form.id === 'create-form' ? 'create' : 'join'); }
});
app.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'player-name') { name = input.value; writeSession('rps-arena:name', name); }
  if (input.id === 'room-input') inputRoom = input.value;
});
app.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.target as HTMLElement).id === 'player-name') {
    event.preventDefault();
    void begin(inputRoom ? 'join' : 'create');
  }
});
app.addEventListener('change', (event) => {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement) || select.id !== 'series-mode') return;
  seriesMode = readSeriesMode(select.value);
  savePreference('rps-arena:series-mode', seriesMode);
  el('series-mode-hint').textContent = seriesModeDescription(seriesMode);
});
app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!button || button instanceof HTMLButtonElement && button.disabled) return;
  const action = button.dataset.action;
  if (action === 'home') { event.preventDefault(); if (view) requestLeave(); return; }
  if (action === 'choose-skin' && button.dataset.skin) void chooseSkin(button.dataset.skin);
  if (action === 'dismiss-chat') {
    hideChatNotice();
    scrollToGameElement('room-chat');
  }
  if (action === 'back-to-board') scrollToGameElement('board');
  if (action === 'copy') void copyInvitation();
  if (action === 'dismiss-notice') { notice = ''; render(); }
  if (action === 'shuffle' && view) {
    if (pending || networkStatus !== 'connected') return;
    selected = null;
    shuffleSoundPending = true;
    send('shuffle', { revision: view.revision });
  }
  if (action === 'ready' && view) { selected = null; send('ready', { revision: view.revision }); }
  if ((action === 'restart' || action === 'new-series') && view?.phase === 'finished') {
    if (button.dataset.seriesId !== view.series.id || button.dataset.matchId !== view.series.matchId) {
      toast('Die Partie wurde inzwischen aktualisiert. Bitte wähle erneut.', true);
      return;
    }
    selected = null;
    send(action === 'restart' ? 'restart' : 'new_series', { seriesId: view.series.id, matchId: view.series.matchId });
  }
  if (action === 'duel' && view?.duel && !combat.busy && !view.paused && !view.duel.choiceLocked[view.you]) {
    send('duel', { kind: button.dataset.kind as FighterKind, duelId: view.duel.id, round: view.duel.round });
  }
  if (action === 'resign') confirm('Diese Partie aufgeben?', 'Dein Gegner erhält einen Sieg in dieser Serie. Danach entscheidet ihr gemeinsam, wie es im selben Raum weitergeht.', 'Partie aufgeben', () => send('resign'));
  if (action === 'leave') requestLeave();
  if (action === 'new-game') void newGame();
  if (action === 'retry') void retry();
  if (action === 'cancel-modal') closeModal();
  if (action === 'confirm-modal') { const callback = confirmAction; closeModal(); callback?.(); }
});
document.addEventListener('keydown', (event) => {
  void sounds.unlock();
  if (event.key === 'Escape' && el<HTMLDetailsElement>('appearance-menu').open) {
    el<HTMLDetailsElement>('appearance-menu').open = false;
    el('appearance-menu').querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
  }
  const modal = el('modal-root').querySelector<HTMLElement>('.modal');
  if (!modal) return;
  if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
  if (event.key === 'Tab') {
    const targets = Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    const first = targets[0];
    const last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus({ preventScroll: true }); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus({ preventScroll: true }); }
  }
});

applySkin(currentSkin);
updateMotion();
el<HTMLInputElement>('sounds-enabled').checked = soundsPreferred;
el<HTMLInputElement>('sounds-enabled').disabled = typeof window.AudioContext !== 'function';
sounds.setEnabled(soundsPreferred);
void initializeSkins();
if (inputRoom && connection.hasSavedSession(inputRoom)) {
  void connection.resume(inputRoom).catch((error: unknown) => {
    notice = error instanceof Error ? error.message : 'Die vorige Sitzung konnte nicht wiederhergestellt werden. Du kannst dem Raum erneut beitreten.';
    render();
  });
}
