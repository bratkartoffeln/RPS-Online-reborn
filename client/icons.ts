export type IconName = 'rock' | 'paper' | 'scissors' | 'flag' | 'trap' | 'unknown' | 'arrow' | 'copy' | 'shuffle' | 'check' | 'close' | 'link' | 'info' | 'chevron' | 'refresh' | 'leave';

const paths: Record<IconName, string> = {
  rock: '<path d="m8 4 9 1 4 7-5 8H7l-4-8 5-8Z"/><path d="m8 4 3 8 10 0M11 12l-4 8m4-8 5 8" opacity=".5"/>',
  paper: '<path d="M6 3h9l4 4v14H6V3Z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/>',
  scissors: '<circle cx="6" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="m8 15 10-12M15 15 5 3m6 10 2 0"/>',
  flag: '<path d="M6 21V3m0 1h12l-3 4 3 4H6M3 21h6"/>',
  trap: '<path d="m4 6 5 5m6 2 5 5M4 18l5-5m6-2 5-5M4 3v6h6M20 3v6h-6M4 21v-6h6m10 6v-6h-6"/><circle cx="12" cy="12" r="3"/>',
  unknown: '<path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4H4v11h4"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-5-4 4 4-4 4M3 18h3c2 0 4-3 6-6m2-4c1-1 2-2 4-2h3m-5-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  link: '<path d="m9 15 6-6m-8 9-1 1a4.24 4.24 0 0 1-6-6l5-5a4.24 4.24 0 0 1 6 0m2-2 1-1a4.24 4.24 0 0 1 6 6l-5 5a4.24 4.24 0 0 1-6 0" transform="translate(2 0)"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  chevron: '<path d="m8 4 8 8-8 8"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2"/>',
  leave: '<path d="M9 4H4v16h5m-1-8h13m-5-5 5 5-5 5"/>',
};

export function icon(name: IconName, className = '', size = 20): string {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!));
}
