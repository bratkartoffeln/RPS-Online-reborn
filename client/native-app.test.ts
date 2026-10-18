import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { AppVisibility, nativeBackAction } from './native-app';
import { DEFAULT_NATIVE_SERVER, invitationUrl, normalizeNativeServerUrl, roomCodeForServer, saveNativeServer, serverEndpoint } from './server-config';
import { ReconnectStore } from './session-store';

const globals = new Map(['window', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { href: 'https://localhost/?old=value#ignore', origin: 'https://localhost' } } });
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: memoryStorage() });
});
afterEach(() => {
  for (const [key, original] of globals) {
    if (original) Object.defineProperty(globalThis, key, original);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('native server defaults never use the bundled asset origin and migration overrides persist', () => {
  assert.equal(serverEndpoint(true), DEFAULT_NATIVE_SERVER);
  assert.equal(saveNativeServer('  https://GAMES.example:8443/  '), 'https://games.example:8443');
  assert.equal(serverEndpoint(true), 'https://games.example:8443');
  localStorage.setItem('rps-arena:android:server', 'javascript:alert(1)');
  assert.equal(serverEndpoint(true), DEFAULT_NATIVE_SERVER);
  assert.equal(serverEndpoint(false), 'https://localhost', 'the unchanged browser path uses its hosting origin');
});

test('native server validation rejects credentials, insecure schemes, paths and URL parser repairs', () => {
  assert.equal(normalizeNativeServerUrl('https://game.example:443/'), 'https://game.example');
  assert.equal(normalizeNativeServerUrl('https://[2001:db8::1]:8443'), 'https://[2001:db8::1]:8443');
  for (const url of [
    '', 'game.example', 'http://game.example', 'ws://game.example', 'wss://game.example',
    'https://user:secret@game.example', 'https://@game.example', 'https://game.example/path',
    'https://game.example/./', 'https://game.example//', 'https:///game.example',
    'https://game.example?room=abc', 'https://game.example?', 'https://game.example#',
    'https://game.\nexample', 'https://game.example\\evil', 'https://localhost:8443',
    'https://127.0.0.1', 'https://[::1]', 'https://sub.localhost',
  ]) assert.throws(() => normalizeNativeServerUrl(url), Error, url);
});

test('native invitations are public links and never implicitly route saved credentials to another server', () => {
  const server = 'https://game.example:8443';
  assert.equal(invitationUrl('AbC_123', server, true), server + '/?room=AbC_123');
  assert.equal(roomCodeForServer('AbC_123', server, true), 'AbC_123');
  assert.equal(roomCodeForServer(server + '/?room=AbC_123', server, true), 'AbC_123');
  assert.throws(() => roomCodeForServer('https://other.example/?room=AbC_123', server, true), /Spielserver/);
  assert.throws(() => roomCodeForServer('https://game.example/?room=AbC_123', server, true), /Spielserver/, 'ports belong to the server identity');
  assert.throws(() => roomCodeForServer('https://user:secret@game.example:8443/?room=AbC_123', server, true), /ungültig/);
  assert.throws(() => roomCodeForServer('/?room=AbC_123', server, true), /vollständigen HTTPS/);
  assert.equal(roomCodeForServer('https://other.example/?room=AbC_123', server, false), 'AbC_123', 'existing browser room-code parsing is retained');
  assert.equal(invitationUrl('AbC_123', server, false), 'https://localhost/?old=value&room=AbC_123');
});

test('native reconnect tokens and last room survive recreation but are isolated by server origin and port', () => {
  const first = new ReconnectStore('https://game.example:8443', true);
  const second = new ReconnectStore('https://other.example', true);
  const otherPort = new ReconnectStore('https://game.example:443', true);
  first.save('sameRoom', 'sameRoom:private-token');
  const recreated = new ReconnectStore('https://game.example:8443/', true);
  assert.equal(recreated.lastRoom(), 'sameRoom');
  assert.equal(recreated.token('sameRoom'), 'sameRoom:private-token');
  assert.equal(second.token('sameRoom'), null);
  assert.equal(otherPort.token('sameRoom'), null);
  assert.equal(second.lastRoom(), null);
  second.save('sameRoom', 'sameRoom:another-token');
  first.forget('sameRoom');
  assert.equal(recreated.lastRoom(), null);
  assert.equal(recreated.token('sameRoom'), null);
  assert.equal(second.token('sameRoom'), 'sameRoom:another-token');
});

test('browser sessions keep the existing per-tab key and cannot consume native persisted seats', () => {
  const native = new ReconnectStore('https://game.example', true);
  const browser = new ReconnectStore('https://game.example', false);
  native.save('nativeRoom', 'nativeRoom:native-token');
  browser.save('browserRoom', 'browserRoom:browser-token');
  assert.equal(sessionStorage.getItem('rps-arena:reconnect:browserRoom'), 'browserRoom:browser-token');
  assert.equal(browser.token('nativeRoom'), null);
  assert.equal(native.token('browserRoom'), null);
  assert.equal(browser.lastRoom(), null);
});

test('Android back dismisses local layers before asking to abandon a room and minimizes only in the lobby', () => {
  const all = { modal: true, menu: true, selection: true, room: true, connecting: true };
  assert.equal(nativeBackAction(all), 'close-modal');
  assert.equal(nativeBackAction({ ...all, modal: false }), 'close-menu');
  assert.equal(nativeBackAction({ ...all, modal: false, menu: false }), 'clear-selection');
  assert.equal(nativeBackAction({ ...all, modal: false, menu: false, selection: false }), 'confirm-leave');
  assert.equal(nativeBackAction({ modal: false, menu: false, selection: false, room: false, connecting: true }), 'cancel-connect');
  assert.equal(nativeBackAction({ modal: false, menu: false, selection: false, room: false, connecting: false }), 'minimize');
});

test('native and WebView visibility must both be active before foreground effects or sync restart', () => {
  const events: boolean[] = [];
  const visibility = new AppVisibility(active => events.push(active));
  visibility.update('native', false);
  visibility.update('native', false);
  visibility.update('page', false);
  visibility.update('native', true);
  assert.deepEqual(events, [false]);
  visibility.update('page', true);
  visibility.update('page', true);
  assert.deepEqual(events, [false, true]);
  visibility.update('page', false);
  visibility.update('page', true);
  assert.deepEqual(events, [false, true, false, true]);
});
