"use client";

import { useEffect } from "react";

/** צבע קצה העליון של גרדיאנט הבר התכלת של עמוד הבית (#3FCBFD -> #007CFE,
 *  זווית 150deg) - ממוצע של השורה העליונה, כדי שסרגל הסטטוס יתמזג איתו. */
const HOME_TINT = "#ffffff"; // *** הבר שקוף עכשיו - סרגל הסטטוס בצבע רקע העמוד (--color-bg)
/** place's (כל מי שמעביר את הסגול הישן) - רקע העמוד של place's (--color-places-bg). */
const LEGACY_PURPLE = "#7c3aed";
const PLACES_BG = "#ffffff"; // place's: רקע העמוד לבן

/** כמה px מלמעלה נצבעים בתכלת ברקע ה-html (מספיק כדי לכסות את אזור
 *  ה-safe-area העליון של האייפון, ~59px, וגם משיכת-יתר כלפי מטה). */
const TINT_STRIP_PX = 140;

/**
 * *** חדש (בקשה מפורשת - "למה החלק העליון לבן? שהכל ימשיך בקו העיצובי"):
 * באייפון אזור סרגל הסטטוס (שעה/סוללה) נמצא *מעל* תחילת העמוד, ואף אחד
 * לא צבע אותו - לכן הוא נראה לבן/אפור בהיר, עם הבר התכלת מתחתיו.
 * הרכיב הזה (לעמוד הבית בלבד) צובע אותו בתכלת בשתי דרכים:
 *  1) meta theme-color - Safari (וכרום באנדרואיד) צובעים לפיו את סרגל הסטטוס.
 *  2) רקע ה-html: פס תכלת בראש הקנבס - גרסאות iOS חדשות של Safari דוגמות
 *     את צבע הסרגל מהרקע שבראש הדף במקום מ-theme-color.
 * בעזיבת העמוד הכל חוזר בדיוק למצב הקודם, כך שעמודים אחרים (עם רקע בהיר)
 * לא מושפעים.
 * לא משנה כלום ב-DOM הנראה של העמוד עצמו.
 */
interface HomeStatusBarTintProps {
  /** צבע הצביעה (ברירת מחדל: תכלת של הבית). place's מעביר את הסגול שלו. */
  color?: string;
  /** true - כל הרקע מאחורי העמוד (html + body) בצבע הזה, ולא רק פס בראש. כך גם משיכת-יתר (הקפיצה בקצוות)
   *  נראית באותו צבע. משמש את place's (לבן מלא). */
  solidBackground?: boolean;
}

export function HomeStatusBarTint({ color: requestedColor = HOME_TINT, solidBackground = false }: HomeStatusBarTintProps = {}) {
  const color = requestedColor.toLowerCase() === LEGACY_PURPLE ? PLACES_BG : requestedColor;
  useEffect(() => {
    // 1) theme-color
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const createdMeta = !meta;
    const previousContent = meta?.getAttribute("content") ?? null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);

    // 2) פס תכלת ברקע ה-html
    const root = document.documentElement;
    const prev = {
      backgroundColor: root.style.backgroundColor,
      backgroundImage: root.style.backgroundImage,
      backgroundRepeat: root.style.backgroundRepeat,
    };
    const body = document.body;
    const prevBodyBackground = body.style.backgroundColor;
    root.style.backgroundColor = solidBackground ? color : "var(--color-bg-secondary)";
    if (solidBackground) body.style.backgroundColor = color;
    root.style.backgroundImage = `linear-gradient(to bottom, ${color} 0px, ${color} ${TINT_STRIP_PX}px, transparent ${TINT_STRIP_PX}px)`;
    root.style.backgroundRepeat = "no-repeat";

    return () => {
      if (createdMeta) meta?.remove();
      else if (previousContent != null) meta?.setAttribute("content", previousContent);
      else meta?.removeAttribute("content");

      root.style.backgroundColor = prev.backgroundColor;
      root.style.backgroundImage = prev.backgroundImage;
      root.style.backgroundRepeat = prev.backgroundRepeat;
      if (solidBackground) body.style.backgroundColor = prevBodyBackground;
    };
  }, [color, solidBackground]);

  return null;
}
