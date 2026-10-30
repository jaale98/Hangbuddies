import { useMemo } from 'react';
import { BALLOON_COLORS } from '../art/Balloons';

export function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        dur: 2.8 + Math.random() * 2.5,
        color: BALLOON_COLORS[i % BALLOON_COLORS.length],
        rot: Math.random() * 360,
        w: 6 + Math.random() * 6,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            background: p.color,
            width: p.w,
            height: p.w * 0.45,
            rotate: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}
