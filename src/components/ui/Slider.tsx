interface SliderStep {
  value: string;
  label: string;
}

interface SliderProps {
  steps: SliderStep[];
  value: string;
  onChange: (value: string) => void;
}

/** סליידר עם שלבים בדידים ומתויגים (למשל: מרחק, תקציב). */
export function Slider({ steps, value, onChange }: SliderProps) {
  const index = Math.max(0, steps.findIndex((step) => step.value === value));
  const percent = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-4 py-2 text-center text-sm font-semibold text-white"
        aria-live="polite"
      >
        {steps[index]?.label}
      </div>
      <input
        type="range"
        dir="ltr"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(steps[Number(e.target.value)].value)}
        className="h-2 w-full appearance-none rounded-pill bg-bg-secondary accent-accent"
        style={{
          transform: "scaleX(-1)",
          background: `linear-gradient(to right, var(--color-primary-start) ${percent}%, var(--color-bg-secondary) ${percent}%)`,
        }}
      />
      <div className="flex justify-between text-xs text-ink-secondary">
        <span>{steps[0]?.label}</span>
        <span>{steps[steps.length - 1]?.label}</span>
      </div>
    </div>
  );
}