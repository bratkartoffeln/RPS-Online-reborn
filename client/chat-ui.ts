import type { ChatMessage, ChatProblem, ChatSendMessage, ChatState, Snapshot } from '../shared/protocol';
import { CHAT_MAX_LENGTH, normalizeChatText } from '../shared/chat';
import { teamColorForSeat, teamColorName } from './team-ui';

type Attempt = ChatSendMessage & { draft: string };

function chatRequestId(): string {
  // getRandomValues also works on the plain HTTP endpoint used inside a LAN.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** A persistent room chat. Game renders never replace the input or its draft. */
export class RoomChat {
  private readonly input: HTMLInputElement;
  private readonly button: HTMLButtonElement;
  private readonly list: HTMLOListElement;
  private readonly empty: HTMLElement;
  private readonly status: HTMLElement;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private connected = false;
  private messages: ChatMessage[] = [];
  private staged: ChatState | null = null;
  private synced = false;
  private lastAttempt: Attempt | null = null;
  private pending = false;
  private error = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly root: HTMLElement, private readonly send: (message: ChatSendMessage) => boolean, private readonly onOpponentMessage: () => void = () => {}) {
    root.classList.add('room-chat');
    root.hidden = true;
    root.setAttribute('aria-labelledby', 'chat-title');
    root.innerHTML = '<header class="chat-header"><h2 id="chat-title">Chat</h2><span>Nur in diesem Spielraum</span></header>' +
      '<form class="chat-compose" id="chat-form"><label class="sr-only" for="chat-input">Nachricht an deinen Gegner</label><input type="text" id="chat-input" name="message" placeholder="Deine Nachricht …" autocomplete="off" maxlength="600" enterkeyhint="send" aria-describedby="chat-status" /><button type="submit" class="primary-button" id="chat-send">Senden</button></form>' +
      '<div class="chat-history" id="chat-history" role="log" aria-label="Nachrichten im Spielraum" aria-live="polite" aria-relevant="additions text" tabindex="0"><p class="chat-empty" id="chat-empty">Noch keine Nachrichten. Schreib deinem Gegner!</p><ol id="chat-messages"></ol></div>' +
      '<p class="chat-status" id="chat-status" role="status" aria-live="polite" hidden></p>';
    this.input = root.querySelector<HTMLInputElement>('#chat-input')!;
    this.button = root.querySelector<HTMLButtonElement>('#chat-send')!;
    this.list = root.querySelector<HTMLOListElement>('#chat-messages')!;
    this.empty = root.querySelector<HTMLElement>('#chat-empty')!;
    this.status = root.querySelector<HTMLElement>('#chat-status')!;
    root.querySelector<HTMLFormElement>('#chat-form')!.addEventListener('submit', event => {
      event.preventDefault();
      this.submit();
    });
    this.input.addEventListener('input', () => { this.error = ''; this.paintControls(); });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.isComposing) event.preventDefault();
    });
    this.paintControls();
  }

  get hasInputFocus(): boolean { return this.root.ownerDocument.activeElement === this.input; }

  updateSession(view: Snapshot | null, connected: boolean): void {
    const nextRoom = view?.roomId ?? null;
    if (nextRoom !== this.roomId) {
      this.clearTimer();
      this.roomId = nextRoom;
      this.messages = [];
      this.synced = false;
      this.lastAttempt = null;
      this.pending = false;
      this.error = '';
      if (!nextRoom) this.staged = null;
      this.input.value = '';
      this.list.replaceChildren();
      this.empty.hidden = false;
    }
    this.playerId = view?.you ?? null;
    this.connected = connected && !!view;
    this.root.hidden = !view;
    if (!this.connected) { this.clearTimer(); this.pending = false; }
    if (this.staged?.roomId === nextRoom) {
      const state = this.staged;
      this.staged = null;
      this.receive(state);
    }
    this.paintControls();
  }

  receive(state: ChatState): void {
    if (state.roomId !== this.roomId) {
      // The first chat sync may precede the first game snapshot in a handshake.
      this.staged = state;
      return;
    }
    if ((state.messages.at(-1)?.id ?? 0) < (this.messages.at(-1)?.id ?? 0)) return;
    const acknowledged = this.lastAttempt && state.messages.some(message =>
      message.playerId === this.playerId && message.requestId === this.lastAttempt!.requestId);
    const history = this.root.querySelector<HTMLElement>('#chat-history')!;
    const atTop = history.scrollTop < 28;
    const firstSync = !this.synced;
    const previousHeight = history.scrollHeight;
    const previousTop = history.scrollTop;
    const latestId = this.messages.at(-1)?.id ?? 0;
    const opponentMessage = !firstSync && state.messages.some(message => message.id > latestId && message.playerId !== this.playerId);
    const existing = new Map(Array.from(this.list.children, child => [Number((child as HTMLElement).dataset.messageId), child]));
    const ids = new Set(state.messages.map(message => message.id));
    for (const [id, child] of existing) if (!ids.has(id)) child.remove();
    for (const message of state.messages) if (!existing.has(message.id)) this.list.prepend(this.messageRow(message));
    this.messages = state.messages;
    this.synced = true;
    this.empty.hidden = this.messages.length > 0;
    if (acknowledged && this.lastAttempt) {
      if (this.input.value === this.lastAttempt.draft) this.input.value = '';
      this.clearTimer();
      this.pending = false;
      this.lastAttempt = null;
      this.error = '';
    }
    if (atTop || firstSync || acknowledged) history.scrollTop = 0;
    else history.scrollTop = previousTop + history.scrollHeight - previousHeight;
    if (opponentMessage) this.onOpponentMessage();
    this.paintControls();
  }

  problem(problem: ChatProblem): void {
    if (problem.requestId && problem.requestId !== this.lastAttempt?.requestId) return;
    this.clearTimer();
    this.pending = false;
    this.error = problem.message;
    this.paintControls();
  }

  private messageRow(message: ChatMessage): HTMLElement {
    const document = this.root.ownerDocument;
    const row = document.createElement('li');
    row.className = 'chat-message';
    row.dataset.messageId = String(message.id);
    row.dataset.playerId = message.playerId;
    row.dataset.teamColor = teamColorForSeat(message.seat);
    const meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    const name = document.createElement('strong');
    name.className = 'chat-sender';
    name.textContent = message.playerName;
    name.title = teamColorName(teamColorForSeat(message.seat));
    const time = document.createElement('time');
    const sentAt = new Date(message.sentAt);
    time.dateTime = sentAt.toISOString();
    time.textContent = sentAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const text = document.createElement('p');
    text.className = 'chat-text';
    text.textContent = message.text;
    meta.append(name, time);
    row.append(meta, text);
    return row;
  }

  private submit(): void {
    if (!this.connected || !this.roomId || !this.playerId || this.pending) return;
    const text = normalizeChatText(this.input.value);
    if (!text) return;
    if (Array.from(text).length > CHAT_MAX_LENGTH) {
      this.error = `Deine Nachricht darf höchstens ${CHAT_MAX_LENGTH} Zeichen lang sein.`;
      this.paintControls();
      return;
    }
    const requestId = this.lastAttempt?.text === text ? this.lastAttempt.requestId : chatRequestId();
    this.lastAttempt = { requestId, text, draft: this.input.value };
    this.pending = true;
    this.error = '';
    this.paintControls();
    this.input.focus({ preventScroll: true });
    let sent = false;
    try { sent = this.send({ requestId, text }); } catch { /* Preserve the draft when a socket closes during send. */ }
    if (!sent) {
      this.pending = false;
      this.error = 'Die Nachricht konnte nicht gesendet werden. Versuche es nach der Wiederverbindung erneut.';
      this.paintControls();
      return;
    }
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.pending = false;
      this.error = 'Noch keine Sendebestätigung. Dein Text bleibt erhalten; du kannst erneut senden.';
      this.paintControls();
    }, 8000);
  }

  private clearTimer(): void { clearTimeout(this.timer); this.timer = undefined; }

  private paintControls(): void {
    this.input.disabled = !this.roomId;
    this.button.disabled = !this.connected || this.pending || !normalizeChatText(this.input.value);
    this.button.textContent = this.pending ? 'Sendet …' : 'Senden';
    const message = this.error || (this.roomId && !this.connected ? 'Verbindung unterbrochen. Dein Text bleibt erhalten.' : this.pending ? 'Nachricht wird gesendet …' : '');
    this.status.textContent = message;
    this.status.hidden = !message;
    this.status.classList.toggle('chat-error', !!this.error);
    this.root.setAttribute('aria-busy', String(this.pending));
  }
}
