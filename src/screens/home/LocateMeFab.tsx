"use client";

interface LocateMeFabProps {
  onClick: () => void;
}

/**
 * כפתור "מצפן"/מיקום-נוכחי צף (בקשה מפורשת - "כפתור מצפן מעל ה-+
 * שיחזיר למיקום הנוכחי שלי"). אותו מיקום אופקי בדיוק כמו AddPlaceFab
 * (left קבוע), רק גבוה יותר (bottom גדול יותר) כדי לשבת בערימה
 * *מעליו* בדיוק כפי שביקשת. *** תיקון (בקשה מפורשת - "אותו גודל של
 * ה-+"): h-14 w-14 (56px) - זהה במדויק ל-AddPlaceFab, לא h-11 קטן
 * יותר כמו שהיה. סגנון עדיין משני (לבן/outline) - מכוון להיבדל
 * מהכפתור הראשי (+) ויזואלית, בלי "להתחרות" בגרדיאנט שלו.
 */
export function LocateMeFab({ onClick }: LocateMeFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="חזרה למיקום הנוכחי שלי"
      title="חזרה למיקום הנוכחי שלי"
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-soft transition active:scale-95"
      style={{
        left: "1.25rem",
        // מעל AddPlaceFab בדיוק: bottom שלו (78px מעל ה-nav) + הגובה
        // שלו (56px, h-14) + רווח קטן (12px) ביניהם = 78+56+12=146px.
        bottom: "calc(max(env(safe-area-inset-bottom), 22px) + 146px)",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}
