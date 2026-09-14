"use client";

interface AddPlaceFabProps {
  onClick: () => void;
}

/**
 * כפתור "+" צף ועגול להוספת מקום חדש (סעיף 4 בפרומפט). fixed (לא
 * חלק מזרימת התוכן) כדי שיישאר נגיש **גם** במצב הרגיל וגם במצב Map
 * Explore, מעל ה-Bottom Navigation הקבוע ולא מכוסה על ידו.
 *
 * ממוקם בצד שמאל-תחתית: באפליקציה RTL (dir="rtl") זו הפינה שלא
 * מתנגשת עם כיוון הקריאה/ניווט העיקרי (ימין), בדיוק כמו כפתורי FAB
 * סטנדרטיים באפליקציות RTL אחרות. לא נוגע ב-Bottom Navigation עצמו
 * או באייקונים שלו - רכיב עצמאי לגמרי, מונח מעליו.
 *
 * לחיצה רק פותחת Modal (ר' AddPlaceModal) - לא Bottom Sheet, לא גלילה,
 * לא פתיחת אזור בתוך עמוד הבית (דרישה מפורשת בפרומפט).
 */
export function AddPlaceFab({ onClick }: AddPlaceFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="הוספת מקום חדש"
      title="הוספת מקום חדש"
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-soft transition active:scale-95"
      style={{
        left: "1.25rem",
        bottom: "calc(max(env(safe-area-inset-bottom), 22px) + 78px)",
        background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
