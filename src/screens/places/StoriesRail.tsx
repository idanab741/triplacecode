"use client";

import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
function Avatar({ url }: { url: string | null }) {
  const isDefault = !url || url.trim().length === 0;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={getAvatarUrl(url)} alt="" className={`h-full w-full object-cover ${isDefault ? "scale-150" : ""}`} draggable={false} />
  );
}

/** "חלון מטוס" - צורה אליפטית מוארכת, לכל שאר הסטוריז (לא שלי). לא
 *  משתנה אף פעם - לא בזמן swipe, לא בזמן snap (בקשה מפורשת). */
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

/** עיגול אמיתי - רק למשתמש עצמו. בלי רקע. */
function MyStoryCircle({ gradient, glow, children }: { gradient: string; glow: boolean; children: ReactNode }) {
  return (
    <span
      className="flex h-[92px] w-[92px] items-center justify-center rounded-full p-[3px]"
      style={{ background: gradient, boxShadow: glow ? "0 6px 18px -4px rgba(124,58,237,0.55)" : "none" }}
    >
      <span className="h-full w-full overflow-hidden rounded-full border-[3px] border-white">{children}</span>
    </span>
  );
}

const ITEM_WIDTH = 70;
const ITEM_GAP = 24; // *** בקשה מפורשת (סעיף 13) - "gap: 24px" קבוע, לא space-between.
const STEP = ITEM_WIDTH + ITEM_GAP;
/** הרווח הקבוע בין המרכז לצדדים (בקשה מפורשת, סעיף 4+13 - "מספיק
 *  גדול כדי ליצור separation ברור"). */
const SPACER_WIDTH = 230;

const GENERIC_PLACEHOLDER_IMAGES = [
  "/images/mascot-happy.png",
  "/images/mascot-sad.png",
  "/images/mascot-shocked.png",
  "/images/mascot-skeptical.png",
];
const MIN_CYCLE_LENGTH = 5;
/** *** תיקון-ארכיטקטורה מלא (בקשה מפורשת - "STOP, זה לא CSS קטן, שנה
 * את מבנה הקומפוננטה"): 3 ניסיונות קודמים התבססו על מדידת/חישוב
 * פיקסלים ידני ב-JS (transform + getBoundingClientRect) - וכל שלושתם
 * נכשלו במציאות, לא רק בתיאוריה. הסיבה: יותר מדי הנחות שבירות (טיימינג
 * של אנימציה, parity של flexbox, מדידה תוך כדי תנועה). הפתרון עכשיו
 * הוא **לא עוד קוד ידני** - גלילה אמיתית של הדפדפן (overflow-x-auto)
 * עם CSS scroll-snap-align על הרווחנים בלבד (לא על הפריטים) - כך
 * שהדפדפן עצמו, לא אני, אחראי על "לאן זה נוחת" אחרי כל swipe. זה
 * פיצ'ר CSS סטנדרטי שנתמך בכל דפדפן מודרני ואי אפשר "לפספס" אותו
 * בגלל טיימינג, כי אין שום JS שמנסה לתפוס את הרגע הנכון - זה קורה
 * ברמת מנוע הרינדור עצמו.
 */
const REPEAT_COUNT = 15;

export function StoriesRail({ rail, viewerId, viewerAvatarUrl, viewerName, onOpenStory, onCreateStory }: StoriesRailProps) {
  const selfEntry = rail.find((entry) => entry.author.id === viewerId);
  const others = rail.filter((entry) => entry.author.id !== viewerId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasDraggedRef = useRef(false);
  const dragStateRef = useRef<{ active: boolean; startX: number; startScrollLeft: number } | null>(null);

  function handleMyStoryClick() {
    if (selfEntry) {
      onOpenStory(rail.indexOf(selfEntry));
    } else {
      onCreateStory();
    }
  }

  type CycleItem =
    | { kind: "real"; entry: StoryRailAuthorDto; renderKey: string }
    | { kind: "placeholder"; imageSrc: string; renderKey: string };

  const baseCycle = useMemo<CycleItem[]>(() => {
    const real: CycleItem[] = others.map((entry, i) => ({ kind: "real", entry, renderKey: `real-${i}-${entry.author.id}` }));
    const missing = Math.max(0, MIN_CYCLE_LENGTH - real.length);
    const placeholders: CycleItem[] = Array.from({ length: missing }, (_, i) => ({
      kind: "placeholder",
      imageSrc: GENERIC_PLACEHOLDER_IMAGES[i % GENERIC_PLACEHOLDER_IMAGES.length],
      renderKey: `placeholder-${i}`,
    }));
    return [...real, ...placeholders];
  }, [others]);

  // כל חזרה מסתיימת ברווחן אחד - זה מה שסימני scroll-snap-align
  // "center" יושבים עליו (לא על הפריטים עצמם).
  const repeatedItems = useMemo(() => {
    if (baseCycle.length === 0) return [];
    const out: ({ type: "item"; item: CycleItem; renderKey: string } | { type: "spacer"; renderKey: string })[] = [];
    for (let rep = 0; rep < REPEAT_COUNT; rep++) {
      baseCycle.forEach((item) => out.push({ type: "item", item, renderKey: `${rep}-${item.renderKey}` }));
      out.push({ type: "spacer", renderKey: `spacer-${rep}` });
    }
    return out;
  }, [baseCycle]);

  const middleSpacerKey = repeatedItems.length > 0 ? `spacer-${Math.floor(REPEAT_COUNT / 2)}` : null;

  // *** מיקום התחלתי - גלילה (לא transform, לא חישוב) עד שהרווחן
  // האמצעי נמצא בדיוק במרכז הקונטיינר. scrollIntoView הוא API דפדפן
  // סטנדרטי - עושה בדיוק את זה בעצמו, בלי שאצטרך לחשב שום פיקסל.
  useLayoutEffect(() => {
    if (!middleSpacerKey) return;
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-key="${middleSpacerKey}"]`);
    if (el) el.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" as ScrollBehavior });
  }, [middleSpacerKey]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    if (!container) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    hasDraggedRef.current = false;
    dragStateRef.current = { active: true, startX: e.clientX, startScrollLeft: container.scrollLeft };
    // מנטרלים scroll-snap זמנית בזמן גרירה פעילה - כדי שהתנועה תהיה
    // חופשית וישירה אחרי האצבע/עכבר (בקשה מפורשת, סעיף 8), לא "נתפסת"
    // מוקדם מדי על ידי snap points. חוזר לפעולה מיד בשחרור.
    container.style.scrollSnapType = "none";
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    const container = scrollRef.current;
    if (!state?.active || !container) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 6) hasDraggedRef.current = true;
    // RTL: לפי הסטנדרט המודרני (spec-compliant, כל הדפדפנים הנוכחיים),
    // scrollLeft שלילי יותר = עמוק יותר לתוך התוכן (שמאלה ויזואלית).
    container.scrollLeft = state.startScrollLeft + dx;
  }

  function handlePointerUp() {
    const state = dragStateRef.current;
    const container = scrollRef.current;
    if (!state?.active || !container) return;
    state.active = false;
    // מחזירים scroll-snap - הדפדפן עצמו (לא קוד שלי) גולל את השארית
    // עד לרווחן הקרוב ביותר, חלק ומדויק.
    container.style.scrollSnapType = "x mandatory";
  }

  function renderCycleItem({ item, renderKey }: { item: CycleItem; renderKey: string }) {
    if (item.kind === "placeholder") {
      return (
        <div
          key={renderKey}
          data-key={renderKey}
          className="flex shrink-0 flex-col items-start gap-2 opacity-60"
          style={{ width: ITEM_WIDTH }}
        >
          <WindowFrame gradient="#e2e2e8" glow={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageSrc} alt="" className="h-full w-full object-cover" draggable={false} />
          </WindowFrame>
          <span className="w-full truncate text-center text-[11.5px] font-bold text-ink-secondary">מטייל</span>
        </div>
      );
    }

    const { entry } = item;
    const thumbnailUrl = entry.stories[0]?.media[0]?.url ?? entry.author.avatarUrl;
    return (
      <button
        key={renderKey}
        data-key={renderKey}
        type="button"
        onClick={() => {
          if (hasDraggedRef.current) return;
          onOpenStory(rail.indexOf(entry));
        }}
        className="flex shrink-0 flex-col items-start gap-2"
        style={{ width: ITEM_WIDTH }}
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

  return (
    <div className="relative pb-4 pt-12" style={{ height: 152 }}>
      {/* מסלול-גלילה אמיתי של הדפדפן - לא transform מחושב. z-0, שכבה
          תחתונה - "מתחת" לעיגול שלי. */}
      <div
        ref={scrollRef}
        className="absolute inset-0 flex touch-pan-y select-none items-start overflow-x-auto"
        style={{ gap: STEP - ITEM_WIDTH, scrollSnapType: "x mandatory", scrollbarWidth: "none", zIndex: 0 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* ריפוד בתחילת/סוף המסלול - כדי שגם הפריטים הראשונים/אחרונים
            יוכלו להגיע למרכז המסך בזמן גלילה (בלי זה הגלילה הייתה
            "נתקעת" בקצה לפני שהאלמנט הראשון מגיע למרכז). */}
        <div className="shrink-0" style={{ width: "50vw" }} aria-hidden />
        {repeatedItems.map((row) =>
          row.type === "spacer" ? (
            <div
              key={row.renderKey}
              data-key={row.renderKey}
              aria-hidden
              className="shrink-0"
              style={{ width: SPACER_WIDTH, scrollSnapAlign: "center" }}
            />
          ) : (
            renderCycleItem(row)
          )
        )}
        <div className="shrink-0" style={{ width: "50vw" }} aria-hidden />
      </div>

      {/* הסטורי שלי - קבוע, לא חלק מהגלילה, לא ב-transform, לא ב-
          scroll position של המסלול בכלל - ממורכז מוחלט מעל הכל. */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center" style={{ zIndex: 10 }}>
        <div className="pointer-events-auto flex w-[92px] shrink-0 flex-col items-center gap-2">
          {/* רק התמונה מורמת - הטקסט מתחת לא זז, נשאר על אותו
              baseline כמו כל שאר הטקסטים (בקשה מפורשת, סעיף 8). */}
          <span className="relative -mt-2">
            <button type="button" onClick={handleMyStoryClick} className="block transition-transform active:scale-95">
              <MyStoryCircle
                gradient={
                  selfEntry?.hasUnviewed
                    ? "linear-gradient(135deg, var(--color-places-purple) 0%, var(--color-places-violet) 55%, #ec4899 100%)"
                    : "#e2e2e8"
                }
                glow={Boolean(selfEntry?.hasUnviewed)}
              >
                <Avatar url={viewerAvatarUrl ?? null} />
              </MyStoryCircle>
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
      </div>
    </div>
  );
}
