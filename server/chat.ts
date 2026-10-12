import { CHAT_HISTORY_LIMIT, CHAT_MAX_LENGTH, CHAT_MIN_INTERVAL_MS, isChatRequestId, normalizeChatText } from '../shared/chat.js';
import type { ChatMessage, ChatProblem, ChatState } from '../shared/protocol.js';

interface ChatSender {
  playerId: string;
  playerName: string;
  seat: 0 | 1;
}

type ChatResult = { ok: true; added: boolean } | { ok: false; problem: ChatProblem };

/** Room-scoped, public chat data only. It never receives the private GameState. */
export class RoomChat {
  private messages: ChatMessage[] = [];
  private nextId = 1;
  private lastSentAt = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  accept(data: unknown, sender: ChatSender): ChatResult {
    if (typeof data !== 'object' || data === null || Array.isArray(data)
      || !('requestId' in data) || !isChatRequestId(data.requestId)) {
      return { ok: false, problem: { message: 'Für diese Chatnachricht fehlt eine gültige Kennung.' } };
    }
    const requestId = data.requestId;
    // An acknowledged retry is not a second message and needs no new interval.
    // Scope IDs to the authenticated player and only the retained history.
    if (this.messages.some((message) => message.playerId === sender.playerId && message.requestId === requestId)) {
      return { ok: true, added: false };
    }
    if (!('text' in data) || typeof data.text !== 'string') {
      return { ok: false, problem: { requestId, message: 'Schreibe eine Textnachricht.' } };
    }
    const text = normalizeChatText(data.text);
    if (!text) return { ok: false, problem: { requestId, message: 'Schreibe eine Nachricht.' } };
    if (Array.from(text).length > CHAT_MAX_LENGTH) {
      return { ok: false, problem: { requestId, message: `Deine Nachricht darf höchstens ${CHAT_MAX_LENGTH} Zeichen enthalten.` } };
    }
    const sentAt = this.now();
    const previous = this.lastSentAt.get(sender.playerId);
    if (previous !== undefined && sentAt - previous < CHAT_MIN_INTERVAL_MS) {
      return { ok: false, problem: { requestId, message: 'Bitte warte kurz, bevor du eine weitere Nachricht sendest.' } };
    }
    this.messages.push({
      id: this.nextId++, requestId, playerId: sender.playerId, playerName: sender.playerName,
      seat: sender.seat, text, sentAt,
    });
    if (this.messages.length > CHAT_HISTORY_LIMIT) this.messages.shift();
    this.lastSentAt.set(sender.playerId, sentAt);
    return { ok: true, added: true };
  }

  state(roomId: string): ChatState {
    return { roomId, messages: this.messages.map((message) => ({ ...message })) };
  }
}
