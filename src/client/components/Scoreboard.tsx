import type { PublicPlayer, PublicRoomState } from '../../shared/types';
import { useCountUp, useFlip } from '../hooks';
import { MiniBalloon } from './MiniBalloon';
import { AvatarHead, type Mood } from './StickFigure';

function status(p: PublicPlayer, phase: PublicRoomState['phase']) {
  if (!p.connected) return { icon: '🔌', label: 'Disconnected' };
  if (phase !== 'round' && phase !== 'roundSummary') return null;
  switch (p.roundStatus) {
    case 'playing':
      return {
        icon: (
          <>
            <MiniBalloon size={13} /> {p.balloonsLeft}
          </>
        ),
        label: `${p.balloonsLeft} balloons left`,
      };
    case 'solved':
      return { icon: `✅ +${p.pointsThisRound}`, label: 'Solved!' };
    case 'fell':
      return { icon: '💥', label: 'Fell' };
    case 'timeout':
      return { icon: '⏰', label: 'Out of time' };
    case 'spectating':
      return { icon: '👀', label: 'Joins next round' };
    default:
      return null;
  }
}

function moodFor(p: PublicPlayer): Mood {
  switch (p.roundStatus) {
    case 'solved':
      return 'joy';
    case 'fell':
      return 'dizzy';
    case 'timeout':
      return 'sad';
    case 'playing':
      return (p.balloonsLeft ?? 9) <= 2 ? 'worried' : 'happy';
    default:
      return 'happy';
  }
}

function Score({ value }: { value: number }) {
  return <span className="sb-score">{useCountUp(value).toLocaleString()}</span>;
}

export function Scoreboard({ room, meId }: { room: PublicRoomState; meId: string | undefined }) {
  const players = [...room.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const flip = useFlip(players.map((p) => p.id).join());
  return (
    <aside className="scoreboard" aria-label="Scoreboard">
      <h2 className="sb-title">Scoreboard</h2>
      <ol className="sb-list">
        {players.map((p, i) => {
          const st = status(p, room.phase);
          return (
            <li
              key={p.id}
              ref={flip(p.id)}
              className={`sb-row${p.id === meId ? ' me' : ''}${p.connected ? '' : ' offline'} st-${p.roundStatus ?? 'none'}`}
            >
              <span className="sb-rank">{i + 1}</span>
              <AvatarHead avatarId={p.avatarId} size={36} mood={moodFor(p)} />
              <span className="sb-name">
                {p.name}
                {p.id === room.hostId && <span title="Host"> ⭐</span>}
                {p.id === meId && <span className="you"> (you)</span>}
              </span>
              {st && (
                <span className="sb-status" title={st.label}>
                  {st.icon}
                </span>
              )}
              <Score value={p.score} />
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
