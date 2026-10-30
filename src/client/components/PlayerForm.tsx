import { useState, type FormEvent, type ReactNode } from 'react';
import { AVATARS } from '../../shared/avatars';
import { NAME_MAX } from '../../shared/constants';
import { cleanName } from '../../shared/names';
import { loadProfile, saveProfile } from '../state/store';
import { AvatarPicker } from './AvatarPicker';

interface Props {
  takenAvatars: string[];
  takenNames: string[];
  initial?: { name: string; avatarId: string };
  submitLabel: string;
  children?: ReactNode; // extra fields shown above the submit button
  onSubmit: (name: string, avatarId: string) => Promise<string | null>; // returns error text
}

function defaultAvatar(taken: string[]) {
  const saved = loadProfile().avatarId;
  if (saved && !taken.includes(saved)) return saved;
  const free = AVATARS.filter((a) => !taken.includes(a.id));
  return (free[Math.floor(Math.random() * free.length)] ?? AVATARS[0]).id;
}

export function PlayerForm({ takenAvatars, takenNames, initial, submitLabel, children, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? loadProfile().name ?? '');
  const [avatarId, setAvatarId] = useState(initial?.avatarId ?? defaultAvatar(takenAvatars));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clean = cleanName(name);
  const nameTaken = takenNames.some((n) => n.toLowerCase() === clean.toLowerCase() && n !== initial?.name);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!clean || nameTaken || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(clean, avatarId);
    setBusy(false);
    if (err) setError(err);
    else saveProfile({ name: clean, avatarId });
  }

  return (
    <form className="player-form" onSubmit={submit}>
      <label className="field">
        <span>Your name</span>
        <input
          autoFocus={!initial}
          value={name}
          maxLength={NAME_MAX}
          placeholder="e.g. Balloonatic"
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {nameTaken && <p className="form-error">Someone here already has that name.</p>}
      <div className="field">
        <span>Pick your buddy</span>
        <AvatarPicker value={avatarId} taken={takenAvatars} onChange={setAvatarId} />
      </div>
      {children}
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary btn-big" disabled={!clean || nameTaken || busy}>
        {busy ? 'One sec…' : submitLabel}
      </button>
    </form>
  );
}
