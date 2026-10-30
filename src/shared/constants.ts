import type { Difficulty } from './types';

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const ROUNDS_PER_GAME = 5;
export const ROUND_MS = 90_000;
export const SUMMARY_MS = 6_000;
export const RECONNECT_GRACE_MS = 60_000;
export const ROOM_IDLE_MS = 30 * 60_000;

export const BALLOONS: Record<Difficulty, number> = { easy: 8, medium: 7, hard: 6 };
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;
export const NAME_MAX = 16;

/** Characters that may appear in answers and are revealed automatically. */
export const AUTO_REVEAL = "'-&!?.,";

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
