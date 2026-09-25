import type { ReactNode } from "react";

/**
 * תמונת הפרופיל על ה-HERO של הפרופיל: עיגול מושלם עם טבעת כחולה דקה ושוליים לבנים סביבה.
 *
 * *** תיקון (בקשה מפורשת - "המסגרת הכחולה יושבת על הפנים... הקאבר נראה מרושל איפה שהוא משיק לה"):
 * הטבעת הייתה חלק מתמונות הרקע (profile-cover-frame / profile-default-hero, ובנוסף שכבת
 * profile-cover-ring מעל הקאבר) - עבה, לא עיגול מושלם, ותמונת הפרופיל ישבה על החלק הפנימי שלה.
 * עכשיו הטבעת מצוירת ב-CSS: עיגול לבן (השוליים) ובתוכו טבעת כחולה דקה ואז התמונה. הקוטר החיצוני
 * (49.6% מרוחב ה-HERO, מרכז 50.08%/69.03%) מכסה בדיוק את הטבעת האפויה בתמונות הרקע, כך שהיא לא
 * נראית, והקצה התחתון של הקאבר נחתך נקי על השוליים הלבנים.
 */
export function ProfileAvatarRing({ children }: { children: ReactNode }) {
  return (
    <span
      className="absolute left-[50.08%] top-[69.03%] box-border aspect-square w-[49.6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-[1.1%] shadow-[0_10px_28px_-10px_rgba(10,60,150,0.45)]"
    >
      <span className="box-border block h-full w-full rounded-full bg-[#0A6DFE] p-[2.6%]">
        <span className="relative box-border block h-full w-full rounded-full border-2 border-white bg-[#0A6DFE]">{children}</span>
      </span>
    </span>
  );
}
