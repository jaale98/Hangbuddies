// Global bits: mute toggle, toast, connection banner.
import { setMuted, useStore } from '../state/store';

export function MuteButton() {
  const muted = useStore((s) => s.muted);
  return (
    <button
      type="button"
      className="icon-btn mute-btn"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

export function Toast() {
  const notice = useStore((s) => s.notice);
  if (!notice) return null;
  return (
    <div className="toast" role="status" key={notice.id}>
      {notice.message}
    </div>
  );
}

export function ConnectionBanner() {
  const connected = useStore((s) => s.connected);
  const session = useStore((s) => s.session);
  if (connected || !session) return null;
  return <div className="conn-banner">Reconnecting…</div>;
}
