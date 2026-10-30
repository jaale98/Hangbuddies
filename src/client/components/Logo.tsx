import type { CSSProperties } from 'react';
import { MiniBalloon } from './MiniBalloon';

// Hand-set lettering: each letter sits a little off the baseline and leans a little,
// and the dot of the "i" is a balloon.
const TILT = [-4, 2, -2, 3, -3, 2, -1, 3, -2, 4, -3];
const LIFT = [0, -3, 1, -2, 2, -1, 1, -2, 0, -3, 1];

export function Logo() {
  return (
    <h1 className="logo" aria-label="Hangbuddies">
      {[...'Hangbuddies'].map((ch, i) => {
        const style = { '--r': `${TILT[i]}deg`, '--y': `${LIFT[i]}px`, animationDelay: `${i * 0.11}s` } as CSSProperties;
        const part = i < 4 ? 'hang' : 'buddies';
        if (ch === 'i')
          return (
            <span key={i} aria-hidden="true" className={`logo-letter ${part} logo-i`} style={style}>
              ı
              <MiniBalloon color="#ffd166" size={30} />
            </span>
          );
        return (
          <span key={i} aria-hidden="true" className={`logo-letter ${part}`} style={style}>
            {ch}
          </span>
        );
      })}
    </h1>
  );
}
