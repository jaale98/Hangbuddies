import { BALLOON_COLORS } from '../art/Balloons';

/** A tiny drawn balloon, in the same style as the scene (used instead of the 🎈 emoji). */
export function MiniBalloon({ color = BALLOON_COLORS[0], size = 14 }: { color?: string; size?: number }) {
  return (
    <svg className="mini-balloon" viewBox="-12 -15 24 34" width={(size * 24) / 34} height={size} aria-hidden="true">
      <path d="M0 13 Q2.5 16 0 19" fill="none" stroke="#2b2d42" strokeWidth={1} opacity={0.55} strokeLinecap="round" />
      <path d="M1 -12.5 C8.8 -12.5 12.2 -6 11.6 0.6 C11 6.6 5.2 10.6 1 12 C-5 10.6 -10.6 6.4 -11 0 C-11.4 -6.6 -7 -12.5 1 -12.5 Z" fill={color} transform="translate(0.8 0.9)" />
      <path d="M0 -12.5 C7.8 -12.5 11.2 -6 10.6 0.6 C10 6.6 4.2 10.6 0 12 C-4.2 10.6 -10 6.6 -10.6 0 C-11 -6.6 -7.8 -12.5 0 -12.5 Z" fill="none" stroke="#2b2d42" strokeWidth={1.4} />
      <path d="M-1.8 14.6 L0 11.6 L1.8 14.6 Z" fill={color} stroke="#2b2d42" strokeWidth={1} strokeLinejoin="round" />
      <path d="M-6.4 -4.6 C-6.8 -7.8 -5 -10 -2.4 -10.6" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}

export function BalloonRow({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <span className="balloon-row" aria-label={`${count} balloons`}>
      {Array.from({ length: count }, (_, i) => (
        <MiniBalloon key={i} color={BALLOON_COLORS[i % BALLOON_COLORS.length]} size={size} />
      ))}
    </span>
  );
}
