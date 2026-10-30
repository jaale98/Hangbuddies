import { memo, useMemo, useRef, type CSSProperties } from 'react';
import { n, seeded, type P } from './ink';

export const BALLOON_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#5fc8ee', '#f78c6b', '#9b5de5', '#ff70a6', '#3a86ff'];
const INK = '#2b2d42';

interface Spot {
  dx: number; // relative to the hand that holds the strings
  dy: number;
  color: string;
  scale: number;
}

// Hand-composed bunches (back row first, so front balloons overlap the ones behind).
// Spacing keeps neighbours overlapping just a little, like a real bunch, never stacked on top of each other.
const A = 0.95; // back row is a touch smaller: reads as depth
const B = 1;
const C = 1.04;
const LAYOUTS: Record<number, { spots: Spot[]; popOrder: number[] }> = {
  6: {
    spots: [
      { dx: -20, dy: -124, color: '#ef476f', scale: A },
      { dx: 20, dy: -124, color: '#ffd166', scale: A },
      { dx: -40, dy: -94, color: '#9b5de5', scale: B },
      { dx: 0, dy: -100, color: '#06d6a0', scale: B },
      { dx: 40, dy: -94, color: '#f78c6b', scale: B },
      { dx: 0, dy: -68, color: '#5fc8ee', scale: C },
    ],
    popOrder: [5, 4, 2, 0, 1, 3],
  },
  7: {
    spots: [
      { dx: -38, dy: -120, color: '#5fc8ee', scale: A },
      { dx: 0, dy: -130, color: '#ef476f', scale: A },
      { dx: 38, dy: -120, color: '#ffd166', scale: A },
      { dx: -56, dy: -90, color: '#9b5de5', scale: B },
      { dx: -19, dy: -94, color: '#06d6a0', scale: B },
      { dx: 19, dy: -94, color: '#f78c6b', scale: B },
      { dx: 56, dy: -90, color: '#ff70a6', scale: B },
    ],
    popOrder: [6, 3, 0, 2, 5, 4, 1],
  },
  8: {
    spots: [
      { dx: -38, dy: -120, color: '#5fc8ee', scale: A },
      { dx: 0, dy: -130, color: '#ef476f', scale: A },
      { dx: 38, dy: -120, color: '#ffd166', scale: A },
      { dx: -56, dy: -90, color: '#9b5de5', scale: B },
      { dx: -19, dy: -94, color: '#06d6a0', scale: B },
      { dx: 19, dy: -94, color: '#f78c6b', scale: B },
      { dx: 56, dy: -90, color: '#ff70a6', scale: B },
      { dx: 0, dy: -64, color: '#3a86ff', scale: C },
    ],
    popOrder: [7, 6, 3, 0, 2, 5, 4, 1],
  },
};

function layoutFor(count: number) {
  if (LAYOUTS[count]) return LAYOUTS[count];
  // Fallback for unusual counts: a simple fan.
  const spots = Array.from({ length: count }, (_, i) => {
    const a = count === 1 ? 0 : -0.7 + (1.4 * i) / (count - 1);
    return { dx: Math.sin(a) * 110, dy: -Math.cos(a) * 120, color: BALLOON_COLORS[i % 8], scale: 1 };
  });
  return { spots, popOrder: spots.map((_, i) => i) };
}

/** Highest point of the bunch, relative to the hand (negative = above). */
export function bunchTop(count: number): number {
  return Math.min(...layoutFor(count).spots.map((s) => s.dy - 27 * s.scale));
}

/** Indices of popped balloons, given how many are left. */
export function poppedSet(count: number, left: number): Set<number> {
  return new Set(layoutFor(count).popOrder.slice(0, Math.max(0, count - left)));
}

// The balloon body: rounder on top, tapering to the knot. Each balloon gets slightly different curves.
function bodyPath(rand: () => number): string {
  const j = (v: number, amt = 0.9) => n(v + (rand() - 0.5) * 2 * amt);
  return (
    `M${j(0)} -27 C${j(14.5)} ${j(-27)} 23 ${j(-16)} ${j(23)} -3.5 ` +
    `C${j(23)} ${j(10.5)} ${j(12.5)} ${j(21.5)} 2.4 25.6 L-2.4 25.6 ` +
    `C${j(-12.5)} ${j(21.5)} ${j(-23)} ${j(10.5)} ${j(-23)} -3.5 C-23 ${j(-16)} ${j(-14.5)} ${j(-27)} ${j(0)} -27 Z`
  );
}

function rotate([x, y]: P, deg: number): P {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

interface Props {
  count: number;
  left: number;
  hand: P;
  seed?: number;
}

const SHREDS = [
  { d: 'M0 0 q3 -2.4 5.6 .6 q-2.6 2.2 -5.6 -.6z', dx: -22, dy: -14, rot: -160 },
  { d: 'M0 0 q2.6 -1.6 4.8 1.4 q-2.8 1.2 -4.8 -1.4z', dx: 20, dy: -18, rot: 140 },
  { d: 'M0 0 q3.4 -1 5 2 q-3 .8 -5 -2z', dx: -16, dy: 18, rot: 200 },
  { d: 'M0 0 q2 -2 4.4 0 q-2.2 1.8 -4.4 0z', dx: 24, dy: 12, rot: -220 },
  { d: 'M0 0 q2.4 -2.2 4 .4 q-2 1.6 -4 -.4z', dx: 2, dy: -26, rot: 90 },
];

/** A burst star with "POP!" and flying scraps of rubber. */
function PopEffect({ at, color }: { at: P; color: string }) {
  const star = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = i % 2 ? 11 : 20 + ((i * 7) % 5);
      pts.push(`${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`);
    }
    return `M${pts.join(' L')}Z`;
  }, []);
  return (
    <g transform={`translate(${n(at[0])} ${n(at[1])})`} className="pop-fx">
      {SHREDS.map((s, i) => (
        <path
          key={i}
          className="shred"
          d={s.d}
          fill={color}
          stroke={INK}
          strokeWidth={0.7}
          style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--rot': `${s.rot}deg` } as CSSProperties}
        />
      ))}
      <path className="pop-star" d={star} fill="#fff" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <text className="pop-word" y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>
        POP!
      </text>
    </g>
  );
}

/** The ribbon tying the strings together, just above the hand. */
function Ribbon({ at }: { at: P }) {
  return (
    <g transform={`translate(${at[0]} ${at[1] - 6})`} stroke={INK} strokeWidth={0.8} strokeLinejoin="round">
      <path d="M-.6 1 Q-2.2 5 -3.8 7.4 M.6 1 Q2.4 5 3.4 7.8" fill="none" stroke="#d23a62" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M0 0 C-5 -4.4 -7.4 1 -4.2 2.6 C-2.6 3.4 -1 1.6 0 0 Z" fill="#ef476f" />
      <path d="M0 0 C5 -4.4 7.4 1 4.2 2.6 C2.6 3.4 1 1.6 0 0 Z" fill="#ef476f" />
      <circle r={1.5} fill="#d23a62" />
    </g>
  );
}

export const BalloonBunch = memo(function BalloonBunch({ count, left, hand, seed = 7 }: Props) {
  const { spots } = layoutFor(count);
  const popped = poppedSet(count, left);
  // Balloons already popped when we mounted (e.g. after a refresh) just stay gone: no replayed pop.
  const goneAtMount = useRef(popped);

  const shapes = useMemo(() => {
    const r = seeded(seed);
    return spots.map((s) => {
      const rot = s.dx * 0.2 + (r() - 0.5) * 6;
      const knot = rotate([0, 31 * s.scale], rot);
      const knotAt: P = [hand[0] + s.dx + knot[0], hand[1] + s.dy + knot[1]];
      const len = Math.hypot(knotAt[0] - hand[0], knotAt[1] - hand[1]);
      const wob = (r() - 0.5) * 14;
      const string =
        `M${n(knotAt[0])} ${n(knotAt[1])} C${n(knotAt[0] + wob)} ${n(knotAt[1] + len * 0.35)} ` +
        `${n(hand[0] + (knotAt[0] - hand[0]) * 0.18 - wob * 0.4)} ${n(hand[1] - len * 0.3)} ${n(hand[0])} ${n(hand[1] - 3)}`;
      return { rot, body: bodyPath(r), string, sway: 3.4 + r() * 1.6, delay: -r() * 4 };
    });
  }, [spots, hand, seed]);

  const state = (i: number) => (!popped.has(i) ? 'up' : goneAtMount.current.has(i) ? 'gone' : 'popping');

  return (
    <g className="bunch">
      {/* Strings first, all behind every balloon. */}
      <g fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" opacity={0.6}>
        {shapes.map((s, i) => (
          <path key={i} d={s.string} className={`string ${state(i)}`} />
        ))}
      </g>
      {left > 0 && <Ribbon at={hand} />}
      {spots.map((spot, i) => {
        const shape = shapes[i];
        const st = state(i);
        if (st === 'gone') return null;
        return (
          <g key={i} transform={`translate(${hand[0] + spot.dx} ${hand[1] + spot.dy}) rotate(${n(shape.rot)}) scale(${spot.scale})`}>
            <g className="sway" style={{ animationDuration: `${shape.sway}s`, animationDelay: `${n(shape.delay)}s` }}>
              <g className={`balloon-art ${st}`} style={{ animationDelay: st === 'up' ? `${i * 70}ms` : undefined }}>
                <g transform="translate(1.3 1.6)">
                  <path d={shape.body} fill={spot.color} />
                  <path d="M12.5 -20 C21 -11 21.5 5 9 20 C15.5 6 16 -7.5 12.5 -20 Z" fill="#000" opacity={0.11} />
                </g>
                <path d={shape.body} fill="none" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
                <path d="M-13.5 -10 C-14.6 -16.5 -10.6 -21.6 -5 -22.8" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" opacity={0.85} />
                <circle cx={-14.6} cy={-4.6} r={1.6} fill="#fff" opacity={0.85} />
                <path d="M-3.4 30.2 L0 25 L3.4 30.2 Q0 31.8 -3.4 30.2 Z" fill={spot.color} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
              </g>
            </g>
          </g>
        );
      })}
      {spots.map((spot, i) =>
        state(i) === 'popping' ? <PopEffect key={`pop-${i}`} at={[hand[0] + spot.dx, hand[1] + spot.dy]} color={spot.color} /> : null,
      )}
    </g>
  );
});
