import { useState } from 'react';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { PlayerForm } from '../components/PlayerForm';
import { errorText, hostGame, joinGame, playSolo } from '../net/socket';
import { loadSoloDifficulty, saveSoloDifficulty, set, type SetupMode } from '../state/store';

export function Setup({ mode }: { mode: SetupMode }) {
  const [difficulty, setDifficulty] = useState(loadSoloDifficulty);
  const isJoin = mode.kind === 'join';
  const title =
    mode.kind === 'join' ? (
      <>
        Joining <span className="code-inline">{mode.code}</span>
      </>
    ) : mode.kind === 'solo' ? (
      'Play solo'
    ) : (
      'Host a game'
    );

  return (
    <main className="setup">
      <div className="card setup-card">
        <button className="btn btn-ghost back-btn" onClick={() => set({ setup: null })}>
          ← Back
        </button>
        <h1>{title}</h1>
        {isJoin && mode.phase !== 'lobby' && (
          <p className="form-hint">A game is in progress. You'll jump in at the next round!</p>
        )}
        {mode.kind === 'solo' && <p className="form-hint center">5 rounds against the clock. How high can you score?</p>}
        <PlayerForm
          takenAvatars={isJoin ? mode.takenAvatars : []}
          takenNames={isJoin ? mode.takenNames : []}
          submitLabel={isJoin ? "Let's go!" : mode.kind === 'solo' ? 'Start!' : 'Create room'}
          onSubmit={async (name, avatarId) => {
            let res;
            if (mode.kind === 'join') res = await joinGame(mode.code, name, avatarId);
            else if (mode.kind === 'solo') {
              saveSoloDifficulty(difficulty);
              res = await playSolo(name, avatarId, difficulty);
            } else res = await hostGame(name, avatarId);
            if (!res.ok) return errorText(res.error);
            set({ setup: null });
            return null;
          }}
        >
          {mode.kind === 'solo' && (
            <div className="field">
              <span>Difficulty</span>
              <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            </div>
          )}
        </PlayerForm>
      </div>
    </main>
  );
}
