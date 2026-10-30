import { useEffect, useState } from 'react';
import type { PublicRoomState, RankingEntry } from '../../shared/types';
import { sfx } from '../audio/sfx';
import { Confetti } from '../components/Confetti';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { RoundRecap } from '../components/SoloPanel';
import { AvatarHead, StickFigure } from '../components/StickFigure';
import { useCountUp } from '../hooks';
import { backToLobby, leaveRoom, setDifficulty, startGame } from '../net/socket';
import { loadBest, saveBest, saveSoloDifficulty } from '../state/store';

function Step({ entry, height }: { entry: RankingEntry | undefined; height: number }) {
  if (!entry) return <div className="podium-step empty" />;
  const first = entry.place === 1;
  return (
    <div className={`podium-step place-${Math.min(entry.place, 3)}`}>
      <StickFigure avatarId={entry.avatarId} size={first ? 92 : 72} pose={first ? 'cheer' : 'wave'} crowned={first} />
      <span className="podium-name">{entry.name}</span>
      <span className="podium-score">{entry.score.toLocaleString()}</span>
      <div className="podium-block" style={{ height }}>
        {entry.place}
      </div>
    </div>
  );
}

/** Difficulty for the next game + Play again. Shown to everyone; only the host can change it. */
function NextGame({ room, isHost }: { room: PublicRoomState; isHost: boolean }) {
  return (
    <section className="card next-game">
      <h2>Next game</h2>
      <DifficultyPicker
        value={room.difficulty}
        onChange={
          isHost
            ? (d) => {
                if (room.solo) saveSoloDifficulty(d);
                void setDifficulty(d);
              }
            : undefined
        }
      />
      {isHost ? (
        <>
          <button className="btn btn-primary btn-big" onClick={() => startGame()}>
            Play again
          </button>
          <div className="row">
            {!room.solo && (
              <button className="btn btn-ghost btn-small" onClick={() => backToLobby()}>
                Back to lobby
              </button>
            )}
            <button className="btn btn-ghost btn-small" onClick={() => leaveRoom()}>
              {room.solo ? 'Quit' : 'Leave'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="waiting">
            Waiting for the host<span className="dots" />
          </p>
          <button className="btn btn-ghost btn-small" onClick={() => leaveRoom()}>
            Leave
          </button>
        </>
      )}
    </section>
  );
}

function SoloResults({ room, meId }: { room: PublicRoomState; meId: string }) {
  const finalScore = room.ranking?.find((r) => r.playerId === meId)?.score ?? 0;
  // Read the old best once, before this game's score is saved.
  const [prevBest] = useState(() => loadBest()[room.difficulty] ?? 0);
  const [gameDifficulty] = useState(room.difficulty);
  const newBest = finalScore > prevBest;
  const shown = useCountUp(finalScore, 1400);
  const solved = room.history.filter((h) => h.results.some((r) => r.playerId === meId && r.status === 'solved')).length;

  useEffect(() => {
    saveBest(gameDifficulty, finalScore);
  }, [gameDifficulty, finalScore]);

  return (
    <main className="results solo-results">
      {finalScore > 0 && <Confetti count={newBest ? 120 : 50} />}
      <h1 className="results-title">{solved === room.totalRounds ? 'Perfect game!' : 'Game over!'}</h1>
      <div className="card solo-final">
        <p className="eyebrow">
          Final score · {gameDifficulty} · {solved}/{room.totalRounds} solved
        </p>
        <p className="solo-score big">{shown.toLocaleString()}</p>
        {newBest ? (
          <p className="new-best">🎉 New personal best!</p>
        ) : (
          <p className="muted">Best on {gameDifficulty}: {prevBest.toLocaleString()}</p>
        )}
        <RoundRecap room={room} meId={meId} />
      </div>
      <NextGame room={room} isHost />
    </main>
  );
}

export function Results({ room, meId }: { room: PublicRoomState; meId: string }) {
  useEffect(() => {
    sfx.fanfare();
  }, []);

  if (room.solo) return <SoloResults room={room} meId={meId} />;

  const ranking = room.ranking ?? [];
  const isHost = room.hostId === meId;
  const winners = ranking.filter((r) => r.place === 1);
  const iWon = winners.some((w) => w.playerId === meId);

  return (
    <main className="results">
      <Confetti />
      <h1 className="results-title">
        {winners.length > 1 ? "It's a tie!" : `${winners[0]?.name ?? 'Nobody'} wins!`}
        {iWon && <span className="you-won"> 🎉 That's you!</span>}
      </h1>
      <div className="podium">
        <Step entry={ranking[1]} height={90} />
        <Step entry={ranking[0]} height={130} />
        <Step entry={ranking[2]} height={64} />
      </div>
      {ranking.length > 3 && (
        <ol className="rest card" start={4}>
          {ranking.slice(3).map((r) => (
            <li key={r.playerId}>
              <span className="rest-place">{r.place}.</span>
              <AvatarHead avatarId={r.avatarId} size={30} />
              <span className="rest-name">{r.name}</span>
              <span className="rest-score">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      <NextGame room={room} isHost={isHost} />
    </main>
  );
}
