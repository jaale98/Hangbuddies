// Dev-only: every buddy in every pose, to eyeball art and collisions. Open /?preview=gallery
import { AVATARS } from '../../shared/avatars';
import { AvatarHead, StickFigure, type Mood, type Pose } from '../components/StickFigure';

const POSES: Pose[] = ['stand', 'wave', 'hold', 'celebrate', 'fall', 'dizzy', 'sad'];
const MOODS: Mood[] = ['happy', 'worried', 'joy', 'panic', 'dizzy', 'sad'];

export function Gallery() {
  const only = new URLSearchParams(location.search).get('only')?.split(',');
  return (
    <main style={{ padding: 16, display: 'grid', gap: 12 }}>
      {AVATARS.filter((a) => !only || only.includes(a.id)).map((a) => (
        <section key={a.id} className="card" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', padding: 10 }}>
          <strong style={{ width: 90 }}>{a.label}</strong>
          {POSES.map((p) => (
            <StickFigure key={p} avatarId={a.id} pose={p} size={70} />
          ))}
          <StickFigure avatarId={a.id} pose="cheer" crowned size={70} />
          {MOODS.map((m) => (
            <AvatarHead key={m} avatarId={a.id} mood={m} size={44} />
          ))}
        </section>
      ))}
    </main>
  );
}
