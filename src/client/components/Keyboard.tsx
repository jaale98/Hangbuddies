import { memo } from 'react';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  guessed: Record<string, boolean>;
  pending: Record<string, true>;
  disabled: boolean;
  onKey: (letter: string) => void;
}

export const Keyboard = memo(function Keyboard({ guessed, pending, disabled, onKey }: Props) {
  return (
    <div className={`keyboard${disabled ? ' disabled' : ''}`} role="group" aria-label="Letter keyboard">
      {ROWS.map((row) => (
        <div className="kb-row" key={row}>
          {[...row].map((l) => {
            const state = l in guessed ? (guessed[l] ? 'correct' : 'wrong') : pending[l] ? 'pending' : '';
            return (
              <button
                key={l}
                type="button"
                className={`key ${state}`}
                disabled={disabled || l in guessed}
                aria-label={`${l}${state === 'correct' ? ', correct' : state === 'wrong' ? ', wrong' : ''}`}
                onPointerDown={(e) => {
                  // Fire on press for snappy touch input; ignore the follow-up click.
                  if (e.pointerType !== 'mouse' || e.button === 0) {
                    e.preventDefault();
                    onKey(l);
                  }
                }}
                onClick={(e) => {
                  // Keyboard activation (Enter/Space on a focused key) only.
                  if (e.detail === 0) onKey(l);
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
