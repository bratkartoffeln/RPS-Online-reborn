import type { GameView, SeriesMode } from '../shared/game';
import { escapeHtml as esc } from './icons';
import { otherTeamColor, teamColorForPlayer, teamColorForSeat, teamColorName } from './team-ui';

export function readSeriesMode(value: string | null | undefined): SeriesMode {
  return value === 'best-of-3' || value === 'best-of-5' ? value : 'free';
}

export function seriesModeLabel(mode: SeriesMode): string {
  return mode === 'best-of-3' ? 'Best of 3' : mode === 'best-of-5' ? 'Best of 5' : 'Freie Serie';
}

export function seriesModeDescription(mode: SeriesMode): string {
  if (mode === 'free') return 'Spielt beliebig viele Partien. Eure Siege werden im selben Raum weitergezählt.';
  return 'Wer zuerst ' + (mode === 'best-of-3' ? '2' : '3') + ' Partien gewinnt, gewinnt die Serie. Remis zählen nicht als Sieg.';
}

export function seriesWinnerText(view: GameView): string {
  if (!view.series.winner) return '';
  const name = view.players.find((player) => player.id === view.series.winner)?.name ?? 'Ein Spieler';
  return view.series.winner === view.you ? 'Du gewinnst die Serie!' : name + ' gewinnt die Serie.';
}

/** Plain text for the live region; scores always come from the server snapshot. */
export function seriesAnnouncement(view: GameView): string {
  const scores = view.players.map((player) => {
    const wins = view.series.winsByPlayer[player.id] ?? 0;
    return player.name + ': ' + wins + (wins === 1 ? ' Sieg' : ' Siege');
  }).join(', ');
  return 'Serie ' + view.series.number + ', Partie ' + view.series.gameNumber + '. ' + scores + '. ' +
    view.series.draws + ' Remis.' + (view.series.winner ? ' ' + seriesWinnerText(view) : '');
}

export function seriesScoreMarkup(view: GameView): string {
  const series = view.series;
  const own = view.players.find((player) => player.id === view.you);
  const other = view.players.find((player) => player.id !== view.you);
  const ownWins = own ? series.winsByPlayer[own.id] ?? 0 : 0;
  const otherWins = other ? series.winsByPlayer[other.id] ?? 0 : 0;
  const ownColor = teamColorForPlayer(view, own?.id);
  const otherColor = teamColorForPlayer(view, other?.id, otherTeamColor(ownColor));
  const nameMarkup = (name: string) => '<span class="series-player-name">' + esc(name) + '</span>';
  const first = view.players.find((player) => player.id === series.startingPlayer);
  const firstColor = teamColorForPlayer(view, first?.id, teamColorForSeat(series.startingSeat));
  const winner = seriesWinnerText(view);
  const winnerPlayer = view.players.find((player) => player.id === series.winner);
  const winnerColor = winnerPlayer ? ' data-team-color="' + teamColorForPlayer(view, winnerPlayer.id) + '"' : '';
  return [
    '<div class="series-scores"><div class="series-player" data-team-color="' + ownColor + '">' + nameMarkup(own?.name ?? 'Du') + '<strong class="series-player-score" aria-label="' + ownWins + ' eigene Siege">' + ownWins + '</strong></div>',
    '<span class="series-score-divider" aria-hidden="true">:</span>',
    '<div class="series-player enemy" data-team-color="' + otherColor + '"><strong class="series-player-score" aria-label="' + otherWins + ' gegnerische Siege">' + otherWins + '</strong>' + nameMarkup(other?.name ?? 'Platz noch frei') + '</div></div>',
    '<details class="series-info"><summary>' + seriesModeLabel(series.mode) + ' · Partie ' + series.gameNumber + '</summary><div class="series-heading"><h3>' + seriesModeLabel(series.mode) + ' · Serie ' + series.number + '</h3><span>' + (series.targetWins ? 'Ziel: ' + series.targetWins + ' Siege' : 'Ohne feste Siegzahl') + '</span></div>',
    '<div class="series-meta"><span>Partie ' + series.gameNumber + ' · ' + series.completedGames + ' beendet · ' + series.draws + ' Remis</span><span class="series-starting-player" data-team-color="' + firstColor + '">Erster Zug: ' + esc(first?.name ?? 'Spieler auf Platz ' + (series.startingSeat + 1)) + '</span></div></details>',
    winner ? '<p class="series-winner"' + winnerColor + '>' + esc(winner) + '</p>' : '',
  ].join('');
}

export function seriesVoteStatus(view: GameView): string {
  const own = view.players.find((player) => player.id === view.you);
  const other = view.players.find((player) => player.id !== view.you);
  const yourChoice = own?.newSeriesRequested ? 'eine neue Serie' : own?.restartRequested ? 'die nächste Partie' : null;
  const theirChoice = other?.newSeriesRequested ? 'eine neue Serie' : other?.restartRequested ? 'die nächste Partie' : null;
  if (yourChoice && theirChoice && yourChoice !== theirChoice) {
    return 'Du möchtest ' + yourChoice + ', ' + (other?.name ?? 'dein Gegner') + ' möchte ' + theirChoice + '. Wählt dieselbe Option, damit es weitergeht.';
  }
  if (yourChoice) return 'Du möchtest ' + yourChoice + '. Wir warten auf die Zustimmung von ' + (other?.name ?? 'deinem Gegner') + '.';
  if (theirChoice) return (other?.name ?? 'Dein Gegner') + ' möchte ' + theirChoice + '. Bestätige dieselbe Option, um gemeinsam zu starten.';
  return 'Es geht weiter, sobald ihr beide dieselbe Option gewählt habt.';
}
