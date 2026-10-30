import { useEffect } from 'react';
import type { PlayerView, PublicRoomState } from '../../shared/types';
import { sfx } from '../audio/sfx';
import { Keyboard } from '../components/Keyboard';
import { SkyScene } from '../components/SkyScene';
import { StickFigure } from '../components/StickFigure';
import { WordBoard } from '../components/WordBoard';
import { useCountdown } from '../hooks';
import { guess, leaveRoom } from '../net/socket';
import { useStore } from '../state/store';

function Timer({ deadline }: { deadline: number }) {
  const left = useCountdown(deadline);
  const secs = Math.ceil(left / 1000);
  useEffect(() => {
    if (secs > 0 && secs <= 5) sfx.tick();
  }, [secs]);
  return (
    <span className={`timer${secs <= 10 ? ' low' : ''}`} aria-label={`${secs} seconds left`}>
      ⏱ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
    </span>
  );
}

function StatusBanner({ view }: { view: PlayerView }) {
  const lastOutcome = useStore((s) => s.lastOutcome);
  switch (view.status) {
    case 'solved':
      return (
        <div className="banner banner-good" key="solved">
          You got it! <strong>+{view.points}</strong>
        </div>
      );
    case 'fell':
      return (
        <div className="banner banner-bad" key="fell">
          Bonk! Out of balloons. Wait for the next round.
        </div>
      );
    case 'timeout':
      return <div className="banner banner-bad">Time's up!</div>;
    case 'spectating':
      return <div className="banner">You'll jump in next round. Watch the scoreboard!</div>;
    default:
      return lastOutcome && !lastOutcome.correct ? (
        <div className="pop-text" key={lastOutcome.at}>
          POP!
        </div>
      ) : null;
  }
}

function SummaryPanel({ room }: { room: PublicRoomState }) {
  const left = useCountdown(room.summaryEndsAt);
  const summary = room.summary!;
  const last = room.roundIndex + 1 >= room.totalRounds;
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const results = [...summary.results]
    .filter((r) => byId.has(r.playerId))
    .sort((a, b) => b.points - a.points);
  return (
    <div className="summary card">
      <p className="eyebrow">The answer was</p>
      <p className="summary-answer">{summary.answer}</p>
      <ul className="summary-results">
        {results.map((r) => {
          const p = byId.get(r.playerId)!;
          return (
            <li key={r.playerId}>
              <StickFigure avatarId={p.avatarId} size={26} pose={r.status === 'solved' ? 'cheer' : 'sad'} />
              <span className="sr-name">{p.name}</span>
              <span className={`sr-result ${r.status}`}>
                {r.status === 'solved'
                  ? `✅ ${(r.solveMs! / 1000).toFixed(1)}s · +${r.points}`
                  : r.status === 'fell'
                    ? '💥 fell'
                    : r.status === 'spectating'
                      ? '👀 next round'
                      : '⏰ time'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="muted">
        {last ? 'Final results' : 'Next round'} in {Math.ceil(left / 1000)}…
      </p>
    </div>
  );
}

export function Game({ room, meId }: { room: PublicRoomState; meId: string }) {
  const view = useStore((s) => s.view);
  const pending = useStore((s) => s.pending);
  const lastOutcome = useStore((s) => s.lastOutcome);
  const me = room.players.find((p) => p.id === meId);
  const inSummary = room.phase === 'roundSummary';
  const playing = room.phase === 'round' && view?.status === 'playing';

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        void guess(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  if (!view || !me) return <main className="game loading">Loading round…</main>;

  const wrongShake = lastOutcome && !lastOutcome.correct && !inSummary ? lastOutcome.at : 0;

  return (
    <main className="game">
      <header className="game-top">
        <span className="pill">
          Round {room.roundIndex + 1} / {room.totalRounds}
        </span>
        {room.phase === 'round' ? <Timer deadline={room.roundEndsAt} /> : <span className="timer">⏱ 0:00</span>}
        <span className={`pill diff-${room.difficulty}`}>{room.difficulty}</span>
        <button
          className="btn btn-ghost btn-small leave-btn"
          onClick={() => confirm(room.solo ? 'Quit this game?' : 'Leave this game?') && leaveRoom()}
        >
          {room.solo ? 'Quit' : 'Leave'}
        </button>
      </header>

      <div className="stage">
        <SkyScene
          avatarId={me.avatarId}
          status={view.status}
          balloonsLeft={view.balloonsLeft}
          maxBalloons={view.maxBalloons}
          roundKey={view.roundIndex}
        />
        <StatusBanner view={view} />
      </div>

      <p className="hint">
        <span className="hint-label">Hint</span> {view.hint}
      </p>
      <WordBoard view={view} revealed={inSummary} shakeKey={wrongShake} />

      {inSummary ? (
        <SummaryPanel room={room} />
      ) : (
        <Keyboard guessed={view.guessed} pending={pending} disabled={!playing} onKey={guess} />
      )}
    </main>
  );
}
