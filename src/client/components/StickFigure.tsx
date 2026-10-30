import { memo, useMemo, type ReactNode } from 'react';
import { getAvatar, type Accessory, type Avatar } from '../../shared/avatars';
import { blob, hashString, inkCircle, inkCurve, n, seeded, type P } from '../art/ink';

export type Pose = 'stand' | 'wave' | 'hold' | 'celebrate' | 'cheer' | 'fall' | 'dizzy' | 'sad';
export type Mood = 'happy' | 'worried' | 'joy' | 'panic' | 'dizzy' | 'sad';

// Figure coordinates: head centre (50, 32), feet on y = 132.
export const FIGURE_VIEWBOX = { x: 0, y: -20, w: 100, h: 170 };
/** Where the balloon strings are gathered (the raised right hand in the 'hold' pose). */
export const HAND: P = [82, 20];

const INK = '#2b2d42';
const SKIN = '#fffdf6';
const BLUSH = '#ff8fab';
const motionOK = typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Curve = [P, P, P]; // start, bend (control point), end

interface PoseDef {
  head: P; // head centre
  tilt: number; // degrees
  body: Curve;
  armL: Curve;
  armR: Curve;
  legL: Curve;
  legR: Curve;
  shoes: [number, number]; // shoe angles, degrees (0 = toes pointing right)
  mood: Mood;
}

const STANDING = {
  legL: [[50, 95], [44.5, 113], [39, 129]] as Curve,
  legR: [[50, 95], [55.5, 113], [61, 129]] as Curve,
  shoes: [182, -2] as [number, number],
};
const BODY: Curve = [[50, 47], [51.2, 71], [50, 95]];
const HOLD_ARM: Curve = [[50, 58], [72, 52], HAND];

const POSES: Record<Pose, PoseDef> = {
  stand: { head: [50, 32], tilt: 0, body: BODY, armL: [[50, 58], [41, 70], [35, 86]], armR: [[50, 58], [59, 70], [65, 86]], ...STANDING, mood: 'happy' },
  wave: { head: [50, 32], tilt: -3, body: BODY, armL: [[50, 58], [41, 70], [35, 86]], armR: [[50, 58], [65, 53], [73, 33]], ...STANDING, mood: 'happy' },
  hold: {
    head: [50, 32],
    tilt: 5,
    body: [[50, 47], [48.5, 71], [50, 95]],
    armL: [[50, 58], [40, 66], [33, 80]],
    armR: HOLD_ARM,
    legL: [[50, 95], [46, 113], [43.5, 130]],
    legR: [[50, 95], [55.5, 111], [57.5, 127]],
    shoes: [118, 72],
    mood: 'happy',
  },
  // Solved while still holding the balloons: a one-armed fist pump and a little kick.
  celebrate: {
    head: [50, 32],
    tilt: -4,
    body: [[50, 47], [49, 71], [50, 95]],
    armL: [[50, 58], [36, 54], [27, 31]],
    armR: HOLD_ARM,
    legL: [[50, 95], [45.5, 113], [43, 130]],
    legR: [[50, 95], [64, 103], [67, 119]],
    shoes: [112, 18],
    mood: 'joy',
  },
  cheer: {
    head: [50, 32],
    tilt: 0,
    body: BODY,
    armL: [[50, 58], [37, 49], [31, 28]],
    armR: [[50, 58], [63, 49], [69, 28]],
    ...STANDING,
    mood: 'joy',
  },
  fall: {
    head: [50, 32],
    tilt: -9,
    body: [[50, 47], [52, 71], [50, 95]],
    armL: [[50, 58], [35, 53], [23, 39]],
    armR: [[50, 58], [65, 53], [77, 39]],
    legL: [[50, 95], [40, 111], [33, 129]],
    legR: [[50, 95], [60, 111], [67, 129]],
    shoes: [200, -20],
    mood: 'panic',
  },
  // Plopped down on the ground after a fall: bottom, hands and feet all touch y = 132.
  dizzy: {
    head: [50, 70],
    tilt: -10,
    body: [[50, 86], [48, 105], [50, 124]],
    armL: [[50, 96], [36, 106], [29, 127.8]],
    armR: [[50, 96], [64, 106], [71, 127.8]],
    // Legs splayed flat on the grass like a floppy doll, soles towards us.
    legL: [[48, 124], [39, 128.5], [27, 127.5]],
    legR: [[52, 124], [61, 128.5], [73, 127.5]],
    shoes: [250, 290],
    mood: 'dizzy',
  },
  sad: {
    head: [50, 33],
    tilt: -7,
    body: [[50, 48], [48.5, 72], [50, 95]],
    armL: [[50, 59], [45, 73], [43, 89]],
    armR: [[50, 59], [55, 73], [57, 89]],
    legL: [[50, 95], [46.5, 113], [44, 129]],
    legR: [[50, 95], [53.5, 113], [56, 129]],
    shoes: [185, -5],
    mood: 'sad',
  },
};

// ---------------- face ----------------

function spiral(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 26; i++) {
    const a = i * 0.55;
    const r = 0.35 + i * 0.12;
    pts.push(`${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`);
  }
  return `M${pts.join(' L')}`;
}

const line = { stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

function OpenEyes({ delay, look = 0 }: { delay: string; look?: number }) {
  return (
    <g className="eyes" style={{ animationDelay: delay }}>
      {[44.6, 55.4].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={30.5 + look} rx={1.95} ry={2.6} fill={INK} />
          <circle cx={x + 0.6} cy={29.5 + look} r={0.75} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function Cheeks({ strong }: { strong?: boolean }) {
  return (
    <g fill={BLUSH} opacity={strong ? 0.7 : 0.5}>
      <ellipse cx={40.3} cy={36.2} rx={3.1} ry={1.9} />
      <ellipse cx={59.7} cy={36.2} rx={3.1} ry={1.9} />
    </g>
  );
}

function Face({ mood, blinkDelay }: { mood: Mood; blinkDelay: string }) {
  switch (mood) {
    case 'joy':
      return (
        <g>
          <path d="M42.3 31.4 Q44.6 28 46.9 31.4 M53.1 31.4 Q55.4 28 57.7 31.4" {...line} />
          <Cheeks strong />
          <path d="M44 35.8 Q50 36.9 56 35.8 Q55.2 42.6 50 42.6 Q44.8 42.6 44 35.8 Z" fill={INK} />
          <path d="M46.8 41 Q50 38.8 53.2 41 Q50 42.7 46.8 41 Z" fill={BLUSH} />
        </g>
      );
    case 'worried':
      return (
        <g>
          <path d="M41.2 26.4 Q44 24.4 47.2 24 M52.8 24 Q56 24.4 58.8 26.4" {...line} strokeWidth={1.5} />
          <OpenEyes delay={blinkDelay} look={-0.3} />
          <Cheeks />
          <path d="M45.3 39.3 q1.2 -1.4 2.4 0 t2.4 0 t2.4 0 t2.4 0" {...line} strokeWidth={1.5} />
          <path className="sweat" d="M64.2 20.6 C62.2 23.6 62.4 26.2 64.2 26.2 C66 26.2 66.2 23.6 64.2 20.6 Z" fill="#9edcf7" stroke={INK} strokeWidth={0.9} />
        </g>
      );
    case 'panic':
      return (
        <g>
          <path d="M41.4 24.2 Q44.4 21.6 47.4 23.6 M52.6 23.6 Q55.6 21.6 58.6 24.2" {...line} strokeWidth={1.5} />
          {[44.4, 55.6].map((x) => (
            <g key={x}>
              <circle cx={x} cy={30.4} r={3.3} fill="#fff" stroke={INK} strokeWidth={1.2} />
              <circle cx={x} cy={31} r={1.35} fill={INK} />
            </g>
          ))}
          <ellipse cx={50} cy={39.6} rx={2.6} ry={3.3} fill={INK} />
        </g>
      );
    case 'dizzy':
      return (
        <g>
          <path d={`${spiral(44.6, 30.6)} ${spiral(55.4, 30.6)}`} {...line} strokeWidth={1.05} />
          <Cheeks />
          <path d="M44.6 39.4 q1.35 -1.6 2.7 0 t2.7 0 t2.7 0 t2.7 0" {...line} strokeWidth={1.5} />
        </g>
      );
    case 'sad':
      return (
        <g>
          <path d="M41.6 26.6 Q44.4 25.8 47 24.6 M53 24.6 Q55.6 25.8 58.4 26.6" {...line} strokeWidth={1.4} />
          <OpenEyes delay={blinkDelay} look={0.6} />
          <path d="M45.4 40.4 Q50 36.6 54.6 40.4" {...line} />
        </g>
      );
    default:
      return (
        <g>
          <OpenEyes delay={blinkDelay} />
          <Cheeks />
          <path d="M44.8 37.1 Q50 41.9 55.2 37.1" {...line} />
        </g>
      );
  }
}

// ---------------- accessories ----------------

const hatLine = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Gentle back-and-forth rotation around a pivot (SVG-native, so pivots stay correct when nested). */
function Wiggle({ cx, cy, deg, dur, children }: { cx: number; cy: number; deg: number; dur: number; children: ReactNode }) {
  return (
    <g>
      {motionOK && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`${-deg} ${cx} ${cy};${deg} ${cx} ${cy};${-deg} ${cx} ${cy}`}
          dur={`${dur}s`}
          repeatCount="indefinite"
          calcMode="spline"
          keyTimes="0;0.5;1"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      )}
      {children}
    </g>
  );
}

function AccessoryArt({ av, crowned }: { av: Avatar; crowned: boolean }) {
  const { color, ink } = av;
  switch (av.accessory) {
    case 'partyhat':
      return (
        <g transform="rotate(-8 50 20)">
          <path d="M38.6 21.6 Q50 24.2 61.4 21.6 L51 -6.4 Z" fill={color} {...hatLine} />
          <g fill="#fff" opacity={0.85}>
            <circle cx={46.2} cy={14.6} r={1.6} />
            <circle cx={53.6} cy={8.4} r={1.4} />
            <circle cx={55.8} cy={17.4} r={1.5} />
            <circle cx={50.4} cy={3} r={1.1} />
          </g>
          <Wiggle cx={51} cy={-6} deg={6} dur={1.9}>
            <circle cx={51} cy={-8.6} r={4.6} fill="#ffd166" stroke={INK} strokeWidth={1.2} />
            <path d="M48.6 -10.6 l1 1.6 M52.4 -11.2 l-.6 1.8 M53.6 -7.6 l-1.6 .4" stroke="#e0a800" strokeWidth={0.9} strokeLinecap="round" />
          </Wiggle>
        </g>
      );
    case 'bow':
      return (
        <g {...hatLine} strokeWidth={1.3}>
          <path d="M61 16 C56.2 9 50 10.6 51.4 17 C52.4 21.8 57 21.2 61 16 Z" fill={color} />
          <path d="M61 16 C65.8 9 72 10.6 70.6 17 C69.6 21.8 65 21.2 61 16 Z" fill={color} />
          <path d="M54.4 14.2 Q56.8 15.4 58.6 16.2 M67.6 14.2 Q65.2 15.4 63.4 16.2" fill="none" stroke={ink} strokeWidth={0.9} />
          <ellipse cx={61} cy={16.2} rx={2.6} ry={3} fill={ink} />
        </g>
      );
    case 'cap':
      return (
        <g {...hatLine}>
          <path d="M35.6 23.5 C35.3 10.8 64.7 10.8 64.4 23.5 Q50 21 35.6 23.5 Z" fill={color} />
          <path d="M50 11.6 L50 21.6 M42.4 13.6 Q41 17 41.2 22.2" fill="none" stroke={INK} strokeWidth={0.9} opacity={0.45} />
          <path d="M33.5 23.3 Q50 19.6 66.5 23.3 Q68.2 25.4 65.8 26.2 Q50 23.4 34.2 26.2 Q31.8 25.4 33.5 23.3 Z" fill={ink} />
          <circle cx={50} cy={11.4} r={1.8} fill={ink} strokeWidth={0.9} />
        </g>
      );
    case 'glasses':
      return (
        <g fill="none" stroke={INK} strokeLinecap="round">
          <circle cx={44.5} cy={30.6} r={5.5} strokeWidth={1.6} fill="rgba(255,255,255,0.22)" />
          <circle cx={55.5} cy={30.6} r={5.5} strokeWidth={1.6} fill="rgba(255,255,255,0.22)" />
          <path d="M49.6 30.4 Q50 28.9 50.4 30.4" strokeWidth={1.4} />
          <path d="M39 29.6 L35.2 28.2 M61 29.6 L64.8 28.2" strokeWidth={1.4} />
          <path d="M41.8 28 Q42.6 26.8 43.9 26.5 M52.8 28 Q53.6 26.8 54.9 26.5" stroke="#fff" strokeWidth={1.1} />
        </g>
      );
    case 'halo':
      return (
        <g transform={crowned ? 'translate(0 -17)' : undefined}>
          <g>
            {motionOK && <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur="2.4s" repeatCount="indefinite" />}
            <ellipse cx={50} cy={4.5} rx={12.6} ry={3.7} fill="none" stroke="#f4c430" strokeWidth={3.2} />
            <ellipse cx={50} cy={4.1} rx={11.4} ry={2.8} fill="none" stroke="#fff6c2" strokeWidth={1} />
          </g>
        </g>
      );
    case 'mustache':
      return (
        <path
          d="M50 36.3 C47 34.2 43.5 34.6 41.5 36.6 C40.2 38 38.6 38 38 36.6 C38.6 39.6 42.4 40.2 45 38.8 C47 37.8 48.6 37.7 50 38.4 C51.4 37.7 53 37.8 55 38.8 C57.6 40.2 61.4 39.6 62 36.6 C61.4 38 59.8 38 58.5 36.6 C56.5 34.6 53 34.2 50 36.3 Z"
          fill="#5b3a29"
          stroke="#3b2418"
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
      );
    case 'headphones':
      return (
        <g>
          <path d="M34.2 29 C34.2 9.8 65.8 9.8 65.8 29" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M35.4 25 C36.4 12.6 63.6 12.6 64.6 25" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
          <rect x={29.4} y={23.6} width={8.2} height={13.4} rx={3.6} fill={color} {...hatLine} strokeWidth={1.4} />
          <rect x={62.4} y={23.6} width={8.2} height={13.4} rx={3.6} fill={color} {...hatLine} strokeWidth={1.4} />
          <path d="M35.8 26.4 L35.8 34.2 M64.2 26.4 L64.2 34.2" stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
        </g>
      );
    case 'flower':
      return (
        <Wiggle cx={62} cy={16} deg={4} dur={3.1}>
          <g stroke={INK} strokeWidth={0.9}>
            {[0, 51, 103, 154, 206, 257, 309].map((a) => (
              <ellipse key={a} cx={62} cy={11.2} rx={2.5} ry={4.4} fill="#fff" transform={`rotate(${a} 62 15.6)`} />
            ))}
            <circle cx={62} cy={15.6} r={2.8} fill="#ffd166" />
          </g>
        </Wiggle>
      );
    case 'beanie':
      return (
        <g {...hatLine}>
          <path d="M35 23 C34.2 7 65.8 7 65 23 Z" fill={color} />
          <rect x={33.6} y={19} width={32.8} height={6.6} rx={3.3} fill={ink} />
          <path d="M37.6 19.6 V25 M41.4 19.4 V25.3 M45.2 19.3 V25.4 M49 19.3 V25.5 M52.8 19.3 V25.4 M56.6 19.4 V25.3 M60.4 19.4 V25.2 M64 19.8 V24.8" stroke="#fff" strokeWidth={0.8} opacity={0.35} />
          <Wiggle cx={50} cy={8.5} deg={5} dur={2.3}>
            <circle cx={50} cy={6.4} r={5} fill="#fff" strokeWidth={1.2} />
            <path d="M46.6 5 l1.4 1 M50.4 2.6 l.2 1.6 M53.4 5.4 l-1.4 .8 M48.6 9 l1 -1" stroke="#c7ced8" strokeWidth={0.9} />
          </Wiggle>
        </g>
      );
    case 'bandana':
      return (
        <g {...hatLine} strokeWidth={1.3}>
          <path d="M35 24.8 Q29 20 25.4 21.6 Q28 24.6 34.8 26.6 Z" fill={color} />
          <path d="M35 25.8 Q29.6 29 27.6 33.2 Q31.2 31.6 35.2 27 Z" fill={color} />
          <path d="M34.6 23.6 Q50 15.4 65.4 23.6 L65.6 27 Q50 19.6 34.4 27 Z" fill={color} />
          <g fill="#fff" stroke="none">
            <circle cx={42} cy={21.8} r={0.95} />
            <circle cx={50} cy={19.6} r={0.95} />
            <circle cx={58} cy={21.8} r={0.95} />
            <circle cx={46} cy={22.4} r={0.6} />
            <circle cx={54} cy={22.4} r={0.6} />
          </g>
        </g>
      );
    case 'tophat':
      return (
        <g {...hatLine} strokeWidth={1.3}>
          <path d="M39 15.6 L38.2 -4.6 Q50 -6.8 61.8 -4.6 L61 15.6 Z" fill="#2f3338" />
          <path d="M38.9 10.6 L61.1 10.6 L61 15.6 L39 15.6 Z" fill="#ef476f" />
          <ellipse cx={50} cy={-4.6} rx={11.8} ry={2.2} fill="#3d434a" />
          <path d="M42 -1.4 L42.4 8.6" stroke="rgba(255,255,255,0.3)" strokeWidth={1.6} />
          <path d="M31.6 16.8 Q50 12.6 68.4 16.8 Q50 20.6 31.6 16.8 Z" fill="#2f3338" />
        </g>
      );
    case 'antenna':
      return (
        <g>
          {[
            { base: [44.6, 18.4], tip: [37.4, 2.6], c: [42, 9], dur: 1.7 },
            { base: [55.4, 18.4], tip: [62.6, 2.6], c: [58, 9], dur: 2.1 },
          ].map(({ base, tip, c, dur }) => (
            <Wiggle key={dur} cx={base[0]} cy={base[1]} deg={7} dur={dur}>
              <path d={`M${base[0]} ${base[1]} Q${c[0]} ${c[1]} ${tip[0]} ${tip[1]}`} fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
              <circle cx={tip[0]} cy={tip[1]} r={3.7} fill={color} stroke={INK} strokeWidth={1.2} />
              <circle cx={tip[0] - 1.1} cy={tip[1] - 1.2} r={0.9} fill="#fff" />
            </Wiggle>
          ))}
        </g>
      );
  }
}

/** Where a crown sits for each accessory, so it perches on hats instead of crashing into them. */
const CROWN_SPOT: Record<Accessory, { base: number; x: number; scale: number; tilt: number }> = {
  partyhat: { base: -10.5, x: 51, scale: 0.78, tilt: -8 },
  bow: { base: 19, x: 43.5, scale: 0.82, tilt: -10 },
  cap: { base: 13.6, x: 50, scale: 0.9, tilt: -5 },
  glasses: { base: 19.4, x: 50, scale: 1, tilt: -5 },
  halo: { base: 19.4, x: 50, scale: 1, tilt: -5 },
  mustache: { base: 19.4, x: 50, scale: 1, tilt: -5 },
  headphones: { base: 14.6, x: 50, scale: 0.9, tilt: -4 },
  flower: { base: 19, x: 43.5, scale: 0.82, tilt: -10 },
  beanie: { base: 4.6, x: 50, scale: 0.84, tilt: -6 },
  bandana: { base: 19.4, x: 50, scale: 1, tilt: -5 },
  tophat: { base: -5.6, x: 50, scale: 0.84, tilt: -6 },
  antenna: { base: 19.4, x: 50, scale: 0.8, tilt: -4 },
};

function Crown({ accessory }: { accessory: Accessory }) {
  const { base, x, scale, tilt } = CROWN_SPOT[accessory];
  return (
    <g transform={`translate(${x} ${base}) rotate(${tilt}) scale(${scale})`}>
      <path d="M-14 0 L-12.5 -13 L-6 -6.5 L0 -16 L6 -6.5 L12.5 -13 L14 0 Q0 2.2 -14 0 Z" fill="#ffd166" stroke="#c98a00" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-12 -3 Q0 -1.2 12 -3" fill="none" stroke="#e8a900" strokeWidth={1.1} />
      <circle cx={0} cy={-5} r={1.9} fill="#ef476f" />
      <circle cx={-7} cy={-3.6} r={1.3} fill="#4cc9f0" />
      <circle cx={7} cy={-3.6} r={1.3} fill="#06d6a0" />
      <g fill="#ffd166" stroke="#c98a00" strokeWidth={1}>
        <circle cx={-12.5} cy={-13.6} r={1.5} />
        <circle cx={0} cy={-16.8} r={1.6} />
        <circle cx={12.5} cy={-13.6} r={1.5} />
      </g>
    </g>
  );
}

/** Three little stars circling above the head like a halo, dimming as they pass behind it. */
function DizzyStars({ cy }: { cy: number }) {
  if (!motionOK) return null;
  const rx = 23;
  const ry = 6;
  const path = `M50 ${cy + ry} A${rx} ${ry} 0 1 1 50 ${cy - ry} A${rx} ${ry} 0 1 1 50 ${cy + ry}`;
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path d="M0 -5.4 L1.6 -1.7 L5.4 -1.4 L2.5 1.3 L3.4 5.1 L0 3.1 L-3.4 5.1 L-2.5 1.3 L-5.4 -1.4 L-1.6 -1.7 Z" fill="#ffd166" stroke="#c98a00" strokeWidth={1} strokeLinejoin="round" />
          <animateMotion dur="1.6s" repeatCount="indefinite" path={path} begin={`${-i * 0.533}s`} />
          <animate attributeName="opacity" values="1;0.75;0.3;0.75;1" keyTimes="0;0.25;0.5;0.75;1" dur="1.6s" begin={`${-i * 0.533}s`} repeatCount="indefinite" />
        </g>
      ))}
    </g>
  );
}

// ---------------- head & body ----------------

const Head = memo(function Head({ av, mood, crowned, seed }: { av: Avatar; mood: Mood; crowned: boolean; seed: number }) {
  const paths = useMemo(() => {
    const r = seeded(seed + 101);
    return { fill: blob(50.7, 32.9, 15.1, r), outline: inkCircle(50, 32, 15.4, 3.5, r) };
  }, [seed]);
  const blinkDelay = `${-((seed % 4700) / 1000)}s`;
  return (
    <g>
      <path d={paths.fill} fill={SKIN} />
      <path d={paths.outline} fill={av.ink} />
      <Face mood={mood} blinkDelay={blinkDelay} />
      <AccessoryArt av={av} crowned={crowned} />
      {crowned && <Crown accessory={av.accessory} />}
    </g>
  );
});

function Shoe({ at, angle }: { at: P; angle: number }) {
  const a = (angle * Math.PI) / 180;
  const cx = at[0] + Math.cos(a) * 2.6;
  const cy = at[1] + Math.sin(a) * 2.6 * 0.6;
  return <ellipse cx={n(cx)} cy={n(cy)} rx={5.6} ry={3.2} fill={INK} transform={`rotate(${angle} ${n(cx)} ${n(cy)})`} />;
}

interface Props {
  avatarId: string;
  pose?: Pose;
  mood?: Mood;
  crowned?: boolean;
  /** Render as a <g> for embedding in another SVG instead of a standalone <svg>. */
  embedded?: boolean;
  size?: number;
  className?: string;
  title?: string;
}

export const StickFigure = memo(function StickFigure({ avatarId, pose = 'stand', mood, crowned = false, embedded, size = 64, className, title }: Props) {
  const av = getAvatar(avatarId);
  const def = POSES[pose];
  const seed = hashString(avatarId);
  const limbs = useMemo(() => {
    const r = seeded(seed + pose.length * 17);
    return {
      body: inkCurve(...def.body, 5.4, r),
      armL: inkCurve(...def.armL, 4.5, r),
      armR: inkCurve(...def.armR, 4.5, r),
      legL: inkCurve(...def.legL, 4.9, r),
      legR: inkCurve(...def.legR, 4.9, r),
    };
  }, [seed, pose, def]);

  const [hx, hy] = def.head;
  const dangling = (pose === 'hold' || pose === 'celebrate') && motionOK;
  const hip = def.legL[0];

  const figure = (
    <g className={`figure pose-${pose}`}>
      <g>
        {dangling && (
          <animateTransform attributeName="transform" type="rotate" values={`-3 ${hip[0]} ${hip[1]};4 ${hip[0]} ${hip[1]};-3 ${hip[0]} ${hip[1]}`} dur="2.8s" repeatCount="indefinite" />
        )}
        <path d={limbs.legL} fill={av.ink} />
        <path d={limbs.legR} fill={av.ink} />
        <Shoe at={def.legL[2]} angle={def.shoes[0]} />
        <Shoe at={def.legR[2]} angle={def.shoes[1]} />
      </g>
      <path d={limbs.body} fill={av.ink} />
      <path d={limbs.armL} fill={av.ink} />
      <circle cx={def.armL[2][0]} cy={def.armL[2][1]} r={3.1} fill={av.ink} />
      <g>
        {pose === 'wave' && motionOK && (
          <animateTransform attributeName="transform" type="rotate" values="-10 50 58;12 50 58;-10 50 58" dur="1.1s" repeatCount="indefinite" />
        )}
        <path d={limbs.armR} fill={av.ink} />
        <circle cx={def.armR[2][0]} cy={def.armR[2][1]} r={3.1} fill={av.ink} />
      </g>
      <g transform={`translate(${hx - 50} ${hy - 32}) rotate(${def.tilt} 50 34)`}>
        <Head av={av} mood={mood ?? def.mood} crowned={crowned} seed={seed} />
      </g>
      {pose === 'dizzy' && <DizzyStars cy={hy - 17} />}
    </g>
  );
  if (embedded) return figure;
  const { x, w } = FIGURE_VIEWBOX;
  const y = crowned ? -40 : FIGURE_VIEWBOX.y;
  const h = crowned ? FIGURE_VIEWBOX.h + 20 : FIGURE_VIEWBOX.h;
  return (
    <svg className={className} viewBox={`${x} ${y} ${w} ${h}`} width={size} height={(size * h) / w} role="img" aria-label={title ?? av.label}>
      {figure}
    </svg>
  );
});

/** Just the head: reads far better than a whole figure at scoreboard sizes. */
export const AvatarHead = memo(function AvatarHead({ avatarId, mood = 'happy', size = 32, className }: { avatarId: string; mood?: Mood; size?: number; className?: string }) {
  const av = getAvatar(avatarId);
  return (
    <svg className={className} viewBox="25 -7 50 57" width={(size * 50) / 57} height={size} role="img" aria-label={av.label}>
      <Head av={av} mood={mood} crowned={false} seed={hashString(avatarId)} />
    </svg>
  );
});
