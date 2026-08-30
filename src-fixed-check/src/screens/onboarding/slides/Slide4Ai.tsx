import { OnboardingVisual, RealPhoto } from "./OnboardingVisual";

const OPTIONS = ["טיול בארץ", "חופשה בחו\"ל", "סופ\"ש זוגי"];

/** מסך 2: איך טריפי ה-AI חוסך זמן ובונה מסלול אישי - שחזור של מסך הצ'אט
 *  האמיתי (ChatHeader עם פס התקדמות ואווטאר טריפי האמיתי, בועת צ'אט, צ'יפים). */
export function Slide4Ai() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-start gap-7 px-6 pt-6">
      <OnboardingVisual>
        <div className="flex items-center gap-2.5 border-b border-ink-secondary/10 px-4 pt-3 pb-2.5">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
            <RealPhoto src="/images/tripy.png" alt="טריפי" />
          </span>
          <p className="flex-1 text-[13.5px] font-bold text-ink">טריפי AI</p>
          <span className="text-[11px] font-medium text-ink-secondary">3 מתוך 6</span>
        </div>
        <div className="h-1 w-full bg-ink-secondary/10">
          <div
            className="h-full w-1/2 rounded-l-full"
            style={{ background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))" }}
          />
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex justify-start">
            <div
              className="max-w-[85%] bg-white px-3.5 py-2.5 shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
              style={{ borderRadius: "18px", borderBottomRightRadius: "5px" }}
            >
              <p className="text-[13px] leading-6 text-ink">מה בא לכם לעשות הפעם? 😊</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-start gap-2">
            {OPTIONS.map((opt, i) => (
              <span
                key={opt}
                className="rounded-pill px-3 py-2 text-[12px] font-medium"
                style={
                  i === 0
                    ? {
                        background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(24,119,242,0.28)",
                      }
                    : { background: "#ffffff", color: "var(--color-ink)", boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }
                }
              >
                {opt}
              </span>
            ))}
          </div>

          <div className="flex justify-start">
            <div
              className="bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
              style={{ borderRadius: "18px", borderBottomRightRadius: "5px" }}
            >
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-secondary/50" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-secondary/50 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-secondary/50 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        </div>
      </OnboardingVisual>

      <div className="relative z-10 flex flex-col gap-2 text-center">
        <h1 className="text-[26px] font-bold leading-tight text-ink">טריפי ה-AI בונה לכם מסלול אישי</h1>
        <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-ink-secondary">
          עונים על כמה שאלות קצרות, וטריפי מרכיב עבורכם טיול מותאם אישית תוך דקות.
        </p>
      </div>
    </div>
  );
}
