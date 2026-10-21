import { SystemBars } from '@capacitor/core';
import { isNativeApp } from './server-config';
import { icon } from './icons';

/** Maximize the whole match, including the referee and the interactive overlays. */
export function installFullscreen(button: HTMLButtonElement, onChange: () => void) {
  const toolbar = button.parentElement!;
  const toolbarHome = toolbar.parentElement!;
  let active = false;
  let busy = false;
  let savedScroll = 0;

  function show(value: boolean): void {
    if (active === value) return;
    active = value;
    if (active) document.getElementById('shell')!.prepend(toolbar);
    else toolbarHome.prepend(toolbar);
    document.documentElement.classList.toggle('game-fullscreen', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Vollbild beenden' : 'Spielfeld und Schiedsrichter im Vollbild anzeigen');
    button.innerHTML = icon(active ? 'minimize' : 'maximize') + (active ? 'Vollbild beenden' : 'Vollbild');
    onChange();
    if (!active) window.scrollTo(0, savedScroll);
    button.focus({ preventScroll: true });
  }

  async function exit(): Promise<void> {
    if (!active || busy) return;
    busy = true;
    button.disabled = true;
    try {
      if (isNativeApp()) await SystemBars.show();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* The page layout must remain escapable even if the system API fails. */ }
    finally { show(false); busy = false; button.disabled = false; }
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    if (active) { await exit(); return; }
    savedScroll = window.scrollY;
    busy = true;
    button.disabled = true;
    show(true);
    try {
      if (isNativeApp()) await SystemBars.hide();
      else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
    } catch { /* The viewport-sized layout also works without browser fullscreen support. */ }
    finally { busy = false; button.disabled = false; }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) show(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !active || document.querySelector('#modal-root .modal')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void exit();
  }, { capture: true });
  return { get active() { return active; }, exit };
}
