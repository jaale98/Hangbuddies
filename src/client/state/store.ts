import { create } from 'zustand';
import type { CheckResult, Session } from '../../shared/protocol';
import type { Difficulty, GuessOutcome, PlayerView, PublicRoomState } from '../../shared/types';

export type SetupMode = { kind: 'host' } | { kind: 'solo' } | ({ kind: 'join'; code: string } & CheckResult);

export interface Notice {
  id: number;
  message: string;
}

interface State {
  connected: boolean;
  session: Session | null;
  room: PublicRoomState | null;
  view: PlayerView | null;
  pending: Record<string, true>;
  lastOutcome: (GuessOutcome & { at: number }) | null;
  notice: Notice | null;
  serverOffset: number;
  muted: boolean;
  setup: SetupMode | null;
  initialCode: string | null;
}

const read = (fn: () => string | null) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

const savedSession = read(() => sessionStorage.getItem('hb:session'));
const pathCode = location.pathname.slice(1).toUpperCase();

export const useStore = create<State>(() => ({
  connected: false,
  session: savedSession ? (JSON.parse(savedSession) as Session) : null,
  room: null,
  view: null,
  pending: {},
  lastOutcome: null,
  notice: null,
  serverOffset: 0,
  muted: read(() => localStorage.getItem('hb:muted')) === '1',
  setup: null,
  initialCode: /^[A-Z]{4}$/.test(pathCode) ? pathCode : null,
}));

export const set = useStore.setState;
export const get = useStore.getState;

export function saveSession(session: Session | null) {
  set({ session });
  read(() => {
    if (session) sessionStorage.setItem('hb:session', JSON.stringify(session));
    else sessionStorage.removeItem('hb:session');
    return null;
  });
  history.replaceState(null, '', session ? `/${session.code}` : '/');
}

let noticeId = 0;
export function showNotice(message: string) {
  const id = ++noticeId;
  set({ notice: { id, message } });
  setTimeout(() => {
    if (get().notice?.id === id) set({ notice: null });
  }, 4000);
}

export function setMuted(muted: boolean) {
  set({ muted });
  read(() => {
    localStorage.setItem('hb:muted', muted ? '1' : '0');
    return null;
  });
}

export interface Profile {
  name: string;
  avatarId: string;
}
export const loadProfile = (): Partial<Profile> => JSON.parse(read(() => localStorage.getItem('hb:profile')) ?? '{}');
export const saveProfile = (p: Profile) =>
  read(() => {
    localStorage.setItem('hb:profile', JSON.stringify(p));
    return null;
  });

/** Personal best solo scores, per difficulty (this browser only). */
export const loadBest = (): Partial<Record<Difficulty, number>> =>
  JSON.parse(read(() => localStorage.getItem('hb:best')) ?? '{}');
export const saveBest = (difficulty: Difficulty, score: number) =>
  read(() => {
    const best = loadBest();
    if (score > (best[difficulty] ?? 0)) localStorage.setItem('hb:best', JSON.stringify({ ...best, [difficulty]: score }));
    return null;
  });
export const loadSoloDifficulty = (): Difficulty =>
  (read(() => localStorage.getItem('hb:soloDifficulty')) as Difficulty | null) ?? 'medium';
export const saveSoloDifficulty = (d: Difficulty) =>
  read(() => {
    localStorage.setItem('hb:soloDifficulty', d);
    return null;
  });

export const me = () => {
  const { session, room } = get();
  return room?.players.find((p) => p.id === session?.playerId) ?? null;
};
