import type { GameView } from '../shared/game';
import { escapeHtml as esc } from './icons';
import { teamColorForSeat } from './team-ui';
import type { TeamColor } from './skin-types';

export interface EndgameModel {
  matchId: string;
  title: string;
  winnerTeam: TeamColor | null;
  left: { name: string; team: TeamColor; mood: 'sad' | 'neutral' };
  right: { name: string; team: TeamColor; mood: 'happy' | 'neutral' };
}

/** Absolute seat colors stay the same in both viewers; never infer a winner from the last capture. */
export function endgameModel(view: GameView | null): EndgameModel | null {
  if (!view || view.phase !== 'finished' || view.players.length !== 2) return null;
  const winner = view.players.find(player => player.id === view.winner);
  if (view.winner !== null && !winner) return null;
  const loser = winner ? view.players.find(player => player.id !== winner.id)! : null;
  const left = loser ?? view.players.find(player => player.seat === 0)!;
  const right = winner ?? view.players.find(player => player.seat === 1)!;
  return {
    matchId: view.series.id + ':' + view.series.matchId,
    title: winner ? winner.name + ' gewinnt!' : 'Unentschieden',
    winnerTeam: winner ? teamColorForSeat(winner.seat) : null,
    left: { name: left.name, team: teamColorForSeat(left.seat), mood: loser ? 'sad' : 'neutral' },
    right: { name: right.name, team: teamColorForSeat(right.seat), mood: winner ? 'happy' : 'neutral' },
  };
}

export class EndgameOverlay {
  private markup = '';
  constructor(private readonly root: HTMLElement) {
    root.classList.add('endgame-overlay');
    root.hidden = true;
  }

  update(view: GameView | null, battleBusy: boolean): void {
    const model = endgameModel(view);
    this.root.hidden = !model || battleBusy;
    if (!model) {
      this.root.replaceChildren();
      this.markup = '';
      delete this.root.dataset.winnerTeam;
      return;
    }
    this.root.dataset.winnerTeam = model.winnerTeam ?? 'draw';
    const figure = (player: EndgameModel['left'] | EndgameModel['right']) => '<figure class="endgame-player" data-team-color="' + player.team + '" data-mood="' + player.mood + '"><img src="/endgame/' + player.team + '-' + player.mood + '.svg" alt="' + (player.mood === 'happy' ? 'Der Gewinner freut sich' : player.mood === 'sad' ? 'Der Verlierer ist traurig' : 'Unentschieden') + '" /><figcaption>' + esc(player.name) + '</figcaption></figure>';
    const markup = '<section class="endgame-result" data-match-id="' + esc(model.matchId) + '" role="status" aria-live="polite" aria-atomic="true"><h2>' + esc(model.title) + '</h2><div class="endgame-cast">' + figure(model.left) + '<figure class="endgame-referee"><img src="/endgame/referee-' + (model.winnerTeam ?? 'neutral') + '.svg" alt="' + (model.winnerTeam ? 'Der Schiedsrichter hebt die ' + (model.winnerTeam === 'blue' ? 'blaue' : 'rote') + ' Gewinnerfahne' : 'Der Schiedsrichter zeigt ein Unentschieden') + '" /></figure>' + figure(model.right) + '</div></section>';
    if (markup !== this.markup) { this.root.innerHTML = markup; this.markup = markup; }
  }
}
