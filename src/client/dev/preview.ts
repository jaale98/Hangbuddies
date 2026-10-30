// Dev-only: render any screen with fake data, e.g. /?preview=round&status=fell&balloons=0
// Used to eyeball layouts and animations without playing a real game.
import { BALLOONS, ROUND_MS } from '../../shared/constants';
import type { Difficulty, PlayerView, PublicPlayer, PublicRoomState, RoundStatus, Tile } from '../../shared/types';
import { socket } from '../net/socket';
import { set } from '../state/store';

export function maybeStartPreview(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has('still')) {
    // Jump every animation to its end state (headless screenshots don't advance time). Works on any page.
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }';
    document.head.append(style);
  }
  const kind = q.get('preview');
  if (!kind || kind === 'gallery') return false;
  socket.disconnect();

  const difficulty = (q.get('diff') ?? 'medium') as Difficulty;
  const max = BALLOONS[difficulty];
  const status = (q.get('status') ?? 'playing') as RoundStatus;
  const balloons = Number(q.get('balloons') ?? (status === 'fell' ? 0 : max));
  const answer = (q.get('answer') ?? 'MAPLE SYRUP').toUpperCase();
  const guessed = (q.get('guessed') ?? 'AEPRZQ').toUpperCase();
  const reveal = kind === 'summary';

  const words: Tile[][] = answer.split(' ').map((w) =>
    [...w].map((ch) => (/[A-Z]/.test(ch) ? { ch: reveal || guessed.includes(ch) ? ch : null } : { ch, punct: true })),
  );
  const view: PlayerView = {
    roundIndex: 1,
    hint: q.get('hint') ?? 'Sticky breakfast topping',
    words,
    guessed: Object.fromEntries([...guessed].map((l) => [l, answer.includes(l)])),
    balloonsLeft: balloons,
    maxBalloons: max,
    status,
    points: status === 'solved' ? 742 : 0,
  };

  const names = ['Jack', 'Sam', 'Bea', 'Zorp', 'Mo', 'Priya', 'Lou', 'Kit'];
  const avatars = ['cap', 'specs', 'bow', 'alien', 'stache', 'flower', 'tophat', 'dj'];
  const solo = q.has('solo');
  const count = solo ? 1 : Number(q.get('players') ?? 6);
  const statuses: RoundStatus[] = ['playing', 'solved', 'fell', 'playing', 'solved', 'timeout', 'playing', 'playing'];
  const players: PublicPlayer[] = names.slice(0, count).map((name, i) => ({
    id: `p${i}`,
    name,
    avatarId: avatars[i],
    score: [1840, 2210, 960, 1500, 430, 1200, 0, 300][i],
    connected: i !== 6,
    roundStatus: i === 0 ? status : statuses[i],
    balloonsLeft: i === 0 ? balloons : max - (i % 3),
    pointsThisRound: statuses[i] === 'solved' ? 650 : 0,
  }));

  const pastAnswers = ['WALRUS', 'COLANDER', 'BADMINTON', 'GLACIER', 'TOFFEE'];
  const pastStatus: RoundStatus[] = ['solved', 'fell', 'solved', 'timeout', 'solved'];
  const historyFor = (n: number) =>
    pastAnswers.slice(0, n).map((a, r) => ({
      roundIndex: r,
      answer: a,
      hint: 'Preview',
      results: players.map((p, i) => {
        const st = i === 0 ? pastStatus[r] : statuses[(i + r) % statuses.length];
        return { playerId: p.id, status: st, points: st === 'solved' ? 500 + r * 60 : 0, solveMs: 30_000 };
      }),
    }));
  const phase = kind === 'lobby' ? 'lobby' : kind === 'results' ? 'results' : kind === 'summary' ? 'roundSummary' : 'round';
  const room: PublicRoomState = {
    code: 'KQFX',
    hostId: 'p0',
    phase,
    difficulty,
    solo,
    history: phase === 'results' ? historyFor(5) : phase === 'lobby' ? [] : historyFor(1),
    minPlayers: 2,
    maxPlayers: 8,
    totalRounds: 5,
    roundIndex: 1,
    roundEndsAt: Date.now() + ROUND_MS / 2,
    summaryEndsAt: Date.now() + 60_000,
    maxBalloons: max,
    hint: view.hint,
    players,
    summary:
      phase === 'roundSummary'
        ? {
            roundIndex: 1,
            answer,
            hint: view.hint,
            results: players.map((p, i) => ({
              playerId: p.id,
              status: p.roundStatus ?? 'timeout',
              points: p.pointsThisRound,
              solveMs: 20_000 + i * 3000,
            })),
          }
        : null,
    ranking:
      phase === 'results'
        ? [...players]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => ({ playerId: p.id, name: p.name, avatarId: p.avatarId, score: p.score, place: i + 1 }))
        : null,
  };

  set({ connected: true, session: { code: 'KQFX', playerId: 'p0', token: 'preview' }, room, view });

  // Optionally flip to another status after a delay to watch a transition (e.g. &then=fell&after=800).
  const then = q.get('then') as RoundStatus | null;
  if (then) {
    setTimeout(() => {
      const next = { ...view, status: then, balloonsLeft: then === 'fell' ? 0 : view.balloonsLeft };
      set({ view: next });
    }, Number(q.get('after') ?? 800));
  }
  return true;
}
