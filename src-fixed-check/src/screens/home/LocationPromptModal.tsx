"use client";

import { PopupCard, PopupOverlay } from "@/components/ui";

interface LocationPromptModalProps {
  /** תווית המיקום הנוכחי כפי שהוא כבר מוצג באזור המיקום שבעמוד הבית
   *  (HomeHeader) - לא ממציאים תצוגה חדשה, רק מציגים כאן את אותו הערך. */
  currentLocationLabel: string;
  onClose: () => void;
  /** פותח את מנגנון בחירת/חיפוש המיקום הקיים (ChooseLocationSheet) -
   *  ה-Popup הזה לא מכיל שום לוגיקת חיפוש משלו. */
  onSearchDestination: () => void;
}

/** אייקון פין - זהה לזה שכבר קיים ב-ChooseLocationSheet/AddressRow (עקביות ויזואלית). */
function PinIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
}

/** אייקון וי - מסמן שהמיקום הנוכחי הוא זה שנבחר/פעיל כרגע. */
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** אייקון חיפוש - לשורת "חיפוש יעד". */
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

/**
 * *** Popup חדש (בקשה מפורשת - "שינוי מיקום"): נפתח מלחיצה על אזור
 * המיקום ב-HomeHeader, *לפני* פתיחת ChooseLocationSheet הקיים - לא
 * במקומו. המטרה: רגע קצר וממותג ("איפה הטיול הבא שלך?") שנותן למשתמש
 * שתי אפשרויות ברורות - להישאר עם המיקום הנוכחי (שכבר מוצג בעמוד,
 * לא "פופאפ הרשאת מיקום"), או ללחוץ "חיפוש יעד" שמפעיל את מנגנון
 * בחירת/חיפוש המיקום הקיים (ChooseLocationSheet) - שום לוגיקת חיפוש
 * כפולה לא נוצרה כאן.
 *
 * אותו מארז עיצובי בדיוק כמו הפופאפ "נגמרו הטריפים" (PopupCard/
 * PopupOverlay ב-components/ui) - כדי ששני ה-Popups ירגישו כמו חלק
 * מאותה מערכת עיצוב, כשההבדל היחיד הוא תמונת הקמע (כאן: Trippy עם
 * עיניים בצורת לב, trippy-location-hearts.png) והתוכן הספציפי.
 */
export function LocationPromptModal({ currentLocationLabel, onClose, onSearchDestination }: LocationPromptModalProps) {
  return (
    <PopupOverlay onClose={onClose}>
      <PopupCard onClose={onClose} imageSrc="/images/trippy-location-hearts.png" imageAlt="Trippy">
        <div>
          <h2 className="text-lg font-bold text-ink">איפה הטיול הבא שלך?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">בחר יעד כדי לגלות מקומות וחוויות באזור.</p>
        </div>

        {/* המיקום הנוכחי - תצוגה בלבד (אותו ערך שכבר מוצג ב-HomeHeader), עם וי שמסמן שזה הפעיל כרגע. */}
        <div className="flex items-center gap-3 rounded-2xl border border-ink-secondary/10 bg-bg-secondary/70 px-4 py-3.5 text-right">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            <PinIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-ink-secondary">המיקום שנבחר כרגע</span>
            <span className="block truncate text-sm font-semibold text-ink">{currentLocationLabel}</span>
          </span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "var(--color-primary-start)" }}>
            <CheckIcon />
          </span>
        </div>

        {/* בחירת יעד אחר - מפעיל את ChooseLocationSheet הקיים, לא חיפוש חדש. */}
        <button
          type="button"
          onClick={onSearchDestination}
          className="flex items-center gap-3 rounded-2xl border border-ink-secondary/10 px-4 py-3.5 text-right transition active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-ink-secondary">
            <SearchIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">חיפוש יעד</span>
            <span className="block text-[12px] text-ink-secondary">חפש עיר או מקום אחר</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-pill px-6 py-3 text-sm font-semibold text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          המשך עם המיקום הנוכחי
        </button>
      </PopupCard>
    </PopupOverlay>
  );
}
