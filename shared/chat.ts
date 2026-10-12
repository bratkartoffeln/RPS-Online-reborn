export const CHAT_MAX_LENGTH = 300;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_MIN_INTERVAL_MS = 500;

/** One line of readable text; preserve Unicode letters and emoji sequences. */
export function normalizeChatText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/gu, ' ').trim();
}

/** UUIDs and short client-generated identifiers, without unbounded reflection. */
export function isChatRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}
