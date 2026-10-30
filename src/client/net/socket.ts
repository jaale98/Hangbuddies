import { io, type Socket } from 'socket.io-client';
import type { Ack, CheckResult, ClientToServer, ServerToClient, Session } from '../../shared/protocol';
import { ERRORS } from '../../shared/protocol';
import type { Difficulty, GuessOutcome, PlayerView } from '../../shared/types';
import { sfx } from '../audio/sfx';
import { get, saveSession, set, showNotice } from '../state/store';

export const socket: Socket<ServerToClient, ClientToServer> = io({ transports: ['websocket', 'polling'] });

export const errorText = (code: string) => (ERRORS as Record<string, string>)[code] ?? 'Something went wrong. Try again!';

function call<T>(event: keyof ClientToServer, payload: object): Promise<Ack<T>> {
  return new Promise((resolve) => {
    (socket.timeout(8000).emit as any)(event, payload, (err: unknown, res: Ack<T>) => {
      resolve(err ? { ok: false, error: 'TIMEOUT' } : res);
    });
  });
}

async function syncClock() {
  let best = { rtt: Infinity, offset: 0 };
  for (let i = 0; i < 3; i++) {
    const sent = Date.now();
    const now = await new Promise<number>((r) => socket.emit('time:ping', {}, (res) => r(res.now)));
    const rtt = Date.now() - sent;
    if (rtt < best.rtt) best = { rtt, offset: now + rtt / 2 - Date.now() };
  }
  set({ serverOffset: best.offset });
}

function leaveLocally() {
  saveSession(null);
  set({ room: null, view: null, pending: {}, lastOutcome: null, setup: null });
}

socket.on('connect', async () => {
  set({ connected: true });
  void syncClock();
  const { session } = get();
  if (session) {
    const res = await call<{ session: Session }>('room:resume', { code: session.code, token: session.token });
    if (!res.ok) {
      leaveLocally();
      showNotice(errorText(res.error));
    }
  }
});

socket.on('disconnect', () => set({ connected: false }));

socket.on('room:state', (room) => {
  const prev = get().room;
  if (prev && prev.phase !== room.phase) {
    if (room.phase === 'round' && room.roundIndex === 0) sfx.start();
  }
  set({ room });
});

socket.on('round:you', (view) => {
  const prev = get().view;
  if (!view || !prev || prev.roundIndex !== view.roundIndex) set({ pending: {}, lastOutcome: null });
  set({ view });
});

socket.on('server:notice', ({ message, kind }) => {
  if (kind === 'kicked') leaveLocally();
  showNotice(message);
});

// ---------- actions ----------

export async function hostGame(name: string, avatarId: string) {
  const res = await call<{ session: Session }>('room:create', { name, avatarId });
  if (res.ok) saveSession(res.session);
  return res;
}

export async function playSolo(name: string, avatarId: string, difficulty: Difficulty) {
  const res = await call<{ session: Session }>('room:createSolo', { name, avatarId, difficulty });
  if (res.ok) saveSession(res.session);
  return res;
}

export const checkCode = (code: string) => call<CheckResult>('room:check', { code });

export async function joinGame(code: string, name: string, avatarId: string) {
  const res = await call<{ session: Session }>('room:join', { code, name, avatarId });
  if (res.ok) saveSession(res.session);
  return res;
}

export async function leaveRoom() {
  await call('room:leave', {});
  leaveLocally();
}

const simple = async (event: keyof ClientToServer, payload: object = {}) => {
  const res = await call(event, payload);
  if (!res.ok) showNotice(errorText(res.error));
  return res;
};
export const updatePlayer = (changes: { name?: string; avatarId?: string }) => call('player:update', changes);
export const setDifficulty = (difficulty: Difficulty) => simple('game:setDifficulty', { difficulty });
export const startGame = () => simple('game:start');
/** Back to the lobby (multiplayer). To go straight into another game, use startGame. */
export const backToLobby = () => simple('game:playAgain');

export async function guess(raw: string) {
  const letter = raw.toUpperCase();
  const { view, pending } = get();
  if (!view || view.status !== 'playing' || letter in view.guessed || pending[letter]) return;
  set({ pending: { ...pending, [letter]: true } });
  sfx.click();
  const round = view.roundIndex;
  const res = await call<{ outcome: GuessOutcome; view: PlayerView }>('game:guess', { letter, round });
  const { [letter]: _, ...rest } = get().pending;
  set({ pending: rest });
  if (!res.ok || get().view?.roundIndex !== round) return;
  const { outcome } = res;
  set({ view: res.view, lastOutcome: { ...outcome, at: Date.now() } });
  if (outcome.solved) sfx.solve();
  else if (outcome.fell) sfx.fall();
  else if (outcome.correct) sfx.correct();
  else sfx.pop();
}
