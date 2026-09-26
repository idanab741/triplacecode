import type { HTMLAttributes, ReactNode } from "react";

interface ScreenProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** האם להשאיר מקום פנוי בתחתית עבור BottomNav הצף. */
  withBottomNavSpacing?: boolean;
  /** תיקון (Home - TripMatch מוטמע): כש-Screen מוטמע בתוך עמוד אחר (לא
   *  תופס את כל המסך בעצמו - למשל TripMatch שמוטמע בתוך Home מתחת ל-
   *  Trip Types), min-h-screen גורם לריווח ריק מיותר/scrollbar כפול.
   *  ברירת המחדל true שומרת על ההתנהגות הקיימת בכל 88+ מקומות השימוש
   *  הנוכחיים ב-Screen - לא משנה שום מסך קיים. */
  fullHeight?: boolean;
}

/** עטיפת מסך אחידה: רקע, ריווח קבוע, ומקום ל-BottomNav הצף אם צריך. */
export function Screen({
  children,
  withBottomNavSpacing = true,
  fullHeight = true,
  className = "",
  ...props
}: ScreenProps) {
  return (
    // *** הוסר שוב (Bug חוזר - "אי אפשר להחליק ימינה ושמאלה בשורת סוגי
    // הטיול"): overflow-x-hidden שנוסף כאן ברמת ה-div (בניסיון ליצור
    // רשת ביטחון נגד זליגה אופקית) שבר בפועל את הגלילה האופקית
    // הלגיטימית של שורת הקטגוריות (HomeQuickCategories) - בדיוק אותה
    // תופעה שכבר תועדה ב-globals.css לגבי overflow-x:hidden על html,
    // רק שכאן זה קרה גם ברמת container רגיל (לא רק html/body). הוסר -
    // התיקון האמיתי לזליגה נשאר רק ב-CARD_BOX_STYLE (tripmatch/page.tsx),
    // בלי overflow-x-hidden גורף שפוגע בגלילה תקינה.
    <div
      className={`${fullHeight ? "min-h-screen" : ""} bg-bg-secondary px-5 pt-[calc(var(--sat)+2rem)] ${
        withBottomNavSpacing ? "pb-28" : "pb-8"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
