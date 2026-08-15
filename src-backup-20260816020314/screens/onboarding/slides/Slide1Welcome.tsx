import { OnboardingVisual, CategoryDot, RealPhoto } from "./OnboardingVisual";

const CATEGORIES = [
  { src: "/images/categories/cat-abroad.png", label: "חו\"ל" },
  { src: "/images/categories/cat-daytrip.png", label: "טיול יומי" },
  { src: "/images/categories/cat-nature.png", label: "טבע" },
  { src: "/images/categories/cat-restaurants.png", label: "מסעדות" },
  { src: "/images/categories/cat-romantic.png", label: "רומנטי" },
];

/** מסך 1: מהי TRIPLACE - שחזור נאמן של מסך הבית (Hero, ברכה, חיפוש, קטגוריות מהירות).
 *  בלי כותרת עליונה (אין "המיקום שלי"/עיגולי אווטאר-פעמון) - נשארים ישר עם ה-Hero. */
export function Slide1Welcome() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-7 px-6">
      <OnboardingVisual tint="#e5e6f4">
        <div className="px-7 pt-5">
          <RealPhoto src="/images/home-hero.png" alt="TRIPLACE - AI Powered by" />
        </div>

        <div className="-mt-0 rounded-t-[26px] bg-bg px-4 pb-5 pt-4 text-center">
          <p className="text-lg font-bold text-ink">בוקר טוב!</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink-secondary">הטיול הבא שלך מתחיל כאן</p>

          <div className="mt-3 flex items-center gap-2 rounded-pill border border-ink-secondary/15 bg-white px-3 py-2.5 text-right text-[13px] text-ink-secondary shadow-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            מה תרצו לעשות היום?
          </div>

          <div className="mt-4 flex justify-between gap-1.5">
            {CATEGORIES.map((c) => (
              <CategoryDot key={c.label} {...c} />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="h-16 overflow-hidden rounded-card">
              <RealPhoto src="/images/destination/imgaebarcelona.png" alt="ברצלונה" />
            </div>
            <div className="h-16 overflow-hidden rounded-card">
              <RealPhoto src="/images/destination/mykonos.png" alt="מיקונוס" />
            </div>
          </div>
        </div>
      </OnboardingVisual>

      <div className="relative z-10 flex flex-col gap-2 text-center">
        <h1 className="text-[26px] font-bold leading-tight text-ink">ברוכים הבאים ל-TRIPLACE</h1>
        <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-ink-secondary">
          כל טיול שחלמתם עליו - במקום אחד. מהרעיון הראשוני ועד המסלול המושלם.
        </p>
      </div>
    </div>
  );
}
