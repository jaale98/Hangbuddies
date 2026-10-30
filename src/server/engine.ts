// Pure game logic: no sockets, no timers, no randomness. Easy to unit test.
import type { RoundStatus, Tile } from '../shared/types';

export interface PlayerRoundState {
  guessed: string[]; // letters in the order they were guessed
  wrong: number;
  status: RoundStatus;
  solvedAtMs: number | null;
  points: number;
}

export const newRoundState = (status: RoundStatus = 'playing'): PlayerRoundState => ({
  guessed: [],
  wrong: 0,
  status,
  solvedAtMs: null,
  points: 0,
});

const isLetter = (ch: string) => ch >= 'A' && ch <= 'Z';

export function normalizeAnswer(answer: string): string {
  return answer.toUpperCase().replace(/\s+/g, ' ').trim();
}

export function lettersIn(answer: string): Set<string> {
  return new Set([...answer].filter(isLetter));
}

/** Split the answer into words of tiles, hiding letters that haven't been guessed. */
export function maskAnswer(answer: string, guessed: Iterable<string>, revealAll = false): Tile[][] {
  const known = new Set(guessed);
  return answer.split(' ').map((word) =>
    [...word].map((ch): Tile => {
      if (isLetter(ch)) return { ch: revealAll || known.has(ch) ? ch : null };
      // Punctuation (see AUTO_REVEAL) is always shown.
      return { ch, punct: true };
    }),
  );
}

/** 100 points for any solve, plus up to 900 more for speed. */
export function computePoints(elapsedMs: number, roundMs: number): number {
  const remaining = Math.max(0, Math.min(roundMs, roundMs - elapsedMs));
  return 100 + Math.round((900 * remaining) / roundMs);
}

export type GuessResult =
  | { kind: 'ignored' }
  | { kind: 'guessed'; correct: boolean; solved: boolean; fell: boolean; points: number };

export function applyGuess(
  state: PlayerRoundState,
  answer: string,
  letter: string,
  maxBalloons: number,
  elapsedMs: number,
  roundMs: number,
): GuessResult {
  if (state.status !== 'playing' || state.guessed.includes(letter)) return { kind: 'ignored' };

  state.guessed.push(letter);
  const needed = lettersIn(answer);
  const correct = needed.has(letter);
  let solved = false;
  let fell = false;

  if (correct) {
    solved = [...needed].every((l) => state.guessed.includes(l));
    if (solved) {
      state.status = 'solved';
      state.solvedAtMs = elapsedMs;
      state.points = computePoints(elapsedMs, roundMs);
    }
  } else {
    state.wrong += 1;
    if (state.wrong >= maxBalloons) {
      fell = true;
      state.status = 'fell';
    }
  }
  return { kind: 'guessed', correct, solved, fell, points: state.points };
}

export interface Rankable {
  id: string;
  score: number;
  totalSolveMs: number;
}

/** Sort by score desc, then total solve time asc. Exact ties share a place. */
export function rankPlayers<T extends Rankable>(players: T[]): (T & { place: number })[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.totalSolveMs - b.totalSolveMs);
  let place = 0;
  return sorted.map((p, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.score !== p.score || prev.totalSolveMs !== p.totalSolveMs) place = i + 1;
    return { ...p, place };
  });
}
