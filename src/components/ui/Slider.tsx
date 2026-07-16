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
        className="rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_4px_12px_rgba(24,119,242,0.25)]"
        aria-live="polite"
      >
        {steps[index]?.label}
      </div>

      <div className="day-trip-slider px-1 py-1.5">
        <input
          type="range"
          dir="ltr"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(steps[Number(e.target.value)].value)}
          className="day-trip-slider__input"
          style={{
            transform: "scaleX(-1)",
            background: `linear-gradient(to right, var(--color-primary-start) ${percent}%, var(--color-bg-secondary) ${percent}%)`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-ink-secondary">
        <span>{steps[0]?.label}</span>
        <span>{steps[steps.length - 1]?.label}</span>
      </div>

      <style jsx>{`
        .day-trip-slider__input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          outline: none;
          box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.1);
          cursor: pointer;
        }
        .day-trip-slider__input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid var(--color-primary-start);
          box-shadow: 0 2px 6px rgba(16, 24, 40, 0.22);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .day-trip-slider__input::-webkit-slider-thumb:hover {
          transform: scale(1.08);
        }
        .day-trip-slider__input::-webkit-slider-thumb:active {
          transform: scale(1.16);
          box-shadow: 0 3px 10px rgba(16, 24, 40, 0.3);
        }
        .day-trip-slider__input::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid var(--color-primary-start);
          box-shadow: 0 2px 6px rgba(16, 24, 40, 0.22);
          cursor: pointer;
        }
        .day-trip-slider__input::-moz-range-track {
          height: 6px;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}