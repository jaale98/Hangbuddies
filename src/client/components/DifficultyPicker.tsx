import { BALLOONS, DIFFICULTIES } from '../../shared/constants';
import type { Difficulty } from '../../shared/types';

const INFO: Record<Difficulty, string> = {
  easy: 'Familiar words',
  medium: 'Phrases & clever clues',
  hard: 'Idioms & brain-benders',
};

interface Props {
  value: Difficulty;
  onChange?: (d: Difficulty) => void; // omit for read-only (non-hosts)
}

export function DifficultyPicker({ value, onChange }: Props) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          className={value === d ? 'active' : ''}
          disabled={!onChange}
          onClick={() => onChange?.(d)}
        >
          <strong>{d[0].toUpperCase() + d.slice(1)}</strong>
          <span>{'🎈'.repeat(BALLOONS[d])}</span>
          <small>{INFO[d]}</small>
        </button>
      ))}
    </div>
  );
}
