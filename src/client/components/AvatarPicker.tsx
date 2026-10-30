import { AVATARS } from '../../shared/avatars';
import { StickFigure } from './StickFigure';

interface Props {
  value: string;
  taken: string[];
  onChange: (id: string) => void;
}

export function AvatarPicker({ value, taken, onChange }: Props) {
  return (
    <div className="avatar-grid" role="radiogroup" aria-label="Pick your buddy">
      {AVATARS.map((a) => {
        const isTaken = taken.includes(a.id) && a.id !== value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={a.id === value}
            className={`avatar-option${a.id === value ? ' selected' : ''}`}
            disabled={isTaken}
            onClick={() => onChange(a.id)}
            title={isTaken ? `${a.label} (taken)` : a.label}
          >
            <StickFigure avatarId={a.id} size={52} pose={a.id === value ? 'wave' : 'stand'} />
            <span className="avatar-label">{isTaken ? 'Taken' : a.label}</span>
          </button>
        );
      })}
    </div>
  );
}
