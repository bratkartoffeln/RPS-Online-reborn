import { Capacitor } from '@capacitor/core';

export const DEFAULT_NATIVE_SERVER = 'https://flusensieb.dns.navy:8443';
const SERVER_SETTING = 'rps-arena:android:server';
const ROOM_CODE = /^[A-Za-z0-9_-]{3,64}$/;

export function isNativeApp(): boolean { return Capacitor.isNativePlatform(); }

/** Native networking is restricted to an explicitly selected HTTPS origin. */
export function normalizeNativeServerUrl(input: string): string {
  const value = input.trim();
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Bitte eine vollständige HTTPS-Adresse eingeben, zum Beispiel https://spiel.example.de.'); }
  // Reject URL parser repairs, credentials (including an empty user-info part),
  // paths and hidden controls; silently repairing these obscures the destination.
  if (!/^https:\/\/[^/?#\\\s]+\/?$/i.test(value) ||
      value.slice(value.indexOf('//') + 2).split('/')[0].includes('@') ||
      url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Die Serveradresse muss HTTPS verwenden und darf nur Hostname und optional Port enthalten – keinen Pfad, Raumlink oder Zugangsdaten.');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
    throw new Error('Bitte die öffentliche HTTPS-Adresse des Spielservers verwenden. localhost bezeichnet dieses Handy.');
  }
  return url.origin;
}

export function nativeDefaultServer(): string {
  return normalizeNativeServerUrl(import.meta.env?.VITE_SERVER_URL || DEFAULT_NATIVE_SERVER);
}

export function serverEndpoint(native = isNativeApp()): string {
  if (native) {
    try {
      const saved = localStorage.getItem(SERVER_SETTING);
      if (saved) return normalizeNativeServerUrl(saved);
    } catch { /* An invalid setting or unavailable storage cannot strand the app. */ }
    return nativeDefaultServer();
  }
  if (import.meta.env?.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (import.meta.env?.DEV) {
    const endpoint = new URL(window.location.href);
    endpoint.port = '2567';
    return endpoint.origin;
  }
  return window.location.origin;
}

export function saveNativeServer(input: string): string {
  const endpoint = normalizeNativeServerUrl(input);
  try { localStorage.setItem(SERVER_SETTING, endpoint); }
  catch { throw new Error('Die Serveradresse konnte auf diesem Gerät nicht gespeichert werden. Bitte prüfe den verfügbaren Speicher.'); }
  return endpoint;
}

export function roomCodeFrom(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (ROOM_CODE.test(value)) return value;
  try {
    const url = new URL(value, window.location.origin);
    const room = url.searchParams.get('room')?.trim() ?? '';
    return ROOM_CODE.test(room) ? room : '';
  } catch { return ''; }
}

/** A pasted invitation never changes servers or routes a saved token elsewhere. */
export function roomCodeForServer(input: string, endpoint: string, native = isNativeApp()): string {
  const code = roomCodeFrom(input);
  if (!native || !code || ROOM_CODE.test(input.trim())) return code;
  let link: URL;
  try { link = new URL(input.trim()); }
  catch { throw new Error('Bitte einen Raumcode oder einen vollständigen HTTPS-Einladungslink einfügen.'); }
  if (link.username || link.password || link.protocol !== 'https:' || /[\s\\]/.test(input.trim())) {
    throw new Error('Dieser Einladungslink ist ungültig. Bitte den HTTPS-Link oder nur den Raumcode verwenden.');
  }
  if (link.origin !== new URL(endpoint).origin) {
    throw new Error('Diese Einladung gehört zu ' + link.origin + '. Wähle diesen Spielserver zuerst in der Lobby unter „Spielserver“.');
  }
  return code;
}

export function invitationUrl(roomCode: string, endpoint: string, native = isNativeApp()): string {
  if (!ROOM_CODE.test(roomCode)) throw new Error('Ungültiger Raumcode.');
  const url = new URL(native ? normalizeNativeServerUrl(endpoint) + '/' : window.location.href);
  url.searchParams.set('room', roomCode);
  url.hash = '';
  return url.href;
}
