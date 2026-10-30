import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './state/store';

/** Milliseconds left until a server timestamp, updated a few times a second. */
export function useCountdown(deadline: number): number {
  const offset = useStore((s) => s.serverOffset);
  const calc = () => Math.max(0, deadline - (Date.now() + offset));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const id = setInterval(() => setLeft(calc()), 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);
  return left;
}

/** Animate a number toward its new value. */
export function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = Math.round(begin + (value - begin) * (1 - (1 - k) ** 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** FLIP animation for reordering list items. Attach the returned ref fn to each keyed child. */
export function useFlip(deps: unknown) {
  const els = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const [key, el] of els.current) {
      const top = el.offsetTop;
      next.set(key, top);
      const old = prev.current.get(key);
      if (old !== undefined && old !== top) {
        el.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 400,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    }
    prev.current = next;
  }, [deps]);
  return (key: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };
}

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
