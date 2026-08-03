import { OnboardingRealScreenLink } from "../OnboardingRealScreenLink";

/** מסך 2: עמוד הפרופיל - ומשם מגיעים ל"התאמות אישיות" (ההעדפות), כדי
 *  לקבל המלצות מדויקות יותר בכל האפליקציה. שחזור מדויק של מבנה הפרופיל
 *  האמיתי: תמונת hero-profile-setup.png בגודל המלא שלה (לא חתוכה), עם
 *  עיגול האווטאר במיקום המדויק שהאפליקציה האמיתית משתמשת בו
 *  (left:49.73%, top:69.28%, width:42% - בדיוק כמו ב-src/app/profile/page.tsx),
 *  תמונת פרופיל גנרית (לא אימוג'י) ושם לדוגמה, והכפתור "התאמות אישיות"
 *  האמיתי מודגש כדי להסביר למשתמש לאן ללחוץ. */
export function Slide2Profile() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-7 px-6">
      <OnboardingRealScreenLink href="/profile">
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-[28px] shadow-soft" style={{ border: "1px solid rgba(26,26,46,0.06)" }}>
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-profile-setup.png"
            alt="הפרופיל שלי"
            draggable={false}
            className="block h-auto w-full select-none"
          />
          <div
            className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-white bg-bg-secondary shadow-soft"
            style={{ left: "49.73%", top: "69.28%", width: "38%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/avatar-placeholder.png" alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 px-5 pb-5 pt-3 text-center">
          <p className="text-[15px] font-bold text-ink">ישראל ישראלי</p>

          <div className="flex w-full items-center justify-between rounded-card border-2 border-[var(--color-primary-start)] bg-white px-4 py-3 shadow-soft">
            <div className="text-start">
              <p className="text-[12.5px] font-bold text-ink">התאמות אישיות</p>
              <p className="text-[10.5px] text-ink-secondary">ענו על כמה שאלות קצרות וקבלו המלצות מדויקות יותר</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-start)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </div>

          <div className="flex w-full items-center justify-between rounded-card bg-white px-4 py-3 shadow-soft opacity-60">
            <span className="text-[12.5px] font-bold text-ink">הטיולים השמורים שלי</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </div>
        </div>
      </div>
      </OnboardingRealScreenLink>

      <div className="relative z-10 flex flex-col gap-2 text-center">
        <h1 className="text-[26px] font-bold leading-tight text-ink">קבלו התאמות מדויקות יותר</h1>
        <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-ink-secondary">
          דרך הפרופיל אפשר למלא "התאמות אישיות" - וכל ההמלצות באפליקציה יתאימו בדיוק לטעם שלכם.
        </p>
      </div>
    </div>
  );
}
