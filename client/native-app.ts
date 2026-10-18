import { isNativeApp } from './server-config';

export type BackState = { modal: boolean; menu: boolean; selection: boolean; room: boolean; connecting: boolean };
export type BackAction = 'close-modal' | 'close-menu' | 'clear-selection' | 'confirm-leave' | 'cancel-connect' | 'minimize';
export function nativeBackAction(state: BackState): BackAction {
  if (state.modal) return 'close-modal';
  if (state.menu) return 'close-menu';
  if (state.selection) return 'clear-selection';
  if (state.room) return 'confirm-leave';
  if (state.connecting) return 'cancel-connect';
  return 'minimize';
}

/** Android and WebView visibility events can be repeated or arrive out of order. */
export class AppVisibility {
  private nativeActive = true;
  private pageVisible = true;
  private active = true;
  constructor(private onChange: (active: boolean) => void) {}
  update(source: 'native' | 'page', visible: boolean): void {
    if (source === 'native') this.nativeActive = visible;
    else this.pageVisible = visible;
    const next = this.nativeActive && this.pageVisible;
    if (next === this.active) return;
    this.active = next;
    this.onChange(next);
  }
}

export async function installNativeLifecycle(callbacks: { onActive: (active: boolean) => void; onBack: () => void; onOnline: () => void }): Promise<void> {
  if (!isNativeApp()) return;
  const visibility = new AppVisibility(callbacks.onActive);
  document.addEventListener('visibilitychange', () => visibility.update('page', !document.hidden));
  window.addEventListener('online', callbacks.onOnline);
  visibility.update('page', !document.hidden);
  const { App } = await import('@capacitor/app');
  // Register before querying the state so startup does not miss a backgrounding.
  let stateEvents = 0;
  await App.addListener('appStateChange', ({ isActive }) => { stateEvents++; visibility.update('native', isActive); });
  await App.addListener('backButton', callbacks.onBack);
  const beforeQuery = stateEvents;
  const { isActive } = await App.getState();
  if (stateEvents === beforeQuery) visibility.update('native', isActive);
}

export async function minimizeNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  await App.minimizeApp();
}

export async function copyText(text: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
      return;
    } catch { /* Keep the WebView fallback available if a device denies the plugin. */ }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the legacy gesture path next. */ }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  try {
    field.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
  } finally { field.remove(); }
}

/** Called only by an explicit Share button; cancelling the system sheet is normal. */
export async function shareInvitation(url: string): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (!isNativeApp()) return 'unavailable';
  const { Share } = await import('@capacitor/share');
  if (!(await Share.canShare()).value) return 'unavailable';
  try {
    await Share.share({ title: 'RPS Arena', text: 'Spiel mit mir eine Partie RPS Arena!', url, dialogTitle: 'Mitspieler einladen' });
    return 'shared';
  } catch { return 'cancelled'; }
}
