import { useEffect, useRef, useState } from 'react';
import type { RoundStatus } from '../../shared/types';
import { HAND, StickFigure, type Pose } from './StickFigure';

export const BALLOON_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#9b5de5', '#ff70a6', '#4cc9f0'];
// Balloons pop in this order so it doesn't look like a left-to-right sweep.
const POP_ORDER = [3, 6, 1, 5, 0, 7, 2, 4];

const W = 360;
const H = 380;
const GROUND = 348; // y of the ground line
const SCALE = 0.8; // figure units → scene units
const FEET = 132 * SCALE; // feet sit at y=132 in figure units (every pose)
const TOP_MARGIN = 16;
const BOB = 8; // idle bob amplitude, in scene units
const BALLOON_RY = 27;
const FALL_MS = 650;

export function balloonLayout(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (((n === 1 ? 0 : -48 + (96 * i) / (n - 1)) as number) * Math.PI) / 180;
    const d = i % 2 ? 98 : 124;
    return { x: HAND.x + Math.sin(a) * d, y: HAND.y - Math.cos(a) * d, color: BALLOON_COLORS[i % BALLOON_COLORS.length] };
  });
}

export function Balloon({ x, y, color, popped, index }: { x: number; y: number; color: string; popped: boolean; index: number }) {
  return (
    <g className={`balloon${popped ? ' popped' : ''}`}>
      <path
        className="balloon-string"
        d={`M${HAND.x} ${HAND.y} Q${(HAND.x + x) / 2 + 8} ${(HAND.y + y) / 2 + 10} ${x} ${y + 27}`}
        stroke="#6c757d"
        strokeWidth={1.4}
        fill="none"
      />
      <g className="balloon-body" style={{ animationDelay: `${-index * 0.37}s` }}>
        <path d={`M${x} ${y + 26} l-4 6 h8 z`} fill={color} />
        <ellipse cx={x} cy={y} rx={22} ry={BALLOON_RY} fill={color} stroke="rgba(0,0,0,.18)" strokeWidth={1.5} />
        <ellipse cx={x - 8} cy={y - 10} rx={5} ry={8} fill="#fff" opacity={0.45} transform={`rotate(25 ${x - 8} ${y - 10})`} />
      </g>
      {popped && (
        <g className="pop-burst" stroke={color} strokeWidth={3} strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return (
              <path
                key={a}
                d={`M${x + Math.cos(r) * 18} ${y + Math.sin(r) * 18} L${x + Math.cos(r) * 32} ${y + Math.sin(r) * 32}`}
              />
            );
          })}
        </g>
      )}
    </g>
  );
}

function Cloud({ x, y, s, dur }: { x: number; y: number; s: number; dur: number }) {
  return (
    <g className="cloud" style={{ animationDuration: `${dur}s`, animationDelay: `${-x / 10}s` }}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity={0.9}>
        <ellipse cx={0} cy={10} rx={34} ry={14} />
        <circle cx={-12} cy={2} r={14} />
        <circle cx={10} cy={-2} r={18} />
      </g>
    </g>
  );
}

function Ground({ thud }: { thud: boolean }) {
  // The ground is flat under the buddy so a landing visibly touches it; hills sit off to the sides.
  // Everything is drawn well past the viewBox so wide stages are filled edge to edge.
  return (
    <g className={thud ? 'ground thud' : 'ground'}>
      <ellipse cx={-10} cy={GROUND + 6} rx={110} ry={34} fill="#a6e0a0" />
      <ellipse cx={385} cy={GROUND + 8} rx={130} ry={40} fill="#a6e0a0" />
      <ellipse cx={-260} cy={GROUND + 4} rx={150} ry={30} fill="#a6e0a0" />
      <ellipse cx={640} cy={GROUND + 6} rx={160} ry={34} fill="#a6e0a0" />
      <rect x={-700} y={GROUND} width={1760} height={H} fill="#8fd694" />
      <rect x={-700} y={GROUND + 14} width={1760} height={H} fill="#6cc070" />
      <path d={`M-700 ${GROUND} H1060`} stroke="#79c47f" strokeWidth={2} />
      {[22, 88, 262, 330, -80, 430].map((x) => (
        <path key={x} d={`M${x} ${GROUND + 1} l3 -10 l3 10 l3 -8 l2 8`} stroke="#4a9e50" strokeWidth={2} fill="none" />
      ))}
      {[
        [56, '#ff70a6'],
        [300, '#ffd166'],
        [-30, '#4cc9f0'],
      ].map(([x, c]) => (
        <g key={x as number} transform={`translate(${x} ${GROUND - 10})`}>
          <path d="M0 0 V10" stroke="#4a9e50" strokeWidth={2} />
          <circle r={4} fill={c as string} />
          <circle r={1.8} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

interface Props {
  avatarId: string;
  status: RoundStatus;
  balloonsLeft: number;
  maxBalloons: number;
  roundKey: number;
}

/** Vertical position of the buddy (top of figure coordinates, in scene units). */
function altitude(status: RoundStatus, balloonsLeft: number, maxBalloons: number, clusterTop: number): number {
  const onGround = GROUND - FEET; // feet exactly on the ground line
  if (status === 'fell') return onGround;
  if (status === 'timeout') return -340; // drifts off the top
  // Highest point keeps the top balloon (plus bob) inside the frame.
  const highest = TOP_MARGIN + BOB - clusterTop * SCALE;
  const lowest = onGround - 26; // one balloon left: hovering just above the grass
  if (maxBalloons <= 1) return highest;
  return lowest - ((lowest - highest) * (balloonsLeft - 1)) / (maxBalloons - 1);
}

export function SkyScene({ avatarId, status, balloonsLeft, maxBalloons, roundKey }: Props) {
  const popped = maxBalloons - balloonsLeft;
  const balloons = balloonLayout(maxBalloons);
  const clusterTop = Math.min(...balloons.map((b) => b.y)) - BALLOON_RY;
  const poppedSet = new Set(POP_ORDER.filter((i) => i < maxBalloons).slice(0, popped));

  // While falling, show the flailing pose; switch to dizzy the moment the drop transition ends.
  const [landed, setLanded] = useState(status === 'fell');
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== 'fell') return setLanded(false);
    if (was === 'fell') return;
    setLanded(false);
    const fallback = setTimeout(() => setLanded(true), FALL_MS + 200);
    return () => clearTimeout(fallback);
  }, [status]);

  let pose: Pose = 'hold';
  if (status === 'solved') pose = 'cheer';
  else if (status === 'fell') pose = landed ? 'dizzy' : 'fall';

  const ty = altitude(status, balloonsLeft, maxBalloons, clusterTop);
  const tx = W / 2 - 50 * SCALE - 12;

  return (
    <svg className="sky-scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <Cloud x={60} y={60} s={1} dur={70} />
      <Cloud x={250} y={110} s={0.7} dur={55} />
      <Cloud x={170} y={30} s={0.5} dur={90} />
      <Cloud x={-200} y={140} s={0.8} dur={80} />
      <Cloud x={480} y={70} s={0.9} dur={65} />
      <Ground thud={status === 'fell' && landed} />
      <g
        key={roundKey}
        className={`floater status-${status}`}
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${SCALE})`, transitionDuration: status === 'fell' ? `${FALL_MS}ms` : undefined }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && status === 'fell') setLanded(true);
        }}
      >
        <g className={status === 'playing' || status === 'spectating' || status === 'solved' ? 'bob' : ''}>
          {balloons.map((b, i) => (
            <Balloon key={i} index={i} {...b} popped={poppedSet.has(i)} />
          ))}
          <g className={status === 'fell' && landed ? 'squash' : ''}>
            <StickFigure avatarId={avatarId} pose={pose} embedded />
          </g>
          {status === 'fell' && landed && (
            <g className="dust" fill="#e9e4d4">
              <ellipse cx={26} cy={130} rx={14} ry={7} />
              <ellipse cx={74} cy={130} rx={14} ry={7} />
              <ellipse cx={50} cy={134} rx={20} ry={6} />
            </g>
          )}
          {status === 'solved' && (
            <g className="sparkles" fill="#ffd166">
              {[
                [10, 10],
                [95, 0],
                [0, 70],
                [100, 80],
              ].map(([x, y], i) => (
                <path key={i} d={`M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z`} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
