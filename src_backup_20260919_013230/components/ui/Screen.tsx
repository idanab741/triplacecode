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
    <div
      className={`${fullHeight ? "min-h-screen" : ""} bg-bg-secondary px-5 pt-8 ${
        withBottomNavSpacing ? "pb-28" : "pb-8"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
