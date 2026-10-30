import type { Difficulty, GuessOutcome, PlayerView, PublicRoomState } from './types';

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
type Cb<T = {}> = (res: Ack<T>) => void;

export interface Session {
  code: string;
  playerId: string;
  token: string;
}

export interface CheckResult {
  exists: boolean;
  full: boolean;
  phase: string | null;
  takenAvatars: string[];
  takenNames: string[];
}

export interface ClientToServer {
  'room:create': (p: { name: string; avatarId: string }, cb: Cb<{ session: Session }>) => void;
  'room:createSolo': (
    p: { name: string; avatarId: string; difficulty: Difficulty },
    cb: Cb<{ session: Session }>,
  ) => void;
  'room:check': (p: { code: string }, cb: Cb<CheckResult>) => void;
  'room:join': (p: { code: string; name: string; avatarId: string }, cb: Cb<{ session: Session }>) => void;
  'room:resume': (p: { code: string; token: string }, cb: Cb<{ session: Session }>) => void;
  'room:leave': (p: {}, cb: Cb) => void;
  'player:update': (p: { name?: string; avatarId?: string }, cb: Cb) => void;
  'game:setDifficulty': (p: { difficulty: Difficulty }, cb: Cb) => void;
  'game:start': (p: {}, cb: Cb) => void;
  'game:guess': (p: { letter: string; round: number }, cb: Cb<{ outcome: GuessOutcome; view: PlayerView }>) => void;
  'game:playAgain': (p: {}, cb: Cb) => void;
  'time:ping': (p: {}, cb: (res: { now: number }) => void) => void;
}

export interface ServerToClient {
  'room:state': (s: PublicRoomState) => void;
  'round:you': (v: PlayerView | null) => void;
  'server:notice': (n: { message: string; kind?: 'info' | 'kicked' }) => void;
}

export const ERRORS = {
  NOT_FOUND: "Hmm, we couldn't find that room.",
  FULL: 'That room is full (8 players max).',
  NAME_TAKEN: 'Someone in the room already has that name.',
  AVATAR_TAKEN: 'That buddy is already taken. Pick another!',
  NOT_HOST: 'Only the host can do that.',
  NOT_ENOUGH_PLAYERS: 'Need at least 2 players to start.',
  BAD_PHASE: "You can't do that right now.",
  BAD_INPUT: 'That input looks off.',
  NOT_IN_ROOM: "You're not in a room.",
  RATE_LIMITED: 'Whoa, slow down a little!',
  SESSION_EXPIRED: 'Your spot in that room expired.',
} as const;
export type ErrorCode = keyof typeof ERRORS;
