interface StepperProps {
  current: number;
  total: number;
  label?: string;
}

/** סרגל התקדמות עם "שלב X מתוך Y" - לשימוש באשפים מרובי-שלבים. */
export function Stepper({ current, total, label }: StepperProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-secondary">
        <div
          className="h-full rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-center text-xs text-ink-secondary">
        שלב {current} מתוך {total}
        {label ? ` · ${label}` : ""}
      </p>
    </div>
  );
}
