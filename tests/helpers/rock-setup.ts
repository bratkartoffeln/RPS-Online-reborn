import assert from 'node:assert/strict';
import type { Room } from '@colyseus/sdk';
import type { GameView } from '../../shared/game.js';
import type { Snapshot } from '../../shared/protocol.js';

/** Only central cells may receive an immobile piece; fighter swaps cannot seal a corner. */
export function rockSetupSwaps(view: GameView, target: number) {
  assert.equal(view.board[target]?.owner, view.you);
  assert.ok(target % 7 >= 2 && target % 7 <= 4, 'The duel staging cell must be away from corners');
  const board = [...view.board];
  const swaps: Array<{ from: number; to: number; pieceId: string }> = [];
  const swap = (from: number, to: number) => {
    assert.ok(from >= 0 && from !== to, 'A distinct own source must exist');
    swaps.push({ from, to, pieceId: board[from]!.id });
    [board[from], board[to]] = [board[to], board[from]];
  };
  if (board[target]?.kind === 'flag' || board[target]?.kind === 'trap') {
    const parking = board.findIndex((piece, cell) => cell !== target && cell % 7 >= 2 && cell % 7 <= 4 &&
      piece?.owner === view.you && ['rock', 'paper', 'scissors'].includes(piece.kind ?? ''));
    swap(parking, target);
  }
  if (board[target]?.kind !== 'rock') {
    swap(board.findIndex(piece => piece?.owner === view.you && piece.kind === 'rock'), target);
  }
  return swaps;
}

type SetupObserver = {
  room: Pick<Room, 'send'>;
  snapshot: Snapshot | undefined;
  problems: string[];
  wait(predicate: (snapshot: Snapshot) => boolean): Promise<Snapshot>;
};

export async function stageRock(observer: SetupObserver, target: number): Promise<void> {
  assert.ok(observer.snapshot);
  const problemsBefore = observer.problems.length;
  for (const swap of rockSetupSwaps(observer.snapshot, target)) {
    observer.room.send('swap', { from: swap.from, to: swap.to });
    await observer.wait(snapshot => {
      const problems = observer.problems.slice(problemsBefore);
      if (problems.length) throw new Error(`Serverfehler beim Vorbereiten der Duell-Steine: ${problems.join('; ')}`);
      return snapshot.board[swap.to]?.id === swap.pieceId;
    });
  }
  assert.equal(observer.snapshot.board[target]?.kind, 'rock');
}
