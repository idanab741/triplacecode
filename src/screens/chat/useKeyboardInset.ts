"use client";

import { useEffect, useState } from "react";

/**
 * גובה המקלדת (px) שמסתירה את תחתית המסך - 0 כשהמקלדת סגורה.
 * ב-iOS המקלדת לא מקטינה את ה-layout viewport, רק את ה-visual viewport - לכן אלמנט fixed עם bottom
 * "צונח" אל מאחורי המקלדת / זז כשהדפדפן גולל. מחשבים את ההפרש מ-visualViewport וממקמים לפיו.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hidden = document.documentElement.clientHeight - (vv.height + vv.offsetTop);
        // סף קטן - שינויים זעירים (סרגל הכתובת) אינם מקלדת
        setInset(hidden > 80 ? Math.round(hidden) : 0);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
