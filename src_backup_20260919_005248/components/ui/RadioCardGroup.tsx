interface RadioCardOption {
  value: string;
  label: string;
  emoji?: string;
}

interface RadioCardGroupProps {
  options: RadioCardOption[];
  value: string | null;
  onChange: (value: string) => void;
}

/** רשימת כרטיסים לבחירה יחידה (למשל: עם מי נוסעים, משך הטיול). */
export function RadioCardGroup({ options, value, onChange }: RadioCardGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-3 rounded-card border px-4 py-3 text-start text-sm font-medium transition-colors ${
              isSelected
                ? "border-transparent bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
                : "border-ink-secondary/15 bg-bg-secondary text-ink"
            }`}
          >
            {option.emoji && <span className="text-lg">{option.emoji}</span>}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
