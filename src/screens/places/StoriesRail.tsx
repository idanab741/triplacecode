"use client";

import type { ReactNode } from "react";
import type { StoryRailAuthorDto } from "@/services/social/storyService";
import { getAvatarUrl } from "@/constants/avatar";

interface StoriesRailProps {
  rail: StoryRailAuthorDto[];
  viewerId: string;
  /** תמונת הפרופיל האמיתית של המשתמש - מוצגת בתוך העיגול המרכזי
   *  (בקשה מפורשת: "התמונה בצור סטורי צריכה להיות תמונת הפרופיל"). */
  viewerAvatarUrl?: string | null;
  /** *** תוספת (בקשה מפורשת - "איפה שכתוב הסטורי שלי אני רוצה שיהיה
   *  כתוב את שם המשתמש"): שם התצוגה של המשתמש עצמו - מוצג מתחת לעיגול
   *  המרכזי כשיש לו כבר סטורי פעיל, במקום התווית הגנרית "הסטורי שלי". */
  viewerName?: string | null;
  onOpenStory: (authorIndex: number) => void;
  onCreateStory: () => void;
}

// url==null (אין תמונה בכלל) => תמונת ברירת המחדל (getAvatarUrl).
// כשיש כתובת אמיתית - מוצגת כרגיל.
function Avatar({ url }: { url: string | null }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={getAvatarUrl(url)} alt="" className="h-full w-full object-cover" />
  );
}

/** "חלון מטוס" - צורה אליפטית מוארכת (סעיף 6 באפיון) - עכשיו רק
 *  לסטוריז של *אחרים*, בצדדים. */
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

/** *** תוספת (בקשה מפורשת - "עיגול באמצע של המשתמש, כמו ה-HERO
 *  ששלחתי - עגול, לא אליפסה מוארכת כמו החלונות שבצדדים"): עיגול
 *  רגיל (לא "חלון מטוס") לתמונת הפרופיל של המשתמש עצמו - קצת יותר
 *  גדול מהחלונות בצדדים, כדי שירגיש כמו העוגן החזותי של השורה,
 *  בדיוק כמו הדמות במרכז תמונת ה-HERO. */
/** *** תוספת (בקשה מפורשת - "תגדיל את העיגול של הסטורי שלי ב-15%"):
 *  76px -> 87px (76*1.15≈87.4, מעוגל). עיגול רגיל (לא "חלון מטוס")
 *  לתמונת הפרופיל של המשתמש עצמו - קצת יותר גדול מהחלונות בצדדים,
 *  כדי שירגיש כמו העוגן החזותי של השורה, בדיוק כמו הדמות במרכז
 *  תמונת ה-HERO. */
function CenterCircle({ gradient, glow, children }: { gradient: string; glow: boolean; children: ReactNode }) {
  return (
    <span
      className="flex h-[87px] w-[87px] items-center justify-center rounded-full p-[3px]"
      style={{ background: gradient, boxShadow: glow ? "0 6px 18px -4px rgba(124,58,237,0.55)" : "none" }}
    >
      <span className="h-full w-full overflow-hidden rounded-full border-[3px] border-white">{children}</span>
    </span>
  );
}

/** *** תוספת (בקשה מפורשת - "אם אין סטורי - תעשה חלוניות גנריות,
 *  4 לכל צד - ואם מישהו מעלה זה מוחק אותן אחת אחת"): תמיד יש בדיוק
 *  4 חלונות בכל צד - ממולאים קודם בסטוריז אמיתיים, ומה שנשאר מתמלא
 *  בתמונות הדמות הגנריות האלה (במחזוריות). ברגע שנוסף סטורי אמיתי,
 *  הוא "אוכל" מקום ראשון (הכי קרוב למרכז) ודוחק חלונית גנרית אחת
 *  החוצה - בדיוק "מוחק אותן אחת אחת". */
const GENERIC_PLACEHOLDER_IMAGES = [
  "/images/mascot-happy.png",
  "/images/mascot-sad.png",
  "/images/mascot-shocked.png",
  "/images/mascot-skeptical.png",
];
const SLOTS_PER_SIDE = 4;

/**
 * *** עיצוב-מחדש (בקשה מפורשת - "כמו ה-HERO ששלחתי: עיגול באמצע של
 * המשתמש, ובצדדים חלונות יותר גבוהים עם סטורי של אחרים"): קודם זה
 * היה שורה רגילה שמתחילה מהקצה (כפתור "צור סטורי" ראשון, אחר כך כל
 * שאר הסטוריז) - עכשיו האנטומיה היא סימטרית: הסטורי/פרופיל של
 * המשתמש עצמו הוא עיגול אחד באמצע, וכל שאר הסטוריז (חלונות מטוס
 * אליפטיים, ללא שינוי בעיצוב שלהם) מתחלקים לשני חצאים בצדדים - בדיוק
 * כמו החלונות משני צידי הדמות בתמונת ה-HERO.
 *
 * `justify-center` (לא flex-start) - כשיש מעט סטוריז, השורה כולה
 * ממורכזת ויזואלית סביב העיגול. אם יש הרבה סטוריז וזה עולה על רוחב
 * המסך, `overflow-x-auto` עדיין מאפשר גלילה רגילה - המירכוז "משוחרר"
 * ברגע שיש גלילה, וזו פשרה סבירה (אין דרך נקייה לשמור על מרכוז מושלם
 * וגם גלילה אינסופית משני הצדדים בו-זמנית).
 */
export function StoriesRail({ rail, viewerId, viewerAvatarUrl, viewerName, onOpenStory, onCreateStory }: StoriesRailProps) {
  const selfEntry = rail.find((entry) => entry.author.id === viewerId);
  const others = rail.filter((entry) => entry.author.id !== viewerId);
  // חצי מהאחרים מימין לעיגול, חצי משמאלו - ב-RTL "החצי הראשון בסדר
  // ה-DOM" מוצג ימני, לכן others נחתך לשני חצאים לפי הסדר המקורי.
  const mid = Math.ceil(others.length / 2);
  const rightSide = others.slice(0, mid);
  const leftSide = others.slice(mid);

  function handleCenterClick() {
    if (selfEntry) {
      onOpenStory(rail.indexOf(selfEntry));
    } else {
      onCreateStory();
    }
  }

  function renderOtherStory(entry: StoryRailAuthorDto) {
    // התמונה בכל אליפסה היא התמונה הראשונה שמופיעה בסטורי עצמו
    // (entry.stories[0]) - לא תמונת הפרופיל של המחבר (בקשה מפורשת, פעמיים).
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

  /** חלונית גנרית (לא לחיצה, לא סטורי אמיתי) - רק "ממלאת מקום" עד
   *  שמצטברים מספיק סטוריז אמיתיים לאותו צד. */
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

  /** משלים כל צד ל-SLOTS_PER_SIDE בדיוק: הסטוריז האמיתיים תמיד קרובים
   *  למרכז, החלוניות הגנריות תמיד בקצה החיצוני - כדי שסטורי אמיתי
   *  חדש "ידחוק" חלונית גנרית אחת החוצה, לא יחליף אחת שכבר קרובה
   *  למרכז. ב-RTL, הילד הראשון ב-DOM מוצג הכי ימני: בצד ימין (לפני
   *  העיגול) הסדר הנכון הוא [חלוניות, אמיתיים] (חוץ->פנים), ובצד
   *  שמאל (אחרי העיגול) ההפך - [אמיתיים, חלוניות] (פנים->חוץ). אם יש
   *  כבר יותר מ-SLOTS_PER_SIDE סטוריז אמיתיים - אין בכלל חלוניות
   *  גנריות, מוצגים כל הסטוריז האמיתיים (גולש בגלילה).
   */
  function renderSide(realSide: StoryRailAuthorDto[], sideKey: string, isRightSide: boolean) {
    const missing = Math.max(0, SLOTS_PER_SIDE - realSide.length);
    const placeholders = Array.from({ length: missing }, (_, i) =>
      renderPlaceholder(GENERIC_PLACEHOLDER_IMAGES[i % GENERIC_PLACEHOLDER_IMAGES.length], `${sideKey}-placeholder-${i}`)
    );
    const realElements = realSide.map(renderOtherStory);
    return isRightSide ? (
      <>
        {placeholders}
        {realElements}
      </>
    ) : (
      <>
        {realElements}
        {placeholders}
      </>
    );
  }

  return (
    <div className="flex items-start justify-center gap-4 overflow-x-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
      {renderSide(rightSide, "right", true)}

      <button
        type="button"
        onClick={handleCenterClick}
        className="flex w-[94px] shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
      >
        {/* *** תיקון (בקשה מפורשת - "העיגול באמצע צריך להיות ממורכז
            במרכז החלוניות, והטקסט שלו באותו גובה כמו שאר החלוניות"):
            העיגול (76px) קטן מגובה חלון הצד (92px) - בלי התיקון הזה
            הוא נדבק לחלק העליון (items-start בשורה החיצונית), מה
            שמזיז את הטקסט שמתחתיו גבוה יותר מהטקסט שמתחת לחלונות
            הצד. עטיפה בגובה 92px קבוע, עם items-center, ממרכזת את
            העיגול בתוכה בדיוק כמו שהחלונות הצדדיים תופסים 92px - כך
            שכל הכיתובים מתחילים מאותו קו בדיוק. */}
        <span className="flex h-[92px] w-[87px] items-center justify-center">
          <span className="relative">
            <CenterCircle
              gradient={
                selfEntry?.hasUnviewed
                  ? "linear-gradient(135deg, var(--color-places-purple) 0%, var(--color-places-violet) 55%, #ec4899 100%)"
                  : "var(--color-bg-secondary, #eee)"
              }
              glow={Boolean(selfEntry?.hasUnviewed)}
            >
              <Avatar url={viewerAvatarUrl ?? null} />
            </CenterCircle>
            {/* תג ה-"+" מוצג רק כשאין עדיין סטורי פעיל משלי - ברגע שיש,
                הקליק פותח את הסטורי הקיים, לא יוצר עוד אחד. */}
            {!selfEntry && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-soft">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-places-purple)" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            )}
          </span>
        </span>
        <span className="w-full truncate text-center text-[11.5px] font-bold text-ink">
          {selfEntry ? (viewerName?.trim() || "הסטורי שלי") : "צור סטורי"}
        </span>
      </button>

      {renderSide(leftSide, "left", false)}
    </div>
  );
}
