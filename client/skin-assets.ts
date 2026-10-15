import type { LoadedSkin } from './skin-types';

/** Non-atlas resources always belong to the selected pack, including runtime overrides. */
export function skinAssetUrl(skin: Pick<LoadedSkin, 'id'>, relative: string): string {
  return `/skins/${skin.id}/${relative}`;
}
