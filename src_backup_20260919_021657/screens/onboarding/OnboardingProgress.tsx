interface OnboardingProgressProps {
  /** אינדקס המסך הנוכחי, מתחיל מ-0. */
  current: number;
  total: number;
}

/** אינדיקטור התקדמות - עד 5 פסים דקים, נמלאים בגרדיאנט המותג עד המסך הנוכחי (כולל).
 *  אותה שפה ויזואלית כמו פס ההתקדמות ב-ChatHeader של טריפי AI. */
export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-ink-secondary/15">
          <div
            className="h-full rounded-pill transition-all duration-500 ease-out"
            style={{
              width: i <= current ? "100%" : "0%",
              background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))",
            }}
          />
        </div>
      ))}
    </div>
  );
}
