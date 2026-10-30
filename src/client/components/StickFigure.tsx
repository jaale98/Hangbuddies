import { getAvatar, type Accessory } from '../../shared/avatars';

export type Pose = 'stand' | 'wave' | 'hold' | 'cheer' | 'fall' | 'dizzy' | 'sad';

// Figure coordinates live in this viewBox. Head center is (50, 32).
export const FIGURE_VIEWBOX = { x: 0, y: -20, w: 100, h: 170 };
/** Where the balloon strings attach, in figure coordinates. */
export const HAND = { x: 74, y: 28 };

const INK = '#2b2d42';

const ARMS: Record<Pose, [string, string]> = {
  stand: ['M50 60 L33 86', 'M50 60 L67 86'],
  wave: ['M50 60 L33 86', 'M50 60 L70 38 L78 24'],
  hold: ['M50 60 L31 80', `M50 60 L${HAND.x} ${HAND.y}`],
  cheer: ['M50 60 L30 32', 'M50 60 L70 32'],
  fall: ['M50 60 L26 44', 'M50 60 L74 44'],
  dizzy: ['M50 60 L30 82', 'M50 60 L70 82'],
  sad: ['M50 60 L40 88', 'M50 60 L60 88'],
};

const LEGS: Record<Pose, [string, string]> = {
  stand: ['M50 96 L37 132', 'M50 96 L63 132'],
  wave: ['M50 96 L37 132', 'M50 96 L63 132'],
  hold: ['M50 96 L40 132', 'M50 96 L60 130'],
  cheer: ['M50 96 L34 128', 'M50 96 L66 128'],
  fall: ['M50 96 L30 132', 'M50 96 L70 132'], // same foot height as standing, so landings touch down
  dizzy: ['M50 96 L32 132', 'M50 96 L68 132'],
  sad: ['M50 96 L42 132', 'M50 96 L58 132'],
};

function Face({ pose }: { pose: Pose }) {
  if (pose === 'dizzy') {
    return (
      <g stroke={INK} strokeWidth={2.2} strokeLinecap="round">
        <path d="M41 27 L47 33 M47 27 L41 33 M53 27 L59 33 M59 27 L53 33" />
        <path d="M43 40 Q46.5 37 50 40 Q53.5 43 57 40" fill="none" />
      </g>
    );
  }
  const eyes = (
    <g fill={INK}>
      <circle cx={44} cy={30} r={2.4} />
      <circle cx={56} cy={30} r={2.4} />
    </g>
  );
  const cheeks = (
    <g fill="#ff8fab" opacity={0.55}>
      <circle cx={39.5} cy={36} r={3} />
      <circle cx={60.5} cy={36} r={3} />
    </g>
  );
  let mouth;
  if (pose === 'fall') mouth = <ellipse cx={50} cy={40} rx={3.2} ry={4} fill={INK} />;
  else if (pose === 'sad') mouth = <path d="M44 41 Q50 36 56 41" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />;
  else if (pose === 'cheer') mouth = <path d="M43 36 Q50 46 57 36 Z" fill={INK} />;
  else mouth = <path d="M43.5 37 Q50 43 56.5 37" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />;
  return (
    <>
      {eyes}
      {cheeks}
      {mouth}
    </>
  );
}

function AccessoryArt({ kind, color }: { kind: Accessory; color: string }) {
  switch (kind) {
    case 'partyhat':
      return (
        <g>
          <path d="M38 21 L62 21 L50 -6 Z" fill={color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M42 13 L58 13 M45 5 L55 5" stroke="#fff" strokeWidth={2.5} />
          <circle cx={50} cy={-7} r={4.5} fill="#ffd166" stroke={INK} strokeWidth={1.2} />
        </g>
      );
    case 'bow':
      return (
        <g stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
          <path d="M60 16 L49 9 L49 23 Z" fill="#ff4d6d" />
          <path d="M60 16 L71 9 L71 23 Z" fill="#ff4d6d" />
          <circle cx={60} cy={16} r={3.4} fill="#ffb3c1" />
        </g>
      );
    case 'cap':
      return (
        <g stroke={INK} strokeWidth={1.5}>
          <path d="M35 27 A15 15 0 0 1 65 27 Z" fill={color} />
          <path d="M61 26 L80 28" strokeWidth={5} stroke={color} strokeLinecap="round" />
          <circle cx={50} cy={13} r={2} fill={INK} />
        </g>
      );
    case 'glasses':
      return (
        <g stroke={INK} strokeWidth={2.2} fill="rgba(255,255,255,.35)">
          <circle cx={43.5} cy={30} r={6} />
          <circle cx={56.5} cy={30} r={6} />
          <path d="M49.5 30 L50.5 30 M37.5 29 L35 27 M62.5 29 L65 27" fill="none" />
        </g>
      );
    case 'halo':
      return <ellipse cx={50} cy={6} rx={14} ry={4.5} fill="none" stroke="#ffd166" strokeWidth={3.5} />;
    case 'mustache':
      return (
        <path
          d="M39 38 Q44 32 50 36 Q56 32 61 38 Q56 37 50 39 Q44 37 39 38 Z"
          fill="#5b3a29"
          stroke="#5b3a29"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      );
    case 'headphones':
      return (
        <g>
          <path d="M33 31 A17 17 0 0 1 67 31" fill="none" stroke={INK} strokeWidth={4} />
          <rect x={29} y={25} width={8} height={13} rx={3} fill={color} stroke={INK} strokeWidth={1.5} />
          <rect x={63} y={25} width={8} height={13} rx={3} fill={color} stroke={INK} strokeWidth={1.5} />
        </g>
      );
    case 'flower':
      return (
        <g stroke={INK} strokeWidth={1}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={62 + 5 * Math.cos((a * Math.PI) / 180)}
              cy={16 + 5 * Math.sin((a * Math.PI) / 180)}
              r={4}
              fill="#fff"
            />
          ))}
          <circle cx={62} cy={16} r={3} fill="#ffd166" />
        </g>
      );
    case 'beanie':
      return (
        <g stroke={INK} strokeWidth={1.5}>
          <path d="M35 25 A15 15 0 0 1 65 25 Z" fill={color} />
          <rect x={33} y={21} width={34} height={7} rx={3.5} fill="#fff" />
          <circle cx={50} cy={8} r={4.5} fill="#fff" />
        </g>
      );
    case 'bandana':
      return (
        <g stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
          <path d="M35 25 Q50 15 65 25 L65 29 Q50 20 35 29 Z" fill={color} />
          <path d="M65 26 L75 20 L73 28 Z M65 27 L74 33 L68 34 Z" fill={color} />
        </g>
      );
    case 'tophat':
      return (
        <g stroke={INK} strokeWidth={1.2}>
          <rect x={38} y={-6} width={24} height={22} rx={2} fill={INK} />
          <rect x={38} y={10} width={24} height={4} fill={color} />
          <rect x={32} y={15} width={36} height={4} rx={2} fill={INK} />
        </g>
      );
    case 'antenna':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinecap="round">
          <path d="M44 19 L38 3 M56 19 L62 3" />
          <circle cx={38} cy={2} r={4} fill={color} />
          <circle cx={62} cy={2} r={4} fill={color} />
        </g>
      );
  }
}

export function Crown() {
  return (
    <path
      d="M35 14 L38 -2 L45 8 L50 -5 L55 8 L62 -2 L65 14 Z"
      fill="#ffd166"
      stroke="#e09f00"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

interface Props {
  avatarId: string;
  pose?: Pose;
  crowned?: boolean;
  /** Render as a <g> for embedding in another SVG instead of a standalone <svg>. */
  embedded?: boolean;
  size?: number;
  className?: string;
  title?: string;
}

export function StickFigure({ avatarId, pose = 'stand', crowned, embedded, size = 64, className, title }: Props) {
  const { color, accessory } = getAvatar(avatarId);
  const [armL, armR] = ARMS[pose];
  const [legL, legR] = LEGS[pose];
  const body = (
    <g className={`figure pose-${pose}`}>
      <g stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M50 47 L50 96" />
        <path d={armL} />
        <path d={armR}>
          {pose === 'wave' && (
            <animateTransform attributeName="transform" type="rotate" values="-12 50 60;14 50 60;-12 50 60" dur="1.1s" repeatCount="indefinite" />
          )}
        </path>
        <path d={legL} />
        <path d={legR} />
      </g>
      <circle cx={50} cy={32} r={15.5} fill="#fff" stroke={color} strokeWidth={5} />
      <Face pose={pose} />
      <AccessoryArt kind={accessory} color={color} />
      {crowned && <Crown />}
      {pose === 'dizzy' && (
        <g fill="#ffd166" stroke="#e09f00" strokeWidth={1}>
          <animateTransform attributeName="transform" type="rotate" from="0 50 4" to="360 50 4" dur="1.4s" repeatCount="indefinite" />
          {[0, 120, 240].map((a) => (
            <path key={a} transform={`rotate(${a} 50 4) translate(16 0)`} d="M50 0 l2 4 4 .5 -3 3 .8 4 -3.8-2 -3.8 2 .8-4 -3-3 4-.5z" />
          ))}
        </g>
      )}
    </g>
  );
  if (embedded) return body;
  const { x, y, w, h } = FIGURE_VIEWBOX;
  return (
    <svg
      className={className}
      viewBox={`${x} ${y} ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      role="img"
      aria-label={title ?? getAvatar(avatarId).label}
    >
      {body}
    </svg>
  );
}
