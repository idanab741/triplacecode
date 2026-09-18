"use client";

import { useEffect, useState } from "react";

interface SimpleLoadingDotsProps {
  steps: string[];
}

/** *** תיקון (בקשה מפורשת - "למה הוא ישר מעביר למשחק!?!!?!?! לא ביקשתי
 *  את זה!!!"): LoadingGame היה שימוש שגוי - זה משחק ריצה אינטראקטיבי
 *  מלא (עם קפיצות/מכשולים/ניקוד), בנוי לזמן המתנה ארוך (~90 שניות) של
 *  "חופשה בחו"ל", ומרנדר גם MainBottomNav משלו (כפילות עם הבר שכבר
 *  בעמוד הזה!). מה שהמשתמש באמת ביקש - "שלוש נקודות" + טקסט מתחלף -
 *  זה בדיוק מה שהרכיב הקטן הזה עושה, בלי שום דבר אינטראקטיבי. */
export function SimpleLoadingDots({ steps }: SimpleLoadingDotsProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const interval = setInterval(() => setStepIndex((i) => (i + 1) % steps.length), 2200);
    return () => clearInterval(interval);
  }, [steps]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-white p-8 text-center shadow-soft">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-accent" />
      </div>
      <p className="text-sm font-medium text-ink-secondary">{steps[stepIndex]}</p>
    </div>
  );
}
