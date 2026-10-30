import type { CSSProperties } from 'react';
import type { PlayerView } from '../../shared/types';

interface Props {
  view: PlayerView;
  revealed: boolean; // round over: color letters the player missed
  shakeKey?: number;
}

export function WordBoard({ view, revealed, shakeKey }: Props) {
  const length = view.words.reduce((n, w) => n + w.length + 1, -1);
  const longest = Math.max(...view.words.map((w) => w.length));
  const size = length <= 10 && longest <= 8 ? 'lg' : length <= 18 && longest <= 11 ? 'md' : 'sm';
  const markMissed = revealed && view.status !== 'spectating';
  return (
    <div key={shakeKey} className={`board board-${size}${shakeKey ? ' shake' : ''}`} aria-label="Word to guess">
      {view.words.map((word, wi) => (
        <span className="word" key={wi}>
          {word.map((t, ti) =>
            t.punct ? (
              <span key={ti} className="tile punct">
                {t.ch}
              </span>
            ) : (
              <span
                key={ti}
                style={{ '--tilt': `${(((wi * 7 + ti * 13) % 5) - 2) * 0.7}deg` } as CSSProperties}
                className={`tile${t.ch ? ' shown' : ''}${markMissed && t.ch && !view.guessed[t.ch] ? ' missed' : ''}`}
              >
                {t.ch ?? ''}
              </span>
            ),
          )}
        </span>
      ))}
    </div>
  );
}
