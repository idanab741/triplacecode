import type { ReactNode } from "react";

/** מסגרת "תצוגה מקדימה" אחידה לכל מסכי ה-Onboarding - בדיוק כמו כרטיס
 *  (rounded-card, shadow-soft) שמוכר מכל שאר האפליקציה, רק גדול יותר,
 *  ומכיל בתוכו שחזור מוקטן ונאמן של מסך אמיתי מהאפליקציה. */
export function OnboardingVisual({ children, tint = "var(--color-bg)" }: { children: ReactNode; tint?: string }) {
  return (
    <div
      className="relative w-full max-w-[340px] overflow-hidden rounded-[28px] shadow-soft"
      style={{ background: tint, border: "1px solid rgba(26,26,46,0.06)" }}
    >
      {children}
    </div>
  );
}

/** תגית קטגוריה עגולה עם האייקון האמיתי מ-public/images/categories.
 *  draggable=false + user-select:none - כדי שגרירת-תמונה מובנית של הדפדפן
 *  לא "תיחטף" מתוך מחוות הסוויפ בין מסכי ה-Onboarding. */
export function CategoryDot({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          draggable={false}
          className="h-full w-full select-none object-cover"
          style={{ WebkitUserDrag: "none" } as React.CSSProperties}
        />
      </span>
      <span className="text-[10px] font-medium text-ink">{label}</span>
    </div>
  );
}

/** תמונה אמיתית מ-public/images. draggable=false מונע מהדפדפן להתחיל
 *  גרירת-תמונה מובנית כשמנסים להחליק בין מסכי ה-Onboarding. */
export function RealPhoto({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`h-full w-full select-none object-cover ${className}`}
      style={{ WebkitUserDrag: "none" } as React.CSSProperties}
    />
  );
}

/** placeholder גרפי (לא תמונת סטוק אמיתית) לתמונות יעד שעדיין לא קיימות
 *  בפרויקט (למשל מיקונוס/כרתים/ניו יורק) - מסומן בבירור כ"להחלפה", כדי
 *  שלא יישאר בטעות בגרסת הפרודקשן. */
export function PlaceholderPhoto({
  label,
  emoji,
  from = "var(--color-primary-start)",
  to = "var(--color-primary-end)",
  className = "",
}: {
  label: string;
  emoji: string;
  from?: string;
  to?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center gap-1 text-white ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-[9px] font-bold">{label}</span>
      <span className="absolute inset-x-1 bottom-1 rounded-pill bg-black/25 py-0.5 text-center text-[7px] font-medium leading-none">
        להחלפה בתמונה אמיתית
      </span>
    </div>
  );
}
