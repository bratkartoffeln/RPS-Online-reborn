import type { GameView } from '../shared/game';
import type { PortraitDirection, SkinDefinition, TeamColor } from './skin-types';
import { legacyTeamForColor, teamColorForPlayer, teamColorName } from './team-ui';

export type RefereeView = Pick<GameView, 'phase' | 'you' | 'players' | 'currentTurn' | 'winner' | 'paused'>;
export interface RefereePortrait {
  frame: string | undefined;
  team: TeamColor | null;
  direction: PortraitDirection | null;
  caption: string;
  label: string;
}

/** A resting portrait follows the confirmed turn or winner, independently of animations. */
export function refereePortrait(skin: SkinDefinition, view: RefereeView | null): RefereePortrait {
  const neutral = (caption: string, label = caption): RefereePortrait => ({
    frame: skin.portrait, team: null, direction: null, caption, label: `Schiedsrichter: ${label}`,
  });
  if (!view) return neutral('Stein · Papier · Schere', 'Noch keine Partie.');
  if (view.phase === 'waiting') return neutral('Warte auf einen Mitspieler.');
  if (view.phase === 'setup') return neutral('Aufstellung vorbereiten.');
  if (view.phase === 'duel') return neutral('Beide wählen im Duell.', 'Beide Spieler wählen im Duell.');
  const finished = view.phase === 'finished';
  if (finished && view.winner === null) return neutral('Unentschieden.', 'Die Partie endet unentschieden.');
  if (!finished && view.phase !== 'playing') return neutral('Zug wird aktualisiert.');
  const player = view.players.find((entry) => entry.id === (finished ? view.winner : view.currentTurn));
  if (!player || !view.players.some((entry) => entry.id === view.you)) return neutral(finished ? 'Partie beendet.' : 'Zug wird aktualisiert.');
  const own = player.id === view.you;
  const team = teamColorForPlayer(view, player.id);
  const direction: PortraitDirection = own ? 'bottom' : 'top';
  const color = teamColorName(team);
  const position = own ? 'unten' : 'oben';
  return {
    frame: skin.directionalTurnPortraits?.[team]?.[direction] ?? skin.colorTurnPortraits?.[team] ?? skin.turnPortraits?.[legacyTeamForColor(team)] ?? skin.portrait,
    team, direction,
    caption: (finished ? (own ? 'Du hast gewonnen' : 'Gegner gewinnt') : view.paused ? (own ? 'Pause · dein Zug' : 'Pause · Gegner am Zug') : (own ? 'Dein Zug' : 'Gegner am Zug')) + ' · ' + color,
    label: finished ? `Schiedsrichter: ${player.name}${own ? ' (du)' : ''} hat die Partie gewonnen (${color}, ${position} auf dem Spielfeld).` :
      `Schiedsrichter: ${view.paused ? 'Spiel pausiert. ' : ''}${player.name}${own ? ' (du)' : ''} ist am Zug (${color}, ${position} auf dem Spielfeld).`,
  };
}
