import { registerPlugin } from '@capacitor/core';
import { escapeHtml as esc } from './icons';

export const UPDATE_API = 'https://api.github.com/repos/bratkartoffeln/RPS-Online-reborn/releases/latest';
const DOWNLOAD_ROOT = 'https://github.com/bratkartoffeln/RPS-Online-reborn/releases/download/';
export interface AppUpdate { version: string; url: string }

function versionParts(version: string): number[] | null {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  const parts = version.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

/** Only offer a newer, published stable release with this app's exact APK asset. */
export function releaseUpdate(release: unknown, current: string): AppUpdate | null {
  if (!release || typeof release !== 'object') return null;
  const data = release as Record<string, unknown>;
  if (data.draft !== false || data.prerelease !== false || typeof data.tag_name !== 'string') return null;
  const version = data.tag_name.replace(/^v/, '');
  const next = versionParts(version), installed = versionParts(current);
  if (!next || !installed) return null;
  const different = next.findIndex((part, index) => part !== installed[index]);
  if (different < 0 || next[different] < installed[different] || !Array.isArray(data.assets)) return null;
  const filename = `RPS-Arena-${version}-debug.apk`;
  const url = DOWNLOAD_ROOT + encodeURIComponent(data.tag_name) + '/' + filename;
  return data.assets.some(asset => asset?.name === filename && asset?.browser_download_url === url && asset?.size > 0)
    ? { version, url } : null;
}

const nativeUpdate = registerPlugin<{ openDownload(options: { url: string }): Promise<void> }>('AppUpdate');

export class AppUpdates {
  private status: 'idle' | 'checking' | 'current' | 'available' | 'error' = 'idle';
  private update: AppUpdate | null = null;
  private lastCheck = 0;
  constructor(private version: string, private onChange: () => void,
    private request: typeof fetch = (...args) => fetch(...args), private download = (url: string) => nativeUpdate.openDownload({ url })) {}

  async check(manual = false): Promise<void> {
    if (this.status === 'checking' || (!manual && Date.now() - this.lastCheck < 3_600_000)) return;
    this.lastCheck = Date.now();
    this.status = 'checking';
    this.onChange();
    try {
      const response = await this.request(UPDATE_API, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10_000) });
      if (response.status === 404) this.update = null;
      else {
        if (!response.ok) throw new Error('Update service unavailable');
        this.update = releaseUpdate(await response.json(), this.version);
      }
      this.status = this.update ? 'available' : 'current';
    } catch { this.status = 'error'; }
    this.onChange();
  }

  async open(): Promise<void> {
    if (this.update) await this.download(this.update.url);
  }

  markup(): string {
    const message = this.update ? `Version ${this.update.version} ist verfügbar.` : this.status === 'checking'
      ? 'Suche nach Updates …' : this.status === 'current' ? 'Für diese App ist kein neueres Update verfügbar.'
        : this.status === 'error' ? 'Updatesuche gerade nicht erreichbar. Bitte später erneut versuchen.' : 'Updates werden über GitHub bereitgestellt.';
    return '<section class="native-updates" aria-label="App-Updates"><h2>App-Updates · v' + esc(this.version) + '</h2><p role="status">' + esc(message) + '</p>' +
      '<button type="button" class="secondary-button" data-action="check-update" id="check-update"' + (this.status === 'checking' ? ' disabled' : '') + '>Nach Updates suchen</button>' +
      (this.update ? '<button type="button" class="primary-button" data-action="download-update" id="download-update">Update herunterladen</button><small>APK anschließend in den Downloads öffnen und die Installation auf Android bestätigen. Deine App-Daten bleiben bei einem Update erhalten.</small>' : '') + '</section>';
  }
}
