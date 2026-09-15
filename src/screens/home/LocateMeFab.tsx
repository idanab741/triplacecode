"use client";

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
 */
export function LocateMeFab({ onClick, pushedUp }: LocateMeFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="חזרה למיקום הנוכחי שלי"
      title="חזרה למיקום הנוכחי שלי"
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-[bottom,transform] duration-200 ease-out active:scale-95"
      style={{
        left: "1.25rem",
        // סגור: 78 (בסיס +) + 52 (גובה +) + 16 (רווח נוח) = 146px.
        // פתוח: + 44+10+44 (שני עיגולי הפעולה + רווחים) = 250px.
        bottom: pushedUp
          ? "calc(max(env(safe-area-inset-bottom), 22px) + 250px)"
          : "calc(max(env(safe-area-inset-bottom), 22px) + 146px)",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}
