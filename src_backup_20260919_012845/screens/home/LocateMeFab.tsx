"use client";

import { useState } from "react";

interface LocateMeFabProps {
  onClick: () => void;
  /** true רק כש-MapActionsFab פתוח (בקשה מפורשת - "הרווח בין המצפן
   *  ל-+ צריך להיות רק אחרי שלוחצים על הפלוס"): בברירת מחדל (סגור)
   *  המצפן צמוד רגיל מעל ה-+ (146px), ורק כשנפתח קופץ גבוה יותר
   *  (250px) כדי לא להתנגש עם שני עיגולי הפעולה שנחשפים. */
  pushedUp: boolean;
}

/**
 * כפתור "מצפן"/מיקום-נוכחי צף (בקשה מפורשת - "כפתור מצפן מעל ה-+
 * שיחזיר למיקום הנוכחי שלי"). אותו מיקום אופקי בדיוק כמו MapActionsFab
 * (left קבוע). h-14 w-14 (56px) - זהה במדויק לגודל ה-+. סגנון משני
 * (לבן/outline) - מכוון להיבדל מהכפתור הראשי (+) ויזואלית.
 *
 * *** תיקון (בקשה מפורשת - "הכפתור אפילו לא לחיץ!!"): שני שינויים
 * שלא היו קשורים ללוגיקה הפנימית (שכבר תוקנה) - (1) zIndex מפורש
 * וגבוה מאוד (9999, לא רק class z-40) כדי לחסל כל אפשרות של אלמנט
 * אחר שמכסה אותו בשקט; (2) פידבק חזותי מיידי בלחיצה (טבעת פועמת),
 * שקורה *תמיד* ברגע שהאירוע נלחץ, בלי שום תלות ב-geolocation - אם
 * אתה רואה את הטבעת, המגע נקלט בוודאות (זה מבודד את השאלה "האם
 * הלחיצה בכלל מגיעה" מ"האם המפה זזה בגלל בעיית מיקום/GPS").
 */
export function LocateMeFab({ onClick, pushedUp }: LocateMeFabProps) {
  const [tapped, setTapped] = useState(false);

  function handleClick() {
    setTapped(true);
    setTimeout(() => setTapped(false), 400);
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="חזרה למיקום הנוכחי שלי"
      title="חזרה למיקום הנוכחי שלי"
      className="fixed flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-[bottom,transform] duration-200 ease-out active:scale-95"
      style={{
        left: "1.25rem",
        zIndex: 9999,
        pointerEvents: "auto",
        // סגור: 78 (בסיס +) + 52 (גובה +) + 16 (רווח נוח) = 146px.
        // פתוח: + 44+10+44 (שני עיגולי הפעולה + רווחים) = 250px.
        bottom: pushedUp
          ? "calc(max(env(safe-area-inset-bottom), 22px) + 250px)"
          : "calc(max(env(safe-area-inset-bottom), 22px) + 146px)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full transition-all duration-500 ease-out"
        style={{
          border: "2px solid var(--color-primary-start)",
          opacity: tapped ? 1 : 0,
          transform: tapped ? "scale(1)" : "scale(1.6)",
        }}
      />
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* *** תיקון (בקשה מפורשת - "אני רוצה את המצפן במקום האייקון
            הזה"): מחליף את אייקון ה-crosshair (עיגול+4 קווים) באייקון
            מצפן אמיתי - עיגול עם מחט/יהלום מסתובב, אותו path הסטנדרטי
            של אייקון "compass" (Feather Icons). */}
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    </button>
  );
}
