import raw from './data/words.json';
import { AUTO_REVEAL, DIFFICULTIES } from '../shared/constants';
import type { Difficulty } from '../shared/types';
import { normalizeAnswer } from './engine';

export interface WordEntry {
  id: string;
  answer: string;
  hint: string;
  difficulty: Difficulty;
}

type RawWords = Record<Difficulty, [string, string][]>;

export const WORDS: Record<Difficulty, WordEntry[]> = Object.fromEntries(
  DIFFICULTIES.map((d) => [
    d,
    (raw as RawWords)[d].map(([answer, hint], i) => ({
      id: `${d}-${i}`,
      answer: normalizeAnswer(answer),
      hint,
      difficulty: d,
    })),
  ]),
) as Record<Difficulty, WordEntry[]>;

const LENGTH_BOUNDS: Record<Difficulty, [number, number]> = {
  easy: [4, 10],
  medium: [5, 18],
  hard: [4, 30],
};

/** Returns a list of problems with the word list (empty = all good). */
export function validateWords(words = WORDS): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const allowed = new RegExp(`^[A-Z ${AUTO_REVEAL.replace(/[-\\\]^]/g, '\\$&')}]+$`);
  for (const d of DIFFICULTIES) {
    const [min, max] = LENGTH_BOUNDS[d];
    for (const w of words[d]) {
      const where = `${d}: "${w.answer}"`;
      if (!allowed.test(w.answer)) problems.push(`${where} has characters that aren't allowed`);
      if (!/[A-Z]/.test(w.answer)) problems.push(`${where} has no letters`);
      if (seen.has(w.answer)) problems.push(`${where} is a duplicate`);
      seen.add(w.answer);
      if (w.answer.length < min || w.answer.length > max)
        problems.push(`${where} length ${w.answer.length} is outside ${min}-${max}`);
      if (d === 'easy' && w.answer.includes(' ')) problems.push(`${where} easy words should be one word`);
      if (!w.hint.trim()) problems.push(`${where} has no hint`);
      const hint = w.hint.toUpperCase();
      for (const part of w.answer.split(/[^A-Z]+/).filter((p) => p.length >= 4)) {
        if (hint.includes(part)) problems.push(`${where} hint gives away "${part}"`);
      }
    }
  }
  return problems;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `count` words, avoiding ones already used in this room until the pool runs dry. */
export function pickWords(difficulty: Difficulty, count: number, used: Set<string>): WordEntry[] {
  const pool = WORDS[difficulty];
  let fresh = pool.filter((w) => !used.has(w.id));
  if (fresh.length < count) {
    for (const w of pool) used.delete(w.id);
    fresh = pool;
  }
  const picked = shuffle(fresh).slice(0, count);
  for (const w of picked) used.add(w.id);
  return picked;
}
