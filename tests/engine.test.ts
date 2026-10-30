import { describe, expect, it } from 'vitest';
import { applyGuess, computePoints, maskAnswer, newRoundState, rankPlayers } from '../src/server/engine';
import { validateWords, WORDS } from '../src/server/words';

describe('maskAnswer', () => {
  it('hides unguessed letters, splits words, and shows punctuation', () => {
    const words = maskAnswer("IT'S A DOG", ['A', 'T']);
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual([{ ch: null }, { ch: 'T' }, { ch: "'", punct: true }, { ch: null }]);
    expect(words[1]).toEqual([{ ch: 'A' }]);
  });

  it('reveals everything when asked', () => {
    expect(maskAnswer('CAT', [], true)[0].map((t) => t.ch).join('')).toBe('CAT');
  });
});

describe('computePoints', () => {
  it('gives ~1000 for instant and ~100 at the buzzer', () => {
    expect(computePoints(0, 90_000)).toBe(1000);
    expect(computePoints(45_000, 90_000)).toBe(550);
    expect(computePoints(90_000, 90_000)).toBe(100);
    expect(computePoints(999_999, 90_000)).toBe(100);
  });
});

describe('applyGuess', () => {
  it('reveals correct letters and solves', () => {
    const s = newRoundState();
    expect(applyGuess(s, 'DAD', 'D', 6, 1000, 90_000)).toMatchObject({ kind: 'guessed', correct: true, solved: false });
    const r = applyGuess(s, 'DAD', 'A', 6, 9000, 90_000);
    expect(r).toMatchObject({ correct: true, solved: true, points: 910 });
    expect(s.status).toBe('solved');
    expect(s.solvedAtMs).toBe(9000);
  });

  it('pops balloons and falls on the last one', () => {
    const s = newRoundState();
    const misses = 'QWXYZ'.split('');
    for (const l of misses.slice(0, 2)) expect(applyGuess(s, 'CAT', l, 3, 0, 1).kind).toBe('guessed');
    expect(s.wrong).toBe(2);
    expect(applyGuess(s, 'CAT', 'Z', 3, 0, 1)).toMatchObject({ fell: true });
    expect(s.status).toBe('fell');
    expect(applyGuess(s, 'CAT', 'C', 3, 0, 1).kind).toBe('ignored');
  });

  it('ignores duplicate guesses', () => {
    const s = newRoundState();
    applyGuess(s, 'CAT', 'Q', 6, 0, 1);
    expect(applyGuess(s, 'CAT', 'Q', 6, 0, 1).kind).toBe('ignored');
    expect(s.wrong).toBe(1);
  });
});

describe('rankPlayers', () => {
  it('sorts by score, breaks ties by solve time, shares exact ties', () => {
    const ranked = rankPlayers([
      { id: 'a', score: 500, totalSolveMs: 10 },
      { id: 'b', score: 900, totalSolveMs: 99 },
      { id: 'c', score: 500, totalSolveMs: 5 },
      { id: 'd', score: 500, totalSolveMs: 5 },
    ]);
    expect(ranked.map((p) => [p.id, p.place])).toEqual([
      ['b', 1],
      ['c', 2],
      ['d', 2],
      ['a', 4],
    ]);
  });
});

describe('word list', () => {
  it('is valid and big enough', () => {
    expect(validateWords()).toEqual([]);
    for (const list of Object.values(WORDS)) expect(list.length).toBeGreaterThanOrEqual(150);
  });
});
