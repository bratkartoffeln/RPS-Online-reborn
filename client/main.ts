import './styles.css';
import type { FighterKind, PlayerView } from '../shared/game';
import type { Snapshot } from '../shared/protocol';
import { ArenaBoard, coordinate, kindName } from './board';
import { escapeHtml as esc, icon } from './icons';
import { RpsConnection, readSession, roomCodeFrom, writeSession, type NetworkStatus, type SessionEnd } from './network';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = [
  '<div class="app-shell" id="shell">',
  '<header class="app-header"><a class="brand" href="' + esc(location.pathname) + '" aria-label="RPS Arena Startseite" data-action="home">',
  '<span class="brand-emblem">' + icon('rock', '', 29) + '</span><span><span class="brand-title">RPS ARENA</span><span class="brand-tagline" style="display:block">Stein. Papier. Schere.</span></span></a>',
  '<div class="header-right"><span class="header-note" id="header-note"><span class="status-dot"></span>PRIVATE PARTIEN</span><span class="version">v' + esc(__APP_VERSION__) + '</span></div></header>',
  '<div class="intro-row"><div><p class="eyebrow" id="page-eyebrow">DAS TAKTISCHE DUELL FÜR ZWEI</p><h1 class="page-title" id="page-title">Dein Zug beginnt hier.</h1></div><p class="page-subtitle" id="page-subtitle">Figuren verdecken.<br>Gedanken lesen. Flagge holen.</p></div>',
  '<div class="notice" id="notice" role="alert" hidden></div>',
  '<main class="arena-grid"><section class="play-panel" aria-label="Spielbereich">',
  '<div class="board-topbar"><div><h2 id="board-title">Das Spielfeld</h2><span class="board-subtitle" id="board-subtitle">7 × 6 Felder · Vorschau</span></div><span class="pill accent" id="board-phase">DEINE ARENA</span></div>',
  '<div class="board-region"><div id="board" class="canvas-wrap" tabindex="0" role="application" aria-label="Spielfeld mit sieben Spalten und sechs Reihen" aria-describedby="board-help board-focus"></div>',
  '<div class="preview-banner" id="preview-banner">' + icon('unknown', '', 18) + '<span>Ein guter Plan bleibt erst einmal geheim.</span></div></div>',
  '<div class="board-footer"><span class="team-key"><span class="team-square"></span><span id="own-count">Dein Team</span></span><span class="team-key enemy"><span class="team-square"></span><span id="enemy-count">Gegner</span></span><span class="board-hint" id="board-hint">Erstelle oder betrete einen Raum.</span></div></section>',
  '<aside class="side-column" id="sidebar" aria-label="Spielsteuerung"></aside></main>',
  '<footer class="footer"><span>' + icon('info', '', 13) + 'Ein unabhängiges Remake · vorläufige Regeln für Version ' + esc(__APP_VERSION__) + '</span><span>Figur anklicken oder <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> + <kbd>Enter</kbd></span></footer></div>',
  '<p class="sr-only" id="board-help">Mit den Pfeiltasten ein Feld wählen. Mit Enter oder Leertaste eine eigene Figur und anschließend ein Zielfeld wählen. Escape hebt die Auswahl auf. In der Aufstellung tauschen zwei eigene Figuren die Plätze. Im Spiel sind grün markierte Felder erlaubte Ziele.</p>',
  '<p class="sr-only" id="board-focus" aria-live="polite"></p><p class="sr-only" id="announcement" aria-live="polite" aria-atomic="true"></p>',
  '<div class="toast" id="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>',
].join('');

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let view: Snapshot | null = null;
let networkStatus: NetworkStatus = 'idle';
let sessionEnd: SessionEnd | null = null;
let selected: number | null = null;
let pending = false;
let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
let toastTimeout: ReturnType<typeof setTimeout> | undefined;
let name = readSession('rps-arena:name') ?? '';
let inputRoom = roomCodeFrom(new URL(location.href).searchParams.get('room') ?? '');
let notice = '';
let lastAnnouncement = '';
let confirmAction: (() => void) | null = null;
let lastModalFocus: HTMLElement | null = null;

const connection = new RpsConnection({
  onStatus(status) {
    networkStatus = status;
    if (status === 'connecting' || status === 'connected') sessionEnd = null;
    if (status === 'reconnecting') {
      clearPending();
      el('announcement').textContent = 'Verbindung unterbrochen. Die Arena versucht, dich wieder zu verbinden.';
    }
    render();
  },
  onSnapshot(snapshot) {
    if (view?.phase !== snapshot.phase) selected = null;
    view = snapshot;
    sessionEnd = null;
    inputRoom = snapshot.roomId;
    clearPending();
    notice = '';
    if (selected !== null && snapshot.board[selected]?.owner !== snapshot.you) selected = null;
    setRoomUrl(snapshot.roomId);
    render();
    const latest = snapshot.log.at(-1) ?? '';
    const next = [snapshot.phase, snapshot.turnNumber, snapshot.duel?.round ?? 0, latest].join(':');
    if (next !== lastAnnouncement) {
      lastAnnouncement = next;
      el('announcement').textContent = phaseAnnouncement(snapshot) + ' ' + latest;
    }
  },
  onProblem(message) {
    clearPending();
    render();
    toast(message, true);
    connection.send('sync');
  },
  onEnded(end) {
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
  onCancel() { selected = null; render(); },
  onFocus(description) { el('board-focus').textContent = description; },
});
el('board').addEventListener('pointerdown', () => el('board').focus({ preventScroll: true }));

function clearPending(): void {
  pending = false;
  if (pendingTimeout) clearTimeout(pendingTimeout);
  pendingTimeout = undefined;
}

function send(message: string, payload?: unknown): void {
  if (pending || networkStatus !== 'connected') return;
  pending = true;
  if (!connection.send(message, payload)) {
    clearPending();
    toast('Bitte warte, bis die Verbindung wiederhergestellt ist.', true);
    return;
  }
  pendingTimeout = setTimeout(() => {
    clearPending();
    connection.send('sync');
    render();
  }, 4000);
  render();
}

function me(): PlayerView | undefined { return view?.players.find((p) => p.id === view?.you); }
function opponent(): PlayerView | undefined { return view?.players.find((p) => p.id !== view?.you); }

function phaseAnnouncement(snapshot: Snapshot): string {
  if (snapshot.paused) return 'Die Partie pausiert, bis beide Spieler wieder verbunden sind.';
  if (snapshot.phase === 'waiting') return 'Dein Raum ist erstellt. Du kannst dein Team schon aufstellen.';
  if (snapshot.phase === 'setup') return 'Beide Spieler sind da. Stellt eure Figuren auf und bestätigt mit Ich bin bereit.';
  if (snapshot.phase === 'duel') return 'Ein verdecktes Duell beginnt. Runde ' + (snapshot.duel?.round ?? 1) + '.';
  if (snapshot.phase === 'finished') return snapshot.winner === snapshot.you ? 'Du hast die Partie gewonnen.' : snapshot.winner ? 'Die Partie ist beendet.' : 'Die Partie endet unentschieden.';
  return snapshot.currentTurn === snapshot.you ? 'Du bist am Zug.' : 'Dein Gegner ist am Zug.';
}

function handleCell(index: number): void {
  if (!view || pending || networkStatus !== 'connected' || view.paused) return;
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
  return [
    '<section class="card rules-card"><div class="card-heading"><h2>Einfaches Prinzip. Gute Taktik.</h2>' + icon('info', '', 16) + '</div><div class="rps-cycle">',
    '<div class="rule-piece">' + icon('rock') + '<strong>Stein</strong><span>schlägt Schere</span></div>',
    '<div class="rule-piece">' + icon('paper') + '<strong>Papier</strong><span>schlägt Stein</span></div>',
    '<div class="rule-piece">' + icon('scissors') + '<strong>Schere</strong><span>schlägt Papier</span></div></div>',
    '<p class="rule-description"><strong>Das Ziel: die gegnerische Flagge.</strong><br>Dein Team: je 4 Steine, Papiere und Scheren, eine Flagge und eine Falle.</p>',
    '<details class="rules-details"><summary>So wird gespielt</summary><p>Vor dem Start kannst du deine Figuren durch Anklicken tauschen. Wenn beide bereit sind, beginnt die Partie. Kämpfer ziehen jeweils ein Feld waagerecht oder senkrecht. Flagge und Falle bleiben stehen.</p>',
    '<p>Betrittst du ein gegnerisches Feld, werden beide Figuren aufgedeckt. Das stärkere Symbol gewinnt. Gleiche Symbole lösen ein verdecktes Stein-Papier-Schere-Duell aus. Bei Gleichstand wählt ihr erneut; die Figuren übernehmen den gewählten Typ.</p>',
    '<p>Eine Falle entfernt ihren Angreifer und bleibt auf dem Feld. Wer die gegnerische Flagge erobert oder seinem Gegner keinen Zug mehr lässt, gewinnt. Nach 300 Zügen endet die Partie unentschieden. Der kleine grüne Punkt zeigt eine bereits aufgedeckte Figur.</p></details></section>',
  ].join('');
}

function lobbyMarkup(): string {
  const busy = networkStatus === 'connecting' || networkStatus === 'reconnecting' || networkStatus === 'connected';
  const disabled = busy ? ' disabled' : '';
  return [
    '<section class="card lobby-card"><div class="lobby-intro"><p class="eyebrow">DEIN PRIVATER SPIELRAUM</p><h2 class="lobby-title">Zwei Plätze.<br>Ein gutes Duell.</h2>',
    '<p class="body-copy">' + (sessionEnd ? 'Die vorige Partie ist beendet. Erstelle eine neue Partie oder tritt einem anderen Raum bei.' : inputRoom ? 'Du hast einen Raumcode. Gib deinen Namen ein und tritt der Partie bei.' : 'Erstelle eine Partie und lade jemanden über deinen Link ein.') + '</p></div>',
    '<form id="create-form"><label class="field"><span>Dein Spielername</span><input id="player-name" name="player-name" autocomplete="nickname" placeholder="Wie heißt du?" maxlength="24" value="' + esc(name) + '"' + disabled + ' /></label>',
    '<button class="primary-button full-width action-button" type="submit" id="create-button"' + disabled + '>' + (busy ? '<span class="spinner" aria-hidden="true"></span> Verbinde …' : (sessionEnd ? 'Neue Partie erstellen ' : 'Raum erstellen ') + icon('arrow', 'button-arrow', 18)) + '</button></form>',
    '<form class="join-form" id="join-form"><div class="form-divider">oder einem Raum beitreten</div><label class="field join-field"><span>Raumcode oder Einladungslink</span><input id="room-input" name="room-code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Code oder Link einfügen" value="' + esc(inputRoom) + '"' + disabled + ' /></label>',
    '<button class="secondary-button full-width action-button" type="submit" id="join-button"' + disabled + '>' + icon('link', '', 16) + 'Raum beitreten</button></form>',
    '<p class="trust-note">' + icon('check', '', 13) + 'Kein Konto nötig. Nur dein Name und ein Mitspieler.</p></section>',
    rulesCard(),
  ].join('');
}

function playerMarkup(player: PlayerView | undefined, own: boolean): string {
  if (!player) return '<div class="player-row enemy empty"><span class="player-avatar">' + icon('unknown', '', 17) + '</span><div class="player-info"><p class="player-name">' + (networkStatus === 'ended' ? 'Kein Mitspieler' : 'Platz noch frei') + '</p><p class="player-state">' + (networkStatus === 'ended' ? 'Partie beendet.' : 'Teile deinen Einladungslink.') + '</p></div><span class="waiting-dots" aria-hidden="true">···</span></div>';
  const active = view?.currentTurn === player.id && view?.phase === 'playing';
  const preparing = view?.phase === 'waiting' || view?.phase === 'setup';
  const ended = networkStatus === 'ended';
  let status = ended ? 'Partie beendet' : !player.connected ? 'Verbindung unterbrochen' : preparing ? player.ready ? 'Bereit für die Partie' : 'Stellt das Team auf' : active ? 'Am Zug' : view?.phase === 'finished' ? player.restartRequested ? 'Bereit für die Revanche' : 'Partie beendet' : 'Verbunden';
  if (view?.phase === 'duel' && player.connected && !ended) status = view.duel?.choiceLocked[player.id] ? 'Wahl verdeckt abgegeben' : 'Wählt im Duell';
  const connected = player.connected && !ended;
  const marker = connected && player.ready && preparing ? icon('check', 'ready-icon', 17) : '<span class="status-dot ' + (connected ? '' : 'offline') + '" aria-label="' + (connected ? 'Verbunden' : 'Getrennt') + '"></span>';
  return '<div class="player-row ' + (own ? '' : 'enemy') + '"><span class="player-avatar">' + icon(own ? 'flag' : 'unknown', '', 17) + '</span><div class="player-info"><p class="player-name">' + esc(player.name) + (own ? '<span class="player-you">du</span>' : '') + '</p><p class="player-state">' + status + '</p></div>' + marker + '</div>';
}

function phaseSection(label: string, title: string, copy: string, controls = '', classes = ''): string {
  return '<section class="card phase-card ' + classes + '"><p class="phase-label">' + label + '</p><h2>' + esc(title) + '</h2><p class="body-copy">' + esc(copy) + '</p>' + controls + '</section>';
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
    const copy = own?.ready ? other ? 'Deine Aufstellung steht. Die Partie beginnt, sobald dein Gegner ebenfalls bereit ist.' : 'Dein Team ist aufgestellt. Lade deinen Gegner über den Link ein.' : selected !== null ? kindName(view.board[selected]?.kind ?? null) + ' auf ' + coordinate(selected) + ' ausgewählt. Klicke eine zweite eigene Figur an, um die Plätze zu tauschen.' : 'Tausche zwei eigene Figuren durch Anklicken. Oder mische dein Team neu, bis die Aufstellung passt.';
    const lock = own?.ready ? ' disabled' : disabled;
    return phaseSection('01 / AUFSTELLUNG', own?.ready ? 'Du bist bereit.' : 'Dein Plan. Dein Team.', copy,
      '<div class="button-row"><button class="secondary-button" data-action="shuffle" id="shuffle-button"' + lock + '>' + icon('shuffle', '', 16) + 'Mischen</button><button class="primary-button" data-action="ready" id="ready-button"' + lock + '>' + icon('check', '', 16) + (own?.ready ? 'Bereit' : 'Ich bin bereit') + '</button></div>');
  }
  if (view.phase === 'duel' && view.duel) {
    const duel = view.duel;
    const locked = duel.choiceLocked[view.you] === true;
    const choices = (['rock', 'paper', 'scissors'] as const).map((kind) =>
      '<button class="duel-choice ' + (duel.yourChoice === kind ? 'selected' : '') + '" data-action="duel" data-kind="' + kind + '" id="duel-' + kind + '" aria-pressed="' + (duel.yourChoice === kind) + '"' + (locked ? ' disabled' : disabled) + '>' + icon(kind) + '<span>' + kindName(kind) + '</span></button>'
    ).join('');
    const confirmation = locked ? 'Du hast ' + kindName(duel.yourChoice) + ' gewählt.' : other && duel.choiceLocked[other.id] ? 'Dein Gegner hat bereits verdeckt gewählt.' : 'Dein Gegner kann deine Wahl nicht sehen.';
    return phaseSection('DUELL / RUNDE ' + duel.round, duel.round > 1 ? 'Noch einmal. Ganz geheim.' : 'Gleiche Figur. Neues Duell.', locked ? 'Deine Wahl bleibt verborgen, bis dein Gegner ebenfalls gewählt hat.' : 'Wähle Stein, Papier oder Schere. Beide Entscheidungen werden gleichzeitig aufgedeckt.',
      '<div class="duel-choices">' + choices + '</div><p class="duel-confirmation">' + icon(locked ? 'check' : 'unknown', '', 13) + esc(confirmation) + '</p>');
  }
  if (view.phase === 'finished') {
    const won = view.winner === view.you;
    let reason = 'Diese Runde ist entschieden. Bereit für die nächste?';
    if (view.finishReason === 'flag') reason = won ? 'Du hast die gegnerische Flagge erobert. Gut gespielt.' : 'Deine Flagge wurde erobert. Bei der Revanche beginnt alles neu.';
    if (view.finishReason === 'resign') reason = won ? 'Dein Gegner hat die Partie aufgegeben.' : 'Du hast diese Partie aufgegeben.';
    if (view.finishReason === 'no_moves') reason = won ? 'Dein Gegner hat keinen gültigen Zug mehr.' : 'Dein Team hat keinen gültigen Zug mehr.';
    if (view.finishReason === 'turn_limit') reason = 'Nach 300 Zügen endet diese Partie unentschieden.';
    if (own?.restartRequested) reason += ' Du bist für eine Revanche bereit.';
    else if (other?.restartRequested) reason += ' ' + other.name + ' möchte eine Revanche.';
    const title = view.winner === null ? 'Unentschieden.' : won ? 'Du gewinnst die Runde.' : (other?.name ?? 'Dein Gegner') + ' gewinnt.';
    return phaseSection('PARTIE BEENDET', title, reason, '<div class="button-row"><button class="primary-button" data-action="restart" id="restart-button"' + (own?.restartRequested || !other?.connected ? ' disabled' : disabled) + '>' + icon('refresh', '', 16) + (own?.restartRequested ? 'Warten auf Revanche …' : 'Revanche spielen') + '</button></div>');
  }
  const yourTurn = view.currentTurn === view.you;
  const copy = yourTurn ? selected !== null ? kindName(view.board[selected]?.kind ?? null) + ' auf ' + coordinate(selected) + ' ausgewählt. Ziehe auf eines der grün markierten Felder.' : 'Wähle eine bewegliche Figur. Die grünen Markierungen zeigen dir ihre möglichen Ziele.' : 'Behalte die aufgedeckten Figuren im Blick und plane deinen nächsten Zug.';
  return phaseSection('02 / ZUG ' + (view.turnNumber + 1), yourTurn ? 'Du bist am Zug.' : (other?.name ?? 'Dein Gegner') + ' ist am Zug.', copy, '', yourTurn ? '' : 'enemy-turn');
}

function gameMarkup(): string {
  if (!view) return '';
  const recent = view.log.slice(-4).reverse();
  const connected = networkStatus === 'connected';
  const ended = networkStatus === 'ended';
  const connectionLabel = connected ? 'VERBUNDEN' : ended ? 'BEENDET' : networkStatus === 'reconnecting' || networkStatus === 'connecting' ? 'VERBINDE …' : 'GETRENNT';
  return [
    '<section class="card room-card"><div class="card-heading"><p class="eyebrow">PRIVATER RAUM</p><span class="pill ' + (connected ? 'accent' : 'orange') + '">' + connectionLabel + '</span></div>',
    '<div class="room-code-row"><code class="room-code" title="Raumcode">' + esc(view.roomId) + '</code><button class="icon-button" data-action="copy" id="copy-button" aria-label="Einladungslink kopieren" title="Einladungslink kopieren"' + (ended ? ' disabled' : '') + '>' + icon('copy', '', 17) + '</button></div>',
    '<p class="room-help">' + (ended ? 'Dieser Raum ist beendet. Starte eine neue Partie.' : 'Kopiere den Link und lade deinen Mitspieler ein.') + '</p><div class="players">' + playerMarkup(me(), true) + playerMarkup(opponent(), false) + '</div></section>',
    phaseCard(),
    '<section class="card history-card"><div class="card-heading"><h2>' + (ended ? 'Die letzte Partie' : 'Was gerade passiert') + '</h2><span class="eyebrow">' + (ended ? 'VERLAUF' : 'LIVE') + '</span></div><ol class="move-log">' + (recent.length ? recent.map((entry) => '<li>' + esc(entry) + '</li>').join('') : '<li>Deine Arena wartet auf den ersten Zug.</li>') + '</ol></section>',
    '<div class="game-actions"><button class="text-button" data-action="leave" id="leave-button">' + icon('leave', '', 13) + 'Zur Lobby</button>',
    !ended && (view.phase === 'playing' || view.phase === 'duel') ? '<button class="text-button danger" data-action="resign" id="resign-button"' + (!connected || pending ? ' disabled' : '') + '>Partie aufgeben ' + icon('close', '', 12) + '</button>' : '',
    '</div>', rulesCard(),
  ].join('');
}

function boardHint(): string {
  if (!view) return 'Erstelle oder betrete einen Raum.';
  if (networkStatus === 'ended') return 'Diese Partie ist beendet.';
  if (pending) return 'Zug wird bestätigt …';
  if (view.paused || networkStatus !== 'connected') return 'Die Partie pausiert.';
  if (view.phase === 'waiting' || view.phase === 'setup') return me()?.ready ? 'Deine Aufstellung steht.' : selected !== null ? 'Zweite eigene Figur wählen.' : 'Zwei Figuren zum Tauschen wählen.';
  if (view.phase === 'playing') return view.currentTurn === view.you ? selected !== null ? 'Ein markiertes Ziel wählen.' : 'Wähle eine eigene Figur.' : 'Dein Gegner ist am Zug.';
  return view.phase === 'duel' ? 'Wähle im Duell.' : 'Zeit für eine Revanche?';
}

function render(): void {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusId = active?.closest('#sidebar') ? active.id : '';
  const detailsOpen = el('sidebar').querySelector<HTMLDetailsElement>('.rules-details')?.open;
  el('shell').classList.toggle('game-mode', !!view);
  el('sidebar').innerHTML = view ? gameMarkup() : lobbyMarkup();
  if (detailsOpen) el('sidebar').querySelector<HTMLDetailsElement>('.rules-details')!.open = true;
  if (focusId) el(focusId)?.focus({ preventScroll: true });
  el('preview-banner').hidden = !!view;
  const paused = networkStatus === 'reconnecting' || networkStatus === 'disconnected' || networkStatus === 'ended';
  el('header-note').innerHTML = '<span class="status-dot ' + (paused ? 'offline' : '') + '"></span>' + (networkStatus === 'ended' ? 'PARTIE BEENDET' : view ? networkStatus === 'connected' ? 'VERBUNDEN' : 'VERBINDUNG PAUSIERT' : 'PRIVATE PARTIEN');
  el('page-title').textContent = view ? networkStatus === 'ended' ? 'Diese Partie ist beendet.' : view.phase === 'waiting' || view.phase === 'setup' ? 'Die Aufstellung zählt.' : view.phase === 'finished' ? 'Die Runde ist entschieden.' : 'Jeder Zug zählt.' : 'Dein Zug beginnt hier.';
  el('page-eyebrow').textContent = view ? 'DEINE PRIVATE ARENA' : 'DAS TAKTISCHE DUELL FÜR ZWEI';
  el('page-subtitle').innerHTML = view ? 'Ein Plan. Ein Gegner.<br>Und eine Flagge.' : 'Figuren verdecken.<br>Gedanken lesen. Flagge holen.';
  el('board-title').textContent = view ? 'Dein Spielfeld' : 'Das Spielfeld';
  el('board-subtitle').textContent = view ? '7 × 6 Felder · Dein Team startet unten' : '7 × 6 Felder · Vorschau';
  const badge = el('board-phase');
  badge.className = 'pill accent';
  if (!view) badge.textContent = 'DEINE ARENA';
  else if (networkStatus === 'ended') { badge.textContent = 'BEENDET'; badge.className = 'pill orange'; }
  else if (networkStatus !== 'connected' || view.paused) { badge.textContent = 'PAUSE'; badge.className = 'pill orange'; }
  else if (view.phase === 'setup' || view.phase === 'waiting') badge.textContent = 'AUFSTELLUNG';
  else if (view.phase === 'finished') badge.textContent = 'BEENDET';
  else if (view.phase === 'duel') { badge.textContent = 'DUELL · RUNDE ' + view.duel?.round; badge.className = 'pill orange'; }
  else { badge.textContent = 'ZUG ' + (view.turnNumber + 1); badge.className = 'pill ' + (view.currentTurn === view.you ? 'accent' : 'orange'); }
  el('own-count').textContent = view ? 'Dein Team · ' + view.board.filter((p) => p?.owner === view?.you).length : 'Dein Team';
  el('enemy-count').textContent = view ? 'Gegner · ' + view.board.filter((p) => p && p.owner !== view?.you).length : 'Gegner';
  el('board-hint').textContent = boardHint();
  el('notice').hidden = !notice;
  el('notice').innerHTML = notice ? icon('info', '', 17) + '<span class="notice-content">' + esc(notice) + '</span><button class="notice-button" data-action="dismiss-notice" aria-label="Hinweis schließen">' + icon('close', '', 12) + '</button>' : '';
  board.update(view, selected, networkStatus === 'connected' && !pending);
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
  if (!name) { toast('Gib bitte zuerst deinen Spielernamen ein.', true); el('player-name').focus(); return null; }
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
    el('room-input').focus();
    return;
  }
  notice = '';
  try {
    if (action === 'create') await connection.create(chosenName);
    else if (connection.hasSavedSession(code)) await connection.resume(code);
    else await connection.join(code, chosenName);
  } catch (error) { notice = error instanceof Error ? error.message : 'Die Verbindung konnte nicht hergestellt werden.'; render(); }
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
  field.focus();
  field.select();
}

function confirm(title: string, text: string, label: string, action: () => void): void {
  lastModalFocus = document.activeElement as HTMLElement | null;
  confirmAction = action;
  el('modal-root').innerHTML = '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="button-row"><button class="secondary-button" data-action="cancel-modal" id="cancel-modal">Weiterspielen</button><button class="primary-button danger-button" data-action="confirm-modal">' + esc(label) + '</button></div></section></div>';
  el('cancel-modal').focus();
}

function closeModal(): void {
  confirmAction = null;
  el('modal-root').innerHTML = '';
  if (lastModalFocus?.isConnected) lastModalFocus.focus({ preventScroll: true });
}

async function leaveRoom(): Promise<void> {
  view = null;
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
  if (networkStatus !== 'ended' && view && (view.phase === 'playing' || view.phase === 'duel')) {
    confirm('Zur Lobby zurück?', 'Wenn du die laufende Partie verlässt, gewinnt dein Gegner. Du kannst anschließend einen neuen Raum erstellen.', 'Partie verlassen', () => { connection.send('resign'); void leaveRoom(); });
  } else void leaveRoom();
}

async function newGame(): Promise<void> {
  const chosenName = (me()?.name ?? name).trim();
  await leaveRoom();
  name = chosenName;
  if (!chosenName) { el('player-name').focus(); return; }
  writeSession('rps-arena:name', chosenName);
  try { await connection.create(chosenName); }
  catch (error) { notice = error instanceof Error ? error.message : 'Der neue Raum konnte nicht erstellt werden. Bitte versuche es erneut.'; render(); }
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
app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!button || button instanceof HTMLButtonElement && button.disabled) return;
  const action = button.dataset.action;
  if (action === 'home') { event.preventDefault(); if (view) requestLeave(); return; }
  if (action === 'copy') void copyInvitation();
  if (action === 'dismiss-notice') { notice = ''; render(); }
  if (action === 'shuffle' && view) { selected = null; send('shuffle', { revision: view.revision }); }
  if (action === 'ready' && view) { selected = null; send('ready', { revision: view.revision }); }
  if (action === 'restart') { selected = null; send('restart'); }
  if (action === 'duel' && view?.duel) send('duel', { kind: button.dataset.kind as FighterKind, duelId: view.duel.id, round: view.duel.round });
  if (action === 'resign') confirm('Diese Partie aufgeben?', 'Dein Gegner gewinnt diese Runde. Danach könnt ihr im selben Raum eine Revanche starten.', 'Partie aufgeben', () => send('resign'));
  if (action === 'leave') requestLeave();
  if (action === 'new-game') void newGame();
  if (action === 'retry') void retry();
  if (action === 'cancel-modal') closeModal();
  if (action === 'confirm-modal') { const callback = confirmAction; closeModal(); callback?.(); }
});
document.addEventListener('keydown', (event) => {
  const modal = el('modal-root').querySelector<HTMLElement>('.modal');
  if (!modal) return;
  if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
  if (event.key === 'Tab') {
    const targets = Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    const first = targets[0];
    const last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

render();
if (inputRoom && connection.hasSavedSession(inputRoom)) {
  void connection.resume(inputRoom).catch((error: unknown) => {
    notice = error instanceof Error ? error.message : 'Die vorige Sitzung konnte nicht wiederhergestellt werden. Du kannst dem Raum erneut beitreten.';
    render();
  });
}
