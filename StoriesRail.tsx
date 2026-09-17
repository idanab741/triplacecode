"use client";

import type { ReactNode } from "react";
import type { StoryRailAuthorDto } from "@/services/social/storyService";
import { getAvatarUrl } from "@/constants/avatar";

interface StoriesRailProps {
  rail: StoryRailAuthorDto[];
  viewerId: string;
  /** תמונת הפרופיל האמיתית של המשתמש - מוצגת בתוך העיגול שלי. */
  viewerAvatarUrl?: string | null;
  /** שם התצוגה של המשתמש עצמו - מוצג מתחת לעיגול שלו כשיש לו כבר
   *  סטורי פעיל, במקום התווית הגנרית "הסטורי שלי". */
  viewerName?: string | null;
  onOpenStory: (authorIndex: number) => void;
  onCreateStory: () => void;
}

// url==null (אין תמונה בכלל) => תמונת ברירת המחדל (getAvatarUrl).
// כשיש כתובת אמיתית - מוצגת כרגיל.
function Avatar({ url }: { url: string | null }) {
  // *** תיקון (בקשה מפורשת - "התמונה בסטורי נחתכת ולא מלאה בצורת
  // האליפסה"): תמונת ברירת המחדל (default-avatar.png) עצמה מוקפת
  // ברווח לבן מובנה בתוך הקובץ - object-cover לא ממלא את החלון כי
  // הריבוע השקוף/הרווח הזה נחשב חלק מהתמונה. מגדילים (scale) רק את
  // ברירת המחדל (לא תמונות אמיתיות שהמשתמשים העלו) - אותה טכניקה
  // בדיוק כמו scale-125 על אייקוני הקטגוריות בעמוד הבית.
  const isDefault = !url || url.trim().length === 0;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={getAvatarUrl(url)} alt="" className={`h-full w-full object-cover ${isDefault ? "scale-150" : ""}`} />
  );
}

/** "חלון מטוס" - צורה אליפטית מוארכת, לכל הסטוריז (כולל שלי - בקשה
 *  מפורשת: "לא צריך שהעיגול שלי יהיה שונה/מיוחד, פשוט הכי ימני"). */
function WindowFrame({ gradient, glow, children }: { gradient: string; glow: boolean; children: ReactNode }) {
  return (
    <span
      className="flex h-[92px] w-[68px] items-center justify-center rounded-full p-[3px]"
      style={{ background: gradient, boxShadow: glow ? "0 6px 18px -4px rgba(124,58,237,0.55)" : "none" }}
    >
      <span className="h-full w-full overflow-hidden rounded-full border-[3px] border-white">{children}</span>
    </span>
  );
}

const GENERIC_PLACEHOLDER_IMAGES = [
  "/images/mascot-happy.png",
  "/images/mascot-sad.png",
  "/images/mascot-shocked.png",
  "/images/mascot-skeptical.png",
];
/** סה"כ חלונות בשורה (כולל שלי) כשאין מספיק סטוריז אמיתיים - ממלאים
 *  את השאר בדמויות גנריות, כדי שהשורה תמיד תיראה "מלאה". */
const TOTAL_SLOTS = 5;

/**
 * *** עיצוב-מחדש מלא (בקשה מפורשת - "עזוב את זה, זה לא טוב - שהסטורי
 * שלי יהיה הימני ביותר וכל השאר משמאלו"): בוטל לגמרי הניסיון הקודם
 * (עיגול מרכזי קבוע + שני צדדים חופפים אחריו) - הוא היה מסובך מדי
 * ונראה רע (מסגרת לבנה מסביב לעיגול מהניסיון לכסות חפיפה). עכשיו זו
 * שורה אחת רגילה וגלילה רגילה: "הסטורי שלי" תמיד ראשון ב-DOM (ב-RTL
 * זה אומר הכי ימני), אחריו כל שאר הסטוריז לפי הסדר שהם מגיעים
 * ב-rail, ובסוף (השמאלי ביותר) חלוניות גנריות אם אין מספיק אמיתיים
 * כדי למלא את השורה. בלי FLIP, בלי z-index, בלי חפיפות - גלילה
 * אופקית פשוטה כמו כל אפליקציה אחרת.
 */
export function StoriesRail({ rail, viewerId, viewerAvatarUrl, viewerName, onOpenStory, onCreateStory }: StoriesRailProps) {
  const selfEntry = rail.find((entry) => entry.author.id === viewerId);
  const others = rail.filter((entry) => entry.author.id !== viewerId);

  function handleMyStoryClick() {
    if (selfEntry) {
      onOpenStory(rail.indexOf(selfEntry));
    } else {
      onCreateStory();
    }
  }

  function renderOtherStory(entry: StoryRailAuthorDto) {
    // התמונה בכל אליפסה היא התמונה הראשונה שמופיעה בסטורי עצמו
    // (entry.stories[0]) - לא תמונת הפרופיל של המחבר.
    const thumbnailUrl = entry.stories[0]?.media[0]?.url ?? entry.author.avatarUrl;
    return (
      <button
        key={entry.author.id}
        type="button"
        onClick={() => onOpenStory(rail.indexOf(entry))}
        className="flex w-[70px] shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
      >
        <WindowFrame
          gradient={
            entry.hasUnviewed
              ? "linear-gradient(135deg, var(--color-places-purple) 0%, var(--color-places-violet) 55%, #ec4899 100%)"
              : "#e2e2e8"
          }
          glow={entry.hasUnviewed}
        >
          <Avatar url={thumbnailUrl ?? null} />
        </WindowFrame>
        <span className="w-full truncate text-center text-[11.5px] font-bold text-ink">
          {entry.author.fullName ?? entry.author.username ?? "מטייל"}
        </span>
      </button>
    );
  }

  function renderPlaceholder(imageSrc: string, key: string) {
    return (
      <div key={key} className="flex w-[70px] shrink-0 flex-col items-center gap-2 opacity-60">
        <WindowFrame gradient="#e2e2e8" glow={false}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        </WindowFrame>
        <span className="w-full truncate text-center text-[11.5px] font-bold text-ink-secondary">מטייל</span>
      </div>
    );
  }

  const missing = Math.max(0, TOTAL_SLOTS - 1 - others.length);
  const placeholders = Array.from({ length: missing }, (_, i) =>
    renderPlaceholder(GENERIC_PLACEHOLDER_IMAGES[i % GENERIC_PLACEHOLDER_IMAGES.length], `placeholder-${i}`)
  );

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
      {/* הסטורי שלי - תמיד ראשון (הכי ימני ב-RTL), בלי עיצוב מיוחד -
          אותה חלונית אליפטית בדיוק כמו כל השאר. תג ה-"+" תמיד קיים
          (גם אם כבר יש סטורי פעיל) - זו הדרך היחידה להוסיף עוד אחד. */}
      <div className="flex w-[70px] shrink-0 flex-col items-center gap-2">
        <span className="relative">
          <button type="button" onClick={handleMyStoryClick} className="block transition-transform active:scale-95">
            <WindowFrame
              gradient={
                selfEntry?.hasUnviewed
                  ? "linear-gradient(135deg, var(--color-places-purple) 0%, var(--color-places-violet) 55%, #ec4899 100%)"
                  : "#e2e2e8"
              }
              glow={Boolean(selfEntry?.hasUnviewed)}
            >
              <Avatar url={viewerAvatarUrl ?? null} />
            </WindowFrame>
          </button>
          <button
            type="button"
            onClick={onCreateStory}
            aria-label="הוסף סטורי"
            className="absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-soft transition-transform active:scale-90"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-places-purple)" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </span>
        <button type="button" onClick={handleMyStoryClick} className="w-full">
          <span className="w-full truncate text-center text-[11.5px] font-bold text-ink">
            {selfEntry ? (viewerName?.trim() || "הסטורי שלי") : "צור סטורי"}
          </span>
        </button>
      </div>

      {others.map(renderOtherStory)}
      {placeholders}
    </div>
  );
}
