"use client";

import { OnboardingVisual, RealPhoto } from "./OnboardingVisual";

/** מסך 3: TripMatch - איך מגלים מקומות מדויקים בהחלקה. כפתורי הפעולה
 *  מתחת לכרטיס (לא מעליו) בדיוק כמו ב-SwipeCard.tsx האמיתי: לייק (❤️)
 *  בצד ימין, איקס (❌) בצד שמאל. כולל הדגמה ויזואלית של מחוות ההחלקה
 *  עצמה (יד + חצים) על גבי הכרטיס, כדי שהמשתמש יבין מיד איך זה עובד. */
export function Slide3TripMatch() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-start gap-7 px-6 pt-6">
      <OnboardingVisual>
        <div className="p-4">
          <div className="relative overflow-hidden rounded-3xl bg-white shadow-lg">
            <div className="relative h-32 w-full">
              <RealPhoto src="/images/destination/newyork.png" alt="ניו יורק" />

              {/* הדגמת ההחלקה עצמה - יד + חצים משני הצדדים */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="onboarding-swipe-hand flex flex-col items-center gap-1">
                  <span className="text-3xl drop-shadow">👆</span>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-6 top-1/2 flex -translate-y-1/2 items-center justify-between">
                <span className="onboarding-swipe-arrow-right text-xl text-white drop-shadow">←</span>
                <span className="onboarding-swipe-arrow-left text-xl text-white drop-shadow">→</span>
              </div>
            </div>
            <div className="p-3">
              <p className="text-[10.5px] font-medium text-ink-secondary">אטרקציות</p>
              <p className="text-[13.5px] font-bold text-ink">ניו יורק, ארה״ב</p>
              <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ink-secondary">
                <span>⭐ 4.9</span>
                <span>₪₪₪</span>
              </div>
            </div>
          </div>

          {/* כפתורי פעולה מתחת לכרטיס - זהה למבנה ב-SwipeCard.tsx האמיתי.
              לייק ראשון ב-DOM => צד ימין ב-RTL, איקס שני => צד שמאל. */}
          <div className="mt-4 flex items-center justify-center gap-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-soft" style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}>
              ❤️
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-xl shadow-soft">
              ❌
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="h-16 overflow-hidden rounded-card">
                <RealPhoto src="/images/hero-restaurants-cafes.png" alt="מסעדות וקפה" />
              </div>
              <p className="truncate text-[11px] font-semibold text-ink">מסעדת שף הבית</p>
              <p className="truncate text-[10px] text-ink-secondary">מסעדות · תל אביב</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-16 overflow-hidden rounded-card">
                <RealPhoto src="/images/hero-weekend.png" alt="סופ״ש" />
              </div>
              <p className="truncate text-[11px] font-semibold text-ink">סוף שבוע בצפון</p>
              <p className="truncate text-[10px] text-ink-secondary">מלונות · צפון</p>
            </div>
          </div>
        </div>
      </OnboardingVisual>

      <div className="relative z-10 flex flex-col gap-2 text-center">
        <h1 className="text-[26px] font-bold leading-tight text-ink">מגלים מקומות שמתאימים בדיוק לכם</h1>
        <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-ink-secondary">
          החליקו על מקומות ב-TripMatch, או חפשו וסננו לפי קטגוריה, דירוג ומחיר.
        </p>
      </div>

      <style jsx global>{`
        @keyframes onboarding-swipe-hand-move {
          0%, 15% { transform: translateX(28px); opacity: 0; }
          25% { opacity: 1; }
          50% { transform: translateX(-28px); opacity: 1; }
          65%, 100% { transform: translateX(-28px); opacity: 0; }
        }
        .onboarding-swipe-hand {
          animation: onboarding-swipe-hand-move 2.4s ease-in-out infinite;
        }
        @keyframes onboarding-swipe-arrow-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.9; }
        }
        .onboarding-swipe-arrow-right {
          animation: onboarding-swipe-arrow-pulse 2.4s ease-in-out infinite;
        }
        .onboarding-swipe-arrow-left {
          animation: onboarding-swipe-arrow-pulse 2.4s ease-in-out infinite;
          animation-delay: 1.2s;
        }
      `}</style>
    </div>
  );
}
