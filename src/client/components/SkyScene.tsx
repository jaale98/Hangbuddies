import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { RoundStatus } from '../../shared/types';
import { BalloonBunch, bunchTop } from '../art/Balloons';
import { blob, brush, inkCircle, inkCurve, n, seeded, type P } from '../art/ink';
import { HAND, StickFigure, type Mood, type Pose } from './StickFigure';

const W = 360;
const H = 380;
const GROUND = 348; // y of the ground line
const SCALE = 0.8; // figure units → scene units
const FEET = 132 * SCALE; // feet (and a sitting bottom) sit at y=132 in figure units
const TOP_MARGIN = 14;
const BOB = 7; // idle bob amplitude, in scene units
const HANG_MS = 200; // cartoon beat: hanging in mid-air for a moment before gravity notices
const FALL_MS = 520;
const LOW_HOVER = 58; // with one balloon left the buddy still hangs this high, so the final drop reads as a fall
const LANDING = [100, 265]; // keep the ground here flat and free of decorations
// Centre the buddy + bunch as one composition (body at x=50, bunch centred on the hand).
const TX = W / 2 - ((50 + HAND[0]) / 2) * SCALE;

const GRASS_INK = '#4f8f5a';
const motionOK = typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------- backdrop ----------------

function Sun() {
  const art = useMemo(() => {
    const r = seeded(11);
    const rays = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + (r() - 0.5) * 0.14;
      const r0 = 25;
      const r1 = 31 + (i % 2) * 4;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return inkCurve([c * r0, s * r0], [c * (r0 + r1) * 0.5, s * (r0 + r1) * 0.5], [c * r1, s * r1], 2.6, r);
    });
    return { rays, fill: blob(1.3, 1.5, 19, r), outline: inkCircle(0, 0, 19.4, 2.6, r) };
  }, []);
  return (
    <g transform="translate(404 56)">
      <g>
        {motionOK && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="120s" repeatCount="indefinite" />}
        {art.rays.map((d, i) => (
          <path key={i} d={d} fill="#f0a500" />
        ))}
      </g>
      <path d={art.fill} fill="#ffd166" />
      <path d={art.outline} fill="#e09a00" />
    </g>
  );
}

const CLOUD = 'M-30 8 Q-36 -4 -23 -6 Q-21 -18 -7 -16 Q0 -27 13 -18 Q27 -21 28 -7 Q38 -5 34 8 Q2 11 -30 8 Z';
const CLOUD_SHADE = 'M-28 5.6 Q2 9 32 5.6 Q31.4 8.8 27 9.4 Q2 11.6 -25 9.6 Q-28.6 8.6 -28 5.6 Z';

function Cloud({ x, y, s, dur, delay }: { x: number; y: number; s: number; dur: number; delay: number }) {
  return (
    <g className="cloud" style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d={CLOUD} fill="#fff" transform="translate(1.6 1.8)" />
        <path d={CLOUD_SHADE} fill="#dcebf6" />
        <path d={CLOUD} fill="none" stroke="#9fc4de" strokeWidth={1.6 / s} strokeLinejoin="round" />
      </g>
    </g>
  );
}

function Bird({ x, y, s, dur }: { x: number; y: number; s: number; dur: number }) {
  const up = 'M-6 0 Q-3 -3.4 0 0 Q3 -3.4 6 0';
  const down = 'M-6 -1.6 Q-3 1.6 0 0 Q3 1.6 6 -1.6';
  return (
    <path d={up} transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke="#2b2d42" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      {motionOK && <animate attributeName="d" values={`${up};${down};${up}`} dur={`${dur}s`} repeatCount="indefinite" />}
    </path>
  );
}

function Tree({ x }: { x: number }) {
  const art = useMemo(() => {
    const r = seeded(23);
    return {
      trunk: inkCurve([x, GROUND + 2], [x - 3, GROUND - 26], [x + 2, GROUND - 52], 7.5, r),
      branch: inkCurve([x - 1, GROUND - 30], [x + 6, GROUND - 36], [x + 12, GROUND - 46], 3.2, r),
    };
  }, [x]);
  const crown: [number, number, number][] = [
    [x - 15, GROUND - 62, 19],
    [x + 7, GROUND - 74, 22],
    [x + 19, GROUND - 55, 17],
    [x - 3, GROUND - 50, 17],
  ];
  return (
    <g>
      <path d={art.trunk} fill="#8a5a3b" />
      <path d={art.branch} fill="#8a5a3b" />
      {/* Outlines first, fills on top: the inner lines disappear and leave one clean silhouette. */}
      {crown.map(([cx, cy, cr], i) => (
        <circle key={`o${i}`} cx={cx} cy={cy} r={cr} fill="none" stroke="#3f7f4a" strokeWidth={3.2} />
      ))}
      {crown.map(([cx, cy, cr], i) => (
        <circle key={`f${i}`} cx={cx} cy={cy} r={cr} fill="#7fcf86" />
      ))}
      <ellipse cx={x - 9} cy={GROUND - 72} rx={8} ry={5} fill="#a3e0a7" transform={`rotate(-20 ${x - 9} ${GROUND - 72})`} />
      <path
        d={`M${x - 20} ${GROUND - 56} l3 3 M${x + 2} ${GROUND - 64} l3 3 M${x + 14} ${GROUND - 50} l3 3 M${x + 10} ${GROUND - 82} l3 3`}
        stroke="#4f9a59"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle cx={x - 6} cy={GROUND - 58} r={2.6} fill="#ef476f" stroke="#2b2d42" strokeWidth={0.8} />
      <circle cx={x + 17} cy={GROUND - 66} r={2.4} fill="#ef476f" stroke="#2b2d42" strokeWidth={0.8} />
    </g>
  );
}

function Fence({ x0 }: { x0: number }) {
  const posts = [0, 1, 2, 3].map((i) => ({ x: x0 + i * 21, h: 25 + ((i * 7) % 4), lean: ((i * 5) % 3) - 1 }));
  return (
    <g stroke="#6b5b4b" strokeWidth={1.3} strokeLinejoin="round">
      <rect x={x0 - 6} y={GROUND - 19} width={75} height={4.4} rx={1.5} fill="#fff4e0" transform={`rotate(-1.2 ${x0} ${GROUND})`} />
      <rect x={x0 - 6} y={GROUND - 9} width={75} height={4.4} rx={1.5} fill="#fff4e0" transform={`rotate(0.8 ${x0} ${GROUND})`} />
      {posts.map((p) => (
        <path
          key={p.x}
          d={`M${p.x - 4} ${GROUND + 1} L${p.x - 4 + p.lean} ${GROUND - p.h + 5} L${p.x + p.lean} ${GROUND - p.h} L${p.x + 4 + p.lean} ${GROUND - p.h + 5} L${p.x + 4} ${GROUND + 1} Z`}
          fill="#fffaf0"
        />
      ))}
    </g>
  );
}

const bladeWidth = (w: number) => (t: number) => w * (1 - t * 0.75);

function Tuft({ x, s, seed }: { x: number; s: number; seed: number }) {
  const blades = useMemo(() => {
    const r = seeded(seed);
    const b: [P, P, P][] = [
      [[x - 2, GROUND + 1], [x - 4, GROUND - 4], [x - 6 - r() * 2, GROUND - 9 * s]],
      [[x, GROUND + 1], [x + 0.5, GROUND - 6], [x + r() * 2 - 1, GROUND - 13 * s]],
      [[x + 2, GROUND + 1], [x + 4, GROUND - 4], [x + 6 + r() * 2, GROUND - 8 * s]],
    ];
    return b.map((curve) => inkCurve(...curve, 2.2, r, bladeWidth));
  }, [x, s, seed]);
  return (
    <g fill="#5aa863">
      {blades.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

function Flower({ x, color }: { x: number; color: string }) {
  const top = GROUND - 13;
  return (
    <g>
      <path d={`M${x} ${GROUND + 1} Q${x - 2} ${GROUND - 6} ${x} ${top}`} stroke="#4f9a59" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d={`M${x - 1} ${GROUND - 5} q-4 -3 -6 0 q3 2 6 0z`} fill="#5aa863" />
      <g stroke="#2b2d42" strokeWidth={0.7}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={x} cy={top - 3.2} rx={1.9} ry={3.2} fill={color} transform={`rotate(${a} ${x} ${top})`} />
        ))}
        <circle cx={x} cy={top} r={1.8} fill="#ffd166" />
      </g>
    </g>
  );
}

function Ground() {
  const art = useMemo(() => {
    const r = seeded(5);
    // A hand-drawn horizon line that is dead flat across the landing strip.
    const pts: P[] = [];
    for (let x = -540; x <= 940; x += 18) {
      const flat = x > LANDING[0] - 20 && x < LANDING[1] + 20;
      pts.push([x, GROUND + (flat ? 0 : (r() - 0.5) * 2.4)]);
    }
    const edge = brush(pts, () => 2.2, r, 0.25);
    const dashes = Array.from({ length: 34 }, () => {
      const x = -520 + r() * 1440;
      const y = GROUND + 8 + r() * 26;
      return `M${n(x)} ${n(y)} l${n(5 + r() * 6)} ${n((r() - 0.5) * 1.5)}`;
    }).join(' ');
    return { edge, dashes };
  }, []);
  return (
    <g>
      <rect x={-560} y={GROUND} width={1520} height={H} fill="#8fd694" />
      <rect x={-560} y={GROUND + 18} width={1520} height={H} fill="#7cc683" />
      <path d={art.dashes} stroke="#64b36c" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      <path d={art.edge} fill={GRASS_INK} />
      {[-230, -170, -96, -32, 94, 282, 342, 404, 470, 548].map((x, i) => (
        <Tuft key={x} x={x} s={0.8 + (i % 3) * 0.15} seed={i + 40} />
      ))}
      <Flower x={-188} color="#ff70a6" />
      <Flower x={-64} color="#ffd166" />
      <Flower x={92} color="#5fc8ee" />
      <Flower x={298} color="#ff70a6" />
      <Flower x={436} color="#ffd166" />
      <g fill="#c9c2b6" stroke="#8d8577" strokeWidth={0.8}>
        <ellipse cx={-118} cy={GROUND + 10} rx={4} ry={2.4} />
        <ellipse cx={278} cy={GROUND + 14} rx={3.2} ry={2} />
        <ellipse cx={510} cy={GROUND + 9} rx={4.4} ry={2.6} />
      </g>
    </g>
  );
}

/** Everything behind the buddy. Static, so it's memoized and never re-rendered. */
const Backdrop = memo(function Backdrop() {
  return (
    <g>
      <defs>
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="-40" x2="0" y2={GROUND}>
          <stop offset="0" stopColor="#9dd2f1" />
          <stop offset="1" stopColor="#eaf7fd" />
        </linearGradient>
      </defs>
      <rect x={-560} y={-300} width={1520} height={GROUND + 300} fill="url(#sky)" />
      <Sun />
      <Cloud x={70} y={64} s={1} dur={150} delay={-40} />
      <Cloud x={250} y={118} s={0.72} dur={115} delay={-80} />
      <Cloud x={160} y={34} s={0.55} dur={190} delay={-10} />
      <Cloud x={-160} y={150} s={0.85} dur={170} delay={-120} />
      <g className="birds">
        <Bird x={0} y={96} s={1} dur={0.5} />
        <Bird x={17} y={104} s={0.8} dur={0.42} />
      </g>
      {/* Far hills */}
      <path d={`M-560 ${GROUND - 14} Q-470 300 -380 322 T-200 316 T-20 326 T160 312 T340 322 T520 306 T700 322 T940 316 V${GROUND + 5} H-560 Z`} fill="#cdeedb" />
      {/* Near hills */}
      <path d={`M-440 ${GROUND + 1} C-380 300 -240 294 -150 328 C-118 340 -92 346 -60 ${GROUND + 1} Z`} fill="#a8dda8" stroke={GRASS_INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={`M262 ${GROUND + 1} C300 322 380 302 470 314 C540 324 600 340 650 ${GROUND + 1} Z`} fill="#a8dda8" stroke={GRASS_INK} strokeWidth={1.5} strokeLinejoin="round" />
      <Tree x={318} />
      <Fence x0={16} />
      <Ground />
    </g>
  );
});

// ---------------- the buddy ----------------

interface Props {
  avatarId: string;
  status: RoundStatus;
  balloonsLeft: number;
  maxBalloons: number;
  roundKey: number;
}

/** Vertical position of the buddy (top of figure coordinates, in scene units). */
function altitude(status: RoundStatus, balloonsLeft: number, maxBalloons: number): number {
  const onGround = GROUND - FEET;
  if (status === 'fell') return onGround;
  if (status === 'timeout') return -420; // floats away off the top
  // Highest point keeps the top balloon (plus bob) inside the frame.
  const highest = TOP_MARGIN + BOB - (HAND[1] + bunchTop(maxBalloons)) * SCALE;
  const lowest = onGround - LOW_HOVER; // one balloon left: still well up in the air
  if (maxBalloons <= 1) return highest;
  return lowest - ((lowest - highest) * (balloonsLeft - 1)) / (maxBalloons - 1);
}

const SPARKLE = 'M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z';

export function SkyScene({ avatarId, status, balloonsLeft, maxBalloons, roundKey }: Props) {
  // While falling, show the flailing pose; plop down dizzy the moment the drop transition ends.
  const [landed, setLanded] = useState(status === 'fell');
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== 'fell') return setLanded(false);
    if (was === 'fell') return;
    setLanded(false);
    const fallback = setTimeout(() => setLanded(true), HANG_MS + FALL_MS + 200);
    return () => clearTimeout(fallback);
  }, [status]);

  let pose: Pose = 'hold';
  let mood: Mood | undefined;
  if (status === 'solved') pose = 'celebrate';
  else if (status === 'fell') pose = landed ? 'dizzy' : 'fall';
  else if (status === 'timeout') mood = 'worried';
  else if (status === 'playing' && maxBalloons > 2 && balloonsLeft <= 2) mood = 'worried';

  const ty = altitude(status, balloonsLeft, maxBalloons);
  const tx = status === 'timeout' ? TX + 70 : TX;

  return (
    <svg className={`sky-scene${status === 'fell' && landed ? ' thud' : ''}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <Backdrop />
      <g
        key={roundKey}
        className={`floater status-${status}`}
        style={{
          transform: `translate(${n(tx)}px, ${n(ty)}px) scale(${SCALE})`,
          ...(status === 'fell' ? { transitionDuration: `${FALL_MS}ms`, transitionDelay: `${HANG_MS}ms` } : null),
        }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && status === 'fell') setLanded(true);
        }}
      >
        <g className={status === 'playing' || status === 'spectating' || status === 'solved' ? 'bob' : ''}>
          <BalloonBunch count={maxBalloons} left={balloonsLeft} hand={HAND} />
          <g className={status === 'fell' && landed ? 'squash' : ''}>
            <StickFigure avatarId={avatarId} pose={pose} mood={mood} embedded />
          </g>
          {status === 'fell' && !landed && (
            <g className="speed-lines" stroke="#2b2d42" strokeWidth={1.6} strokeLinecap="round" opacity={0.45}>
              <path d="M30 -16 L30 -34 M50 -24 L50 -48 M70 -16 L70 -34" />
            </g>
          )}
          {status === 'fell' && landed && (
            <g className="dust" fill="#efe8d6" stroke="#cfc6b0" strokeWidth={0.8}>
              <ellipse cx={20} cy={130} rx={11} ry={5.5} />
              <ellipse cx={80} cy={130} rx={11} ry={5.5} />
              <ellipse cx={50} cy={133} rx={17} ry={5} />
            </g>
          )}
          {status === 'solved' && (
            <g className="sparkles" fill="#ffd166" stroke="#c98a00" strokeWidth={0.8} strokeLinejoin="round">
              {[
                [10, 44, 1],
                [16, 92, 0.7],
                [98, 66, 0.85],
                [104, 104, 0.6],
              ].map(([x, y, s], i) => (
                <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                  <path d={SPARKLE} style={{ animationDelay: `${i * 0.18}s` }} />
                </g>
              ))}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
