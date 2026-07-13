interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

/** מתג כן/לא. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="flex items-center justify-between gap-4">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${
          checked
            ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))]"
            : "bg-bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-all ${
            checked ? "end-0.5" : "start-0.5"
          }`}
        />
      </button>
    </label>
  );
}
