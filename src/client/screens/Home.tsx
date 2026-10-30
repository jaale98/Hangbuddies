import { useEffect, useState, type FormEvent } from 'react';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/constants';
import { Balloon, balloonLayout } from '../components/SkyScene';
import { StickFigure, FIGURE_VIEWBOX } from '../components/StickFigure';
import { checkCode, errorText } from '../net/socket';
import { get, set, useStore } from '../state/store';

function HeroBuddy() {
  const balloons = balloonLayout(5);
  const { h } = FIGURE_VIEWBOX;
  return (
    <svg className="hero-buddy" viewBox={`-45 -132 240 ${h + 122}`} aria-hidden="true">
      <g className="bob">
        {balloons.map((b, i) => (
          <Balloon key={i} index={i} {...b} popped={false} />
        ))}
        <StickFigure avatarId="party" pose="hold" embedded />
      </g>
    </svg>
  );
}

export async function goToJoin(code: string): Promise<string | null> {
  const res = await checkCode(code);
  if (!res.ok) return errorText(res.error);
  if (!res.exists) return errorText('NOT_FOUND');
  if (res.full) return errorText('FULL');
  set({ setup: { kind: 'join', code, ...res } });
  return null;
}

export function Home() {
  const initialCode = useStore((s) => s.initialCode);
  const connected = useStore((s) => s.connected);
  const [joining, setJoining] = useState(!!initialCode);
  const [code, setCode] = useState(initialCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(await goToJoin(code));
    setBusy(false);
  }

  // Deep link (/ABCD): check the code as soon as we're connected.
  useEffect(() => {
    if (initialCode && connected && !get().session) {
      set({ initialCode: null });
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, connected]);

  return (
    <main className="home">
      <HeroBuddy />
      <h1 className="logo">
        Hang<span>buddies</span>
      </h1>
      <p className="tagline">Guess the word before your balloons go pop!</p>

      {!joining ? (
        <div className="home-actions">
          <button className="btn btn-primary btn-big" onClick={() => set({ setup: { kind: 'host' } })}>
            Host a game
          </button>
          <button className="btn btn-secondary btn-big" onClick={() => setJoining(true)}>
            Join a game
          </button>
          <button className="btn btn-big btn-solo" onClick={() => set({ setup: { kind: 'solo' } })}>
            Play solo
          </button>
        </div>
      ) : (
        <form className="join-form card" onSubmit={submit}>
          <label className="field">
            <span>Room code</span>
            <input
              className="code-input"
              autoFocus
              value={code}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              placeholder="ABCD"
              onChange={(e) => {
                setError(null);
                const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                setCode(v);
              }}
            />
          </label>
          {code.length === CODE_LENGTH && [...code].some((c) => !CODE_ALPHABET.includes(c)) && (
            <p className="form-hint">Codes never use I, L or O.</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setJoining(false)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={code.length !== CODE_LENGTH || busy}>
              {busy ? 'Checking…' : 'Join'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
