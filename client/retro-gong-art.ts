export const RETRO_GONG_IMAGE = '/gong/icq-original-cutout.png';

/** Reuse the supplied bitmap, separating its existing mallet pixels with SVG masks. */
export function retroGongDrawing(id: string): string {
  const mallet = '<ellipse cx="278" cy="78" rx="24" ry="25"/><path d="M266 95 277 98 260 202 250 202Z"/><ellipse cx="266" cy="159" rx="8" ry="9"/>';
  return `<defs>
    <image id="${id}-bitmap" href="${RETRO_GONG_IMAGE}" x="0" y="4" width="320" height="232" preserveAspectRatio="xMidYMid meet"/>
    <clipPath id="${id}-mallet">${mallet}</clipPath>
    <mask id="${id}-body" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="240"><rect width="320" height="240" fill="white"/><g fill="black">${mallet}</g></mask>
  </defs>
  <g class="gong-disc"><use href="#${id}-bitmap" mask="url(#${id}-body)"/></g>
  <g class="gong-mallet" style="transform-origin:266px 159px"><g clip-path="url(#${id}-mallet)"><use href="#${id}-bitmap"/></g></g>`;
}
