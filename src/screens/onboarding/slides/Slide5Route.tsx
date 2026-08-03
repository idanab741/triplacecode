import { OnboardingVisual, RealPhoto } from "./OnboardingVisual";
import { OnboardingRealScreenLink } from "../OnboardingRealScreenLink";

const DAY_COLORS = ["#4F7DF3", "#8B5CF6", "#0EA5A4"];

/** מסך 5: איך בונים, שומרים ומנהלים מסלולים - שחזור מסך תוצאת מסלול
 *  (באנר המפה/מסלול האמיתי מ-day-trip result) יחד עם קטע "הטיולים שלי". */
export function Slide5Route() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-7 px-6">
      <OnboardingRealScreenLink href="/trip-builder/day-trip/result">
      <OnboardingVisual>
        <div className="p-4">
          <div className="relative h-28 w-full overflow-hidden rounded-card">
            <RealPhoto src="/images/hero-day-trip-result.png" alt="מסלול טיול יומי" />
            <div className="pointer-events-none absolute inset-0">
              {[
                { x: "16%", y: "70%", c: DAY_COLORS[0] },
                { x: "50%", y: "45%", c: DAY_COLORS[1] },
                { x: "82%", y: "25%", c: DAY_COLORS[2] },
              ].map((p, i) => (
                <span
                  key={i}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-soft"
                  style={{ left: p.x, top: p.y, background: p.c }}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2.5 rounded-card bg-white p-2.5 shadow-soft">
            <span className="text-ink-secondary/60">⠿</span>
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
              <RealPhoto src="/images/categories/cat-daytrip.png" alt="לינה" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-ink">מלון הכרמל</p>
              <p className="truncate text-[10.5px] text-ink-secondary">לינה · ₪₪₪</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink">הטיולים שלי</p>
            <span className="text-[11px] font-medium text-accent">לכל הטיולים</span>
          </div>
          <div className="mt-2 flex gap-2.5">
            <div className="flex-1 overflow-hidden rounded-card bg-white shadow-soft">
              <div className="h-12 w-full overflow-hidden">
                <RealPhoto src="/images/hero-weekend.png" alt="סופ״ש באילת" />
              </div>
              <div className="p-1.5">
                <p className="truncate text-[10.5px] font-bold text-ink">סופ&quot;ש באילת</p>
                <p className="text-[9px] text-ink-secondary">4 תחנות</p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-card bg-white shadow-soft">
              <div className="h-12 w-full overflow-hidden">
                <RealPhoto src="/images/destination/crete.png" alt="כרתים" />
              </div>
              <div className="p-1.5">
                <p className="truncate text-[10.5px] font-bold text-ink">הטיול לכרתים</p>
                <p className="text-[9px] text-ink-secondary">6 תחנות</p>
              </div>
            </div>
          </div>
        </div>
      </OnboardingVisual>
      </OnboardingRealScreenLink>

      <div className="relative z-10 flex flex-col gap-2 text-center">
        <h1 className="text-[26px] font-bold leading-tight text-ink">בונים, שומרים ומנהלים את הטיולים שלכם</h1>
        <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-ink-secondary">
          מסלול עם מפה ותחנות מסודרות לפי ימים, וכל הטיולים שלכם שמורים במקום אחד.
        </p>
      </div>
    </div>
  );
}
