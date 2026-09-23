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
    // *** תוסף (בקשה מפורשת - "הדף לא יזלוג החוצה"): overflow-x-hidden
    // כאן ברמת ה-div (לא ב-html/body - ר' globals.css, שם זה הוסר
    // בכוונה כי זה שבר גלילה אופקית פנימית ב-iOS Safari) הוא רשת
    // ביטחון ממוקדת: כל עמוד שמשתמש ב-Screen (88+ מקומות) מוגן
    // מחריגה אופקית של תוכן פנימי, בלי לגעת ברכיב הגלילה הראשי של
    // המסמך - כך שגלילה אופקית לגיטימית בתוך קונטיינר מקונן (למשל
    // שורת הקטגוריות, שיש לה overflow-x-auto + touch-action:pan-x
    // מפורשים משלה) ממשיכה לעבוד כרגיל.
    <div
      className={`${fullHeight ? "min-h-screen" : ""} overflow-x-hidden bg-bg-secondary px-5 pt-8 ${
        withBottomNavSpacing ? "pb-28" : "pb-8"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
