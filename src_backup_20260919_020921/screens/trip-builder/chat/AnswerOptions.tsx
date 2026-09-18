"use client";

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  selected?: string | null;
  onSelect: (value: string) => void;
}

export function AnswerOptions({ options, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`rounded-pill px-4 py-2.5 text-[13.5px] font-medium transition active:scale-95 ${
              isSelected ? "text-white" : "text-ink"
            }`}
            style={{
              background: isSelected
                ? "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))"
                : "#ffffff",
              boxShadow: "0 2px 8px rgba(16,24,40,0.08)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}