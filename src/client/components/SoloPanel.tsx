import type { PublicRoomState, RoundSummary } from '../../shared/types';
import { useCountUp } from '../hooks';
import { loadBest } from '../state/store';

export function RoundRecap({ room, meId }: { room: PublicRoomState; meId: string }) {
  const byRound = new Map<number, RoundSummary>(room.history.map((h) => [h.roundIndex, h]));
  return (
    <ol className="recap">
      {Array.from({ length: room.totalRounds }, (_, i) => {
        const h = byRound.get(i);
        const r = h?.results.find((x) => x.playerId === meId);
        const live = !h && i === room.roundIndex && room.phase === 'round';
        return (
          <li key={i} className={`recap-row ${r?.status ?? (live ? 'live' : 'future')}`}>
            <span className="recap-num">{i + 1}</span>
            <span className="recap-word">{h ? h.answer : live ? 'Guessing…' : '—'}</span>
            <span className="recap-points">
              {r ? (r.status === 'solved' ? `+${r.points}` : r.status === 'fell' ? '💥' : '⏰') : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Replaces the scoreboard in solo games. */
export function SoloPanel({ room, meId }: { room: PublicRoomState; meId: string }) {
  const me = room.players.find((p) => p.id === meId);
  const score = useCountUp(me?.score ?? 0);
  const best = loadBest()[room.difficulty] ?? 0;
  return (
    <aside className="scoreboard solo-panel" aria-label="Your score">
      <p className="eyebrow">Score</p>
      <p className="solo-score">{score.toLocaleString()}</p>
      <p className="muted small solo-best">
        Best on {room.difficulty}: <strong>{best ? best.toLocaleString() : '—'}</strong>
      </p>
      <RoundRecap room={room} meId={meId} />
    </aside>
  );
}
