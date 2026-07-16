"use client";

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  onSelect: (value: string) => void;
}

export function AnswerOptions({ options, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className="rounded-pill px-4 py-2.5 text-[13.5px] font-medium text-ink transition active:scale-95"
          style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
