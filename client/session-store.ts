import { isNativeApp, normalizeNativeServerUrl } from './server-config';

function storage(native: boolean): Storage { return native ? localStorage : sessionStorage; }

export function readSession(key: string, native = isNativeApp()): string | null {
  try { return storage(native).getItem(key); } catch { return null; }
}

export function writeSession(key: string, value: string, native = isNativeApp()): void {
  try { storage(native).setItem(key, value); } catch { /* Playing remains possible without storage. */ }
}

function removeSession(key: string, native: boolean): void {
  try { storage(native).removeItem(key); } catch { /* Storage is optional. */ }
}

/** Android survives process recreation; browser seats remain isolated per tab. */
export class ReconnectStore {
  private prefix: string;
  constructor(endpoint: string, private native: boolean) {
    this.prefix = native ? 'rps-arena:android:' + encodeURIComponent(normalizeNativeServerUrl(endpoint)) + ':' : 'rps-arena:';
  }

  token(roomCode: string): string | null {
    return readSession(this.prefix + 'reconnect:' + roomCode, this.native);
  }

  save(roomCode: string, token: string): void {
    writeSession(this.prefix + 'reconnect:' + roomCode, token, this.native);
    if (this.native) writeSession(this.prefix + 'last-room', roomCode, true);
  }

  lastRoom(): string | null {
    if (!this.native) return null;
    const room = readSession(this.prefix + 'last-room', true);
    return room && /^[A-Za-z0-9_-]{3,64}$/.test(room) && this.token(room) ? room : null;
  }

  forget(roomCode: string): void {
    removeSession(this.prefix + 'reconnect:' + roomCode, this.native);
    if (this.native && readSession(this.prefix + 'last-room', true) === roomCode) removeSession(this.prefix + 'last-room', true);
  }
}
