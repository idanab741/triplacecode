import type { ReactNode, CSSProperties } from "react";
import type { PlaceCommunityStats } from "@/services/places/placeCommunityStatsService";

interface PlaceCommunityStatsSectionProps {
  stats: PlaceCommunityStats;
}

/** לב מלא - "אהבו" (בדיוק אותה משפחת אייקונים כמו PinIcon/CheckIcon
 *  ב-LocationPromptModal.tsx - viewBox 24x24, מלא ולא stroke, כדי
 *  להיראות "אמיתי" בגודל קטן, לא כמו קו דק שנעלם). */
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" />
    </svg>
  );
}

/** אגודל למטה מלא - "לא אהבו". */
function ThumbsDownIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05C1.05 11.5 1 11.75 1 12v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  );
}

/** סרט/סימנייה מלא - "שמרו" - אותה שפה חזותית כמו כפתור השמירה
 *  (save.png/save-active.png) בשאר האפליקציה, רק כ-SVG חד ובגודל קבוע. */
function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 2c-1.1 0-2 .9-2 2v18l8-3.5L20 22V4c0-1.1-.9-2-2-2H6z" />
    </svg>
  );
}

interface StatBadgeProps {
  icon: ReactNode;
  value: number;
  label: string;
  /** רקע העיגול מאחורי האייקון - קלאס (או style) שמייצג טוקן צבע קיים
   *  מ-tokens.css, לא צבע מומצא. */
  circleClassName: string;
  circleStyle?: CSSProperties;
}

function StatBadge({ icon, value, label, circleClassName, circleStyle }: StatBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary/70 py-3.5 text-center">
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${circleClassName}`} style={circleStyle}>
        {icon}
      </span>
      <span className="text-base font-extrabold text-ink">{value}</span>
      <span className="text-[11px] text-ink-secondary">{label}</span>
    </div>
  );
}

/**
 * *** תוספת (בקשה מפורשת - "נתונים על האטרקציה - כמה אנשים סימנו
 * אהבתי/לא אהבו/שמרו"): שלושה מספרים בלבד, בלי חשיפת זהות אף משתמש
 * (ר' placeCommunityStatsService.ts - admin client, ספירה בלבד).
 * מוצג רק אם יש לפחות נתון אחד (likedCount+dislikedCount+savedCount>0) -
 * אחרת "0 0 0" על מקום חדש נראה כמו תכונה שבורה, לא כמו "עדיין אין
 * מספיק נתונים".
 *
 * *** תיקון (בקשה מפורשת - "האימוג'ים האלה מכוערים - אייקונים
 * ייעודיים שלנו"): הוחלף אימוג'י גולמי (❤️/👎/🔖, שמרונדר שונה לגמרי
 * בכל מכשיר/OS) באייקוני SVG מותאמים - עיגול צבעוני עם אייקון מלא
 * בפנים, בדיוק אותו דפוס עיצובי שכבר קיים ב-LocationPromptModal.tsx
 * (PinIcon/CheckIcon בעיגול), ובצבעי המותג האמיתיים מ-tokens.css
 * (category-pink ללב, danger לאגודל-למטה, גרדיאנט primary-start/end
 * לסימנייה - אותו גרדיאנט בדיוק כמו כל כפתורי ה-CTA/שמירה באפליקציה) -
 * לא צבעים מומצאים.
 */
export function PlaceCommunityStatsSection({ stats }: PlaceCommunityStatsSectionProps) {
  const { likedCount, dislikedCount, savedCount } = stats;
  const total = likedCount + dislikedCount + savedCount;
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ink-secondary/10 bg-white p-4">
      <p className="text-sm font-bold text-ink">מה הקהילה חושבת</p>
      <div className="grid grid-cols-3 gap-2">
        <StatBadge
          icon={<BookmarkIcon className="text-white" />}
          value={savedCount}
          label="שמרו"
          circleClassName="text-white"
          circleStyle={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        />
        <StatBadge
          icon={<ThumbsDownIcon className="text-[var(--color-danger)]" />}
          value={dislikedCount}
          label="לא אהבו"
          circleClassName="bg-[var(--color-danger)]/12"
        />
        <StatBadge
          icon={<HeartIcon className="text-[var(--color-category-pink)]" />}
          value={likedCount}
          label="אהבו"
          circleClassName="bg-[var(--color-category-pink)]/12"
        />
      </div>
    </div>
  );
}
