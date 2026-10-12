import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../shared/game';
import { readSeriesMode, seriesAnnouncement, seriesModeDescription, seriesScoreMarkup, seriesVoteStatus, seriesWinnerText } from './series-ui';

function snapshot(): GameView {
  return {
    revision: 40, phase: 'finished', you: 'ada', paused: false,
    players: [
      { id: 'ada', name: 'Ada', seat: 0, connected: true, ready: true, restartRequested: false, newSeriesRequested: false },
      { id: 'ben', name: 'Ben', seat: 1, connected: true, ready: true, restartRequested: false, newSeriesRequested: false },
    ],
    board: [], currentTurn: null, turnNumber: 300, winner: null, finishReason: 'turn_limit',
    duel: null, lastAction: null, legalMoves: {}, log: [],
    series: {
      id: 'series-one', number: 1, mode: 'best-of-3', matchId: 'match-six', gameNumber: 6,
      completedGames: 6, draws: 4, winsByPlayer: { ada: 1, ben: 1 }, targetWins: 2,
      winner: null, startingSeat: 1, startingPlayer: 'ben',
    },
  };
}

test('mode preferences fall back to a free series and explain wins rather than a hard game limit', () => {
  assert.equal(readSeriesMode(null), 'free');
  assert.equal(readSeriesMode('invalid-from-old-storage'), 'free');
  assert.equal(readSeriesMode('best-of-3'), 'best-of-3');
  assert.equal(readSeriesMode('best-of-5'), 'best-of-5');
  assert.match(seriesModeDescription('best-of-3'), /zuerst 2 Partien gewinnt/);
  assert.match(seriesModeDescription('best-of-5'), /zuerst 3 Partien gewinnt/);
  assert.match(seriesModeDescription('best-of-3'), /Remis zählen nicht als Sieg/);
});

test('a restored series shows authoritative scores, draws and the actual first player', () => {
  const view = snapshot();
  const html = seriesScoreMarkup(view);
  assert.match(html, /Best of 3 · Serie 1/);
  assert.match(html, /Ziel: 2 Siege/);
  assert.match(html, /aria-label="1 eigene Siege"/);
  assert.match(html, /aria-label="1 gegnerische Siege"/);
  assert.match(html, /Partie 6 · 6 beendet · 4 Remis/);
  assert.match(html, /Erster Zug: Ben/);
  assert.doesNotMatch(html, /class="series-winner"/);
  assert.match(seriesAnnouncement(view), /Ada: 1 Sieg, Ben: 1 Sieg\. 4 Remis\./);
});

test('opponent names and winner announcements cannot inject markup into the scoreboard', () => {
  const view = snapshot();
  view.players[1].name = '<img src=x onerror="alert(1)"> & Ben';
  view.series.winner = 'ben';
  view.series.winsByPlayer.ben = 2;
  const html = seriesScoreMarkup(view);
  assert.doesNotMatch(html, /<img|onerror="/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; Ben/);
  assert.match(html, /gewinnt die Serie\./);
  view.series.winner = 'ada';
  assert.equal(seriesWinnerText(view), 'Du gewinnst die Serie!');
});

test('scores, first player and series winner keep their seat color for either viewer', () => {
  const view = snapshot();
  view.series.winsByPlayer = { ada: 1, ben: 2 };
  view.series.winner = 'ben';
  for (const you of ['ada', 'ben']) {
    const html = seriesScoreMarkup({ ...view, you, players: [...view.players].reverse() });
    const rows = [...html.matchAll(/<div class="series-player(?: enemy)?" data-team-color="(blue|red)">([\s\S]*?)<\/div>/g)];
    assert.equal(rows.length, 2);
    const blue = rows.find((row) => row[1] === 'blue')?.[2] ?? '';
    const red = rows.find((row) => row[1] === 'red')?.[2] ?? '';
    assert.match(blue, /class="series-player-name">Ada<small>Blau/);
    assert.match(blue, /class="series-player-score"[^>]*>1<\/strong>/);
    assert.match(red, /class="series-player-name">Ben<small>Rot/);
    assert.match(red, /class="series-player-score"[^>]*>2<\/strong>/);
    assert.match(html, /class="series-starting-player" data-team-color="red">Erster Zug: Ben/);
    assert.match(html, /class="series-winner" data-team-color="red">/);
    assert.match(html, new RegExp('class="series-player" data-team-color="' + (you === 'ada' ? 'blue' : 'red') + '"'));
  }
});

test('a vacant first-player seat still has the seat color and an unknown winner has no invented team', () => {
  const view = snapshot();
  view.players = view.players.filter((player) => player.id === 'ada');
  view.series.winner = 'missing';
  const html = seriesScoreMarkup(view);
  assert.match(html, /class="series-starting-player" data-team-color="red">Erster Zug: Spieler auf Platz 2/);
  assert.match(html, /class="series-winner">Ein Spieler gewinnt die Serie\./);
});

test('different transition votes are explained as a disagreement and can be changed', () => {
  const view = snapshot();
  view.players[0].restartRequested = true;
  view.players[1].newSeriesRequested = true;
  assert.match(seriesVoteStatus(view), /Du möchtest die nächste Partie, Ben möchte eine neue Serie/);
  assert.match(seriesVoteStatus(view), /Wählt dieselbe Option/);
  view.players[0].restartRequested = false;
  assert.match(seriesVoteStatus(view), /Ben möchte eine neue Serie\. Bestätige dieselbe Option/);
  view.players[1].newSeriesRequested = false;
  view.players[0].newSeriesRequested = true;
  assert.match(seriesVoteStatus(view), /Du möchtest eine neue Serie\. Wir warten auf die Zustimmung von Ben/);
});
