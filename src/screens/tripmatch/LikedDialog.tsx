"use client";

interface LikedDialogProps {
  placeName: string;
  onContinue: () => void;
  onViewPlace: () => void;
}

/** Dialog במרכז המסך אחרי Like - לא מעבר אוטומטי. "כן" ממשיך להחליק,
 *  "לא" עובר לעמוד האטרקציה. */
export function LikedDialog({ placeName, onContinue, onViewPlace }: LikedDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-soft">
        <p className="text-lg font-bold text-ink">❤️ {placeName} נוסף למועדפים</p>
        <p className="mt-1.5 text-[13.5px] text-ink-secondary">האם תרצו להמשיך להחליק?</p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onViewPlace}
            className="flex-1 rounded-pill bg-bg-secondary py-3 text-sm font-semibold text-ink"
          >
            לא, הצג לי
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 rounded-pill py-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            כן, המשך
          </button>
        </div>
      </div>
    </div>
  );
}
