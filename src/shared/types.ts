export type Difficulty = 'easy' | 'medium' | 'hard';
export type Phase = 'lobby' | 'round' | 'roundSummary' | 'results';
export type RoundStatus = 'playing' | 'solved' | 'fell' | 'timeout' | 'spectating';

/** One character cell on the board. `ch` is null while the letter is hidden. */
export interface Tile {
  ch: string | null;
  punct?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatarId: string;
  score: number;
  connected: boolean;
  roundStatus: RoundStatus | null;
  balloonsLeft: number | null;
  pointsThisRound: number;
}

export interface RoundResult {
  playerId: string;
  status: RoundStatus;
  points: number;
  solveMs: number | null;
}

export interface RoundSummary {
  roundIndex: number;
  answer: string;
  hint: string;
  results: RoundResult[];
}

export interface RankingEntry {
  playerId: string;
  name: string;
  avatarId: string;
  score: number;
  place: number;
}

export interface PublicRoomState {
  code: string;
  hostId: string;
  phase: Phase;
  difficulty: Difficulty;
  solo: boolean;
  minPlayers: number;
  maxPlayers: number;
  totalRounds: number;
  roundIndex: number;
  roundEndsAt: number;
  summaryEndsAt: number;
  maxBalloons: number;
  hint: string | null;
  players: PublicPlayer[];
  summary: RoundSummary | null;
  /** Finished rounds of the current game (answers included, since they're over). */
  history: RoundSummary[];
  ranking: RankingEntry[] | null;
}

/** Private, per-player view of the current round. Never contains the hidden answer. */
export interface PlayerView {
  roundIndex: number;
  hint: string;
  words: Tile[][];
  guessed: Record<string, boolean>; // letter -> correct?
  balloonsLeft: number;
  maxBalloons: number;
  status: RoundStatus;
  points: number;
}

export interface GuessOutcome {
  letter: string;
  correct: boolean;
  solved: boolean;
  fell: boolean;
  points: number;
}
