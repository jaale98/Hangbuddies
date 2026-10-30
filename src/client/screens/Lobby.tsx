import { useState } from 'react';
import type { PublicRoomState } from '../../shared/types';
import { DifficultyPicker } from '../components/DifficultyPicker';
import { PlayerForm } from '../components/PlayerForm';
import { StickFigure } from '../components/StickFigure';
import { errorText, leaveRoom, setDifficulty, startGame, updatePlayer } from '../net/socket';
import { showNotice } from '../state/store';

export function Lobby({ room, meId }: { room: PublicRoomState; meId: string }) {
  const isHost = room.hostId === meId;
  const me = room.players.find((p) => p.id === meId);
  const [editing, setEditing] = useState(false);
  const connected = room.players.filter((p) => p.connected).length;
  const canStart = connected >= room.minPlayers;
  const link = `${location.origin}/${room.code}`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotice(`${what} copied!`);
    } catch {
      showNotice(text);
    }
  };

  return (
    <main className="lobby">
      <section className="card lobby-code">
        <p className="eyebrow">Room code</p>
        <div className="big-code" aria-label={`Room code ${[...room.code].join(' ')}`}>
          {[...room.code].map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-small" onClick={() => copy(room.code, 'Code')}>
            Copy code
          </button>
          <button className="btn btn-small" onClick={() => copy(link, 'Link')}>
            Copy link
          </button>
        </div>
      </section>

      <section className="card lobby-players">
        <h2>
          Buddies <span className="muted">{room.players.length} / {room.maxPlayers}</span>
        </h2>
        <ul className="lobby-grid">
          {room.players.map((p) => (
            <li key={p.id} className={`lobby-player${p.connected ? '' : ' offline'}${p.id === meId ? ' me' : ''}`}>
              <StickFigure avatarId={p.avatarId} size={64} pose={p.id === meId ? 'wave' : 'stand'} />
              <span className="lp-name">
                {p.id === room.hostId && '⭐ '}
                {p.name}
              </span>
              {!p.connected && <span className="lp-tag">🔌 away</span>}
            </li>
          ))}
          {Array.from({ length: Math.max(0, Math.min(3, room.maxPlayers - room.players.length)) }, (_, i) => (
            <li key={`empty-${i}`} className="lobby-player empty">
              <span className="empty-slot">?</span>
              <span className="lp-name muted">waiting…</span>
            </li>
          ))}
        </ul>
        {me && !editing && (
          <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
            ✏️ Change my name or buddy
          </button>
        )}
        {me && editing && (
          <div className="edit-me">
            <PlayerForm
              initial={{ name: me.name, avatarId: me.avatarId }}
              takenAvatars={room.players.filter((p) => p.id !== meId).map((p) => p.avatarId)}
              takenNames={room.players.filter((p) => p.id !== meId).map((p) => p.name)}
              submitLabel="Save"
              onSubmit={async (name, avatarId) => {
                const res = await updatePlayer({ name, avatarId });
                if (!res.ok) return errorText(res.error);
                setEditing(false);
                return null;
              }}
            />
          </div>
        )}
      </section>

      <section className="card lobby-settings">
        <h2>Difficulty</h2>
        <DifficultyPicker value={room.difficulty} onChange={isHost ? setDifficulty : undefined} />
        <p className="muted small">5 rounds · 90 seconds each · faster solves score more</p>
        {isHost ? (
          <>
            <button className="btn btn-primary btn-big" disabled={!canStart} onClick={() => startGame()}>
              Start game
            </button>
            {!canStart && <p className="form-hint">Share the code! You need at least {room.minPlayers} players.</p>}
          </>
        ) : (
          <p className="waiting">Waiting for the host to start<span className="dots" /></p>
        )}
        <button className="btn btn-ghost btn-small" onClick={() => leaveRoom()}>
          Leave room
        </button>
      </section>
    </main>
  );
}
