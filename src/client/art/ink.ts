// Tiny "ink" toolkit: deterministic, hand-drawn-looking SVG paths.
// Everything is seeded, so a buddy looks the same every render (no jitter flicker),
// but no two strokes are mechanically perfect.

export type P = readonly [number, number];

/** Small deterministic PRNG (xorshift). Returns numbers in [0, 1). */
export function seeded(seed: number): () => number {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export const hashString = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Format a number for path data (2 decimals keeps paths small). */
export const n = (v: number) => String(Math.round(v * 100) / 100);
const pt = ([x, y]: P) => `${n(x)} ${n(y)}`;
const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Points along a quadratic Bézier curve (start, control, end). */
export function quadPoints(a: P, c: P, b: P, steps = 12): P[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as P;
  });
}

/** Points around a (slightly lumpy) circle, starting at `start` radians and running `sweep` radians. */
export function circlePoints(cx: number, cy: number, r: number, rand: () => number, start = 0, sweep = Math.PI * 2, steps = 26, lump = 0.035): P[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = start + (sweep * i) / steps;
    const rr = r * (1 + (rand() - 0.5) * 2 * lump);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as P;
  });
}

/** Smooth open curve through points (midpoint quadratic smoothing). */
function smoothOpen(points: P[], move: boolean): string {
  if (points.length < 3) return `${move ? 'M' : 'L'}${points.map(pt).join(' L')}`;
  let d = `${move ? 'M' : 'L'}${pt(points[0])} L${pt(mid(points[0], points[1]))}`;
  for (let i = 1; i < points.length - 1; i++) d += ` Q${pt(points[i])} ${pt(mid(points[i], points[i + 1]))}`;
  return d + ` L${pt(points[points.length - 1])}`;
}

/** Smooth closed blob through points. */
export function smoothClosed(points: P[]): string {
  const m = points.length;
  let d = `M${pt(mid(points[m - 1], points[0]))}`;
  for (let i = 0; i < m; i++) d += ` Q${pt(points[i])} ${pt(mid(points[i], points[(i + 1) % m]))}`;
  return d + 'Z';
}

/**
 * A brush stroke: a filled shape that follows `points`, with width varying along its length
 * (`width(t)` for t in 0..1) plus a little seeded wobble, and round ends.
 * This is what makes lines look inked rather than drawn with a uniform SVG stroke.
 */
export function brush(points: P[], width: (t: number) => number, rand: () => number, wobble = 0.14): string {
  const count = points.length;
  const left: P[] = [];
  const right: P[] = [];
  const widths: number[] = [];
  for (let i = 0; i < count; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(count - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const w = Math.max(0.4, width(i / (count - 1)) * (1 + (rand() - 0.5) * 2 * wobble)) / 2;
    widths.push(w);
    const [x, y] = points[i];
    left.push([x - ty * w, y + tx * w]);
    right.push([x + ty * w, y - tx * w]);
  }
  const wEnd = widths[count - 1];
  const wStart = widths[0];
  return (
    smoothOpen(left, true) +
    ` A${n(wEnd)} ${n(wEnd)} 0 0 0 ${pt(right[count - 1])}` +
    ' ' +
    smoothOpen([...right].reverse(), false) +
    ` A${n(wStart)} ${n(wStart)} 0 0 0 ${pt(left[0])}Z`
  );
}

/** Width profile for limbs: a touch fuller in the middle, never spindly at the ends. */
export const limbWidth = (base: number) => (t: number) => base * (0.82 + 0.18 * Math.sin(Math.PI * t));

/** Width profile for a pen line that starts and ends light (e.g. drawing a circle in one go). */
export const penWidth = (base: number) => (t: number) => base * (0.3 + 0.7 * Math.min(1, Math.sin(Math.PI * t) * 2.4));

/** A circle drawn in one pen stroke that overlaps itself a little where it starts and ends. */
export function inkCircle(cx: number, cy: number, r: number, base: number, rand: () => number): string {
  const start = rand() * Math.PI * 2;
  return brush(circlePoints(cx, cy, r, rand, start, Math.PI * 2 + 0.45, 30, 0.02), penWidth(base), rand, 0.1);
}

/** A slightly lumpy filled circle, for fills that sit under an ink outline. */
export function blob(cx: number, cy: number, r: number, rand: () => number, lump = 0.03): string {
  return smoothClosed(circlePoints(cx, cy, r, rand, rand() * 6, Math.PI * 2, 14, lump).slice(0, -1));
}

/** A brushed curve from a to b bending through control c. */
export function inkCurve(a: P, c: P, b: P, base: number, rand: () => number, profile = limbWidth): string {
  return brush(quadPoints(a, c, b, 12), profile(base), rand);
}
