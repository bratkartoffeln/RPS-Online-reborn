import type { GameView } from '../shared/game';
import { escapeHtml as esc } from './icons';
import { teamColorForSeat } from './team-ui';
import type { LoadedSkin, TeamColor } from './skin-types';
import { skinAssetUrl } from './skin-assets';

/** Artwork is selected by manifest, without special cases for design IDs. */
export function endgameArtDirectory(skin?: LoadedSkin): string {
  return skin?.definition.artwork?.endgame
    ? skinAssetUrl(skin, skin.definition.artwork.endgame) + '/'
    : '/skins/classic/endgame/';
}

export interface EndgameModel {
  matchId: string;
  title: string;
  winnerTeam: TeamColor | null;
  left: { name: string; team: TeamColor; mood: 'happy' | 'sad' | 'neutral' };
  right: { name: string; team: TeamColor; mood: 'happy' | 'sad' | 'neutral' };
}

/** Absolute seat colors stay the same in both viewers; never infer a winner from the last capture. */
export function endgameModel(view: GameView | null): EndgameModel | null {
  if (!view || view.phase !== 'finished' || view.players.length !== 2) return null;
  const winner = view.players.find(player => player.id === view.winner);
  if (view.winner !== null && !winner) return null;
  const left = view.players.find(player => player.seat === 0);
  const right = view.players.find(player => player.seat === 1);
  if (!left || !right) return null;
  const mood = (id: string) => !winner ? 'neutral' : id === winner.id ? 'happy' : 'sad';
  return {
    matchId: view.series.id + ':' + view.series.matchId,
    title: winner ? winner.id === view.you ? 'Du hast gewonnen!' : 'Du hast verloren.' : 'Unentschieden',
    winnerTeam: winner ? teamColorForSeat(winner.seat) : null,
    left: { name: left.name, team: teamColorForSeat(left.seat), mood: mood(left.id) },
    right: { name: right.name, team: teamColorForSeat(right.seat), mood: mood(right.id) },
  };
}

export class EndgameOverlay {
  private markup = '';
  constructor(private readonly root: HTMLElement) {
    root.classList.add('endgame-overlay');
    root.hidden = true;
  }

  update(view: GameView | null, battleBusy: boolean, skin?: LoadedSkin): void {
    const model = endgameModel(view);
    this.root.hidden = !model || battleBusy;
    if (!model) {
      this.root.replaceChildren();
      this.markup = '';
      delete this.root.dataset.winnerTeam;
      return;
    }
    this.root.dataset.winnerTeam = model.winnerTeam ?? 'draw';
    const directory = endgameArtDirectory(skin);
    const figure = (player: EndgameModel['left'] | EndgameModel['right']) => '<figure class="endgame-player" data-team-color="' + player.team + '" data-mood="' + player.mood + '"><img src="' + directory + player.team + '-' + player.mood + '.svg" alt="' + (player.mood === 'happy' ? 'Siegerteam' : player.mood === 'sad' ? 'Unterlegenes Team' : 'Unentschieden') + '" /><figcaption>' + esc(player.name) + '</figcaption></figure>';
    const markup = '<section class="endgame-result" data-match-id="' + esc(model.matchId) + '" role="status" aria-live="polite" aria-atomic="true"><h2>' + esc(model.title) + '</h2><div class="endgame-cast">' + figure(model.left) + '<figure class="endgame-referee"><img src="' + directory + 'referee-' + (model.winnerTeam ?? 'neutral') + '.svg" alt="' + (model.winnerTeam ? 'Siegeranzeige: ' + (model.winnerTeam === 'blue' ? 'Blau' : 'Rot') + (model.winnerTeam === 'blue' ? ', links' : ', rechts') : 'Unentschieden') + '" /></figure>' + figure(model.right) + '</div></section>';
    if (markup !== this.markup) { this.root.innerHTML = markup; this.markup = markup; }
  }
}
