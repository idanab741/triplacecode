import { Chip } from "./Chip";

interface ChipOption {
  value: string;
  label: string;
  emoji?: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/** קבוצת צ'יפים לבחירה מרובה, עוטפת את Chip ומנהלת את מערך הבחירות. */
export function ChipGroup({ options, selected, onChange }: ChipGroupProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option.value} selected={selected.includes(option.value)} onClick={() => toggle(option.value)}>
          {option.emoji && <span className="me-1">{option.emoji}</span>}
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
