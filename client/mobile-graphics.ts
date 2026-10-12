/** Match touch-first devices; desktop and hybrid mouse devices retain full graphics. */
export function mobileGraphics(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: none) and (pointer: coarse)').matches === true;
}

export function mobileRenderScale(width: number, height: number, pixelRatio: number): number {
  const fit = Math.min(width > 0 ? width / 680 : 1, height > 0 ? height / 616 : 1);
  const density = Number.isFinite(pixelRatio) ? Math.min(2, Math.max(1, pixelRatio)) : 1;
  return Math.max(0.25, Math.min(1, fit * density));
}
