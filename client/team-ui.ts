import type { GameView } from '../shared/game';
import type { SkinTeam, TeamColor } from './skin-types';

export function teamColorForSeat(seat: 0 | 1): TeamColor {
  return seat === 0 ? 'blue' : 'red';
}

/** Public seats determine color; camera orientation and the viewing player do not. */
export function teamColorForPlayer(view: Pick<GameView, 'players'> | null, playerId: string | null | undefined, fallback: TeamColor = 'blue'): TeamColor {
  const player = view?.players.find((entry) => entry.id === playerId);
  return player ? teamColorForSeat(player.seat) : fallback;
}

export function otherTeamColor(color: TeamColor): TeamColor {
  return color === 'blue' ? 'red' : 'blue';
}

export function teamColorName(color: TeamColor): 'Blau' | 'Rot' {
  return color === 'blue' ? 'Blau' : 'Rot';
}

/** Existing packs keep their original artwork slots, now fixed to player seats. */
export function legacyTeamForColor(color: TeamColor): SkinTeam {
  return color === 'blue' ? 'own' : 'enemy';
}
