// Tiny synthesized sound effects: no audio files needed.
import { get } from '../state/store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (get().muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number; delay?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + (opts.delay ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(opts.vol ?? 0.15, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3) {
  const ac = audio();
  if (!ac) return;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

export const sfx = {
  click: () => tone(520, 0.05, { type: 'triangle', vol: 0.05 }),
  correct: () => {
    tone(880, 0.1, { type: 'triangle', vol: 0.12 });
    tone(1320, 0.14, { type: 'triangle', vol: 0.1, delay: 0.06 });
  },
  pop: () => {
    noise(0.12, 0.35);
    tone(300, 0.08, { type: 'square', vol: 0.05, to: 120 });
  },
  solve: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.08 })),
  fall: () => {
    tone(700, 0.45, { type: 'sine', vol: 0.12, to: 120 });
    tone(90, 0.2, { type: 'square', vol: 0.12, delay: 0.45 });
  },
  start: () => [392, 523].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.1, delay: i * 0.1 })),
  fanfare: () =>
    [523, 523, 523, 659, 784, 659, 784].forEach((f, i) =>
      tone(f, i === 6 ? 0.5 : 0.14, { type: 'square', vol: 0.06, delay: [0, 0.12, 0.24, 0.36, 0.6, 0.78, 0.9][i] }),
    ),
  tick: () => tone(1000, 0.04, { type: 'square', vol: 0.03 }),
};
