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

/** "חלון מטוס" - צורה אליפטית מוארכת, לכל שאר הסטוריז (לא שלי). */
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

/** עיגול אמיתי - רק למשתמש עצמו. בלי רקע לבן (בקשה מפורשת - "רקע
 *  שקוף") - רק ה-p-[3px] של הגרדיאנט עצמו. */
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
const ITEM_GAP = 12;
const SLOT_WIDTH = ITEM_WIDTH + ITEM_GAP;
/** *** תיקון-שורש (בקשה מפורשת - "הרווח קטן מדי ולא אחיד, טקסט חוסם
 * את הסטורי שלי"): הגישה הקודמת ניסתה "לדחוף" את ה-offset הגולל
 * החוצה ממתחם-אסור לפי חישוב מספרי - אבל בשורה עם מרווח אחיד (כל
 * הפריטים 82px זה מזה), אין שום דרך ליצור רווח **סימטרי וגדול יותר**
 * רק על ידי הזזה של המספר - הזזה בכפולות שלמות של SLOT_WIDTH משאירה
 * תמיד את אותו יחס-מרחק (41px) לשכן הקרוב, מאיזה "תפר" (seam) שלא
 * יהיה. הפתרון הנכון: רווחן אמיתי (SPACER) בגודל קבוע, שמוכנס פיזית
 * כאיבר אחד נוסף בתוך מחזור-הבסיס שחוזר על עצמו - לא מספר שמנסה
 * "לדמות" רווח. אחרי כל גרירה, ה"נחיתה" היא תמיד בדיוק על אמצע
 * הרווחן הקרוב ביותר (נמדד בפועל עם getBoundingClientRect - לא
 * מחושב בהנחות על flexbox, כדי שזה יהיה נכון תמיד, לא רק בתיאוריה). */
const SPACER_WIDTH = 210;

const GENERIC_PLACEHOLDER_IMAGES = [
  "/images/mascot-happy.png",
  "/images/mascot-sad.png",
  "/images/mascot-shocked.png",
  "/images/mascot-skeptical.png",
];
const MIN_CYCLE_LENGTH = 5;
const REPEAT_COUNT = 15;
/** מרחק גרירה מינימלי (px) כדי להיחשב "גרירה" ולא "קליק" - בקשה
 *  מפורשת: "ברגע שגוללים זה פותח סטורי שלחוץ". isDragging (state)
 *  מתאפס באותו handlePointerUp שגם קורא ל-onClick מיד אחריו (סדר
 *  אירועי הדפדפן: pointerup -> click) - אז בזמן שה-onClick רץ, ה-
 *  state כבר התאפס בחזרה ל-false ולא עוזר. ref נפרד, שלא מתאפס עד
 *  pointerdown הבא, פותר את זה נכון. */
const DRAG_CLICK_THRESHOLD = 6;

export function StoriesRail({ rail, viewerId, viewerAvatarUrl, viewerName, onOpenStory, onCreateStory }: StoriesRailProps) {
  const selfEntry = rail.find((entry) => entry.author.id === viewerId);
  const others = rail.filter((entry) => entry.author.id !== viewerId);

  const outerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const hasDraggedRef = useRef(false);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startOffset: number;
    lastX: number;
    lastT: number;
    velocity: number;
  } | null>(null);

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

  // *** מחזור-הבסיס: כל הסטוריז האמיתיים + דמויות גנריות שממלאות עד
  // MIN_CYCLE_LENGTH (בקשה מפורשת - "אפשר שיהיו גם הפרצופים שהדבקתי").
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

  // *** כל חזרה של מחזור-הבסיס מסתיימת ברווחן אמיתי אחד (data-spacer) -
  // זה מה שמבטיח רווח קבוע וסימטרי בכל מקום שהעיגול שלי בסופו של דבר
  // "נוחת" עליו אחרי גרירה, בלי תלות בחשבון-פיקסלים משוער.
  const repeatedItems = useMemo(() => {
    if (baseCycle.length === 0) return [];
    const out: ({ type: "item"; item: CycleItem; renderKey: string } | { type: "spacer"; renderKey: string })[] = [];
    for (let rep = 0; rep < REPEAT_COUNT; rep++) {
      baseCycle.forEach((item) => out.push({ type: "item", item, renderKey: `${rep}-${item.renderKey}` }));
      out.push({ type: "spacer", renderKey: `spacer-${rep}` });
    }
    return out;
  }, [baseCycle]);

  /** מודד בפועל (לא מחשב לפי הנחות) את מרכז הרווחן הקרוב ביותר למרכז
   *  הקונטיינר, ומתקן את dragOffset בהתאם - כדי שהוא יישב בדיוק שם.
   *  זו הסיבה שזה תמיד נכון, גם אם ה-flex layout מתנהג אחרת ממה
   *  שציפינו (בניגוד לגרסה הקודמת שהניחה הנחות על parity/justify). */
  function snapToNearestSpacer() {
    const outer = outerRef.current;
    const track = trackRef.current;
    if (!outer || !track) return;
    const spacers = Array.from(track.querySelectorAll<HTMLElement>("[data-spacer]"));
    if (spacers.length === 0) return;

    const outerRect = outer.getBoundingClientRect();
    const outerCenterX = outerRect.left + outerRect.width / 2;

    let bestDelta = 0;
    let bestAbs = Infinity;
    for (const el of spacers as HTMLElement[]) {
      const rect = el.getBoundingClientRect();
      const elCenterX = rect.left + rect.width / 2;
      const delta = outerCenterX - elCenterX;
      if (Math.abs(delta) < bestAbs) {
        bestAbs = Math.abs(delta);
        bestDelta = delta;
      }
    }
    setDragOffset((prev) => prev + bestDelta);
  }

  // *** תיקון (באג אמיתי, לא רק קובץ ישן): נחיתה מדויקת גם בפתיחה
  // הראשונית - useLayoutEffect (לא useEffect) כדי שהתיקון יקרה *לפני*
  // שהדפדפן מצייר, לא אחרי - אחרת יש הבזק קצר של מיקום שגוי ברגע
  // הראשון.
  useLayoutEffect(() => {
    snapToNearestSpacer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatedItems.length]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (baseCycle.length === 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    hasDraggedRef.current = false;
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startOffset: dragOffset,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
    };
    setIsDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state?.active) return;
    const totalDelta = e.clientX - state.startX;
    if (Math.abs(totalDelta) > DRAG_CLICK_THRESHOLD) hasDraggedRef.current = true;
    const now = performance.now();
    const dt = now - state.lastT;
    if (dt > 0) state.velocity = (e.clientX - state.lastX) / dt;
    state.lastX = e.clientX;
    state.lastT = now;
    setDragOffset(state.startOffset + totalDelta);
  }

  const TRANSITION_MS = 450;

  function handlePointerUp() {
    const state = dragStateRef.current;
    if (!state?.active) return;
    state.active = false;
    setIsDragging(false);
    // תנופה קלה (momentum) לפי מהירות השחרור, ואז נחיתה מדויקת (בפועל
    // נמדדת) על מרכז הרווחן הקרוב - לא "עצירה יבשה" בלי תנועה.
    //
    // *** תיקון באג אמיתי (לא קובץ ישן): requestAnimationFrame רץ
    // ~16ms אחרי - הרבה לפני שה-transition של 450ms על התנופה עצמה
    // בכלל הספיק להתקדם, לא כל שכן להסתיים. המדידה קרתה תוך כדי
    // שהאלמנטים עדיין באמצע תנועה - זה בדיוק מה שגרם לתיקון השגוי/
    // לחוסר-רווח שראית. עכשיו ממתינים בפועל למשך ה-transition המלא
    // (setTimeout, לא frame בודד) לפני שמודדים ומתקנים סופית.
    setDragOffset((prev) => prev + state.velocity * 90);
    window.setTimeout(snapToNearestSpacer, TRANSITION_MS + 20);
  }

  function renderCycleItem({ item, renderKey }: { item: CycleItem; renderKey: string }) {
    if (item.kind === "placeholder") {
      return (
        <div key={renderKey} className="flex shrink-0 flex-col items-center gap-2 opacity-60" style={{ width: ITEM_WIDTH }}>
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
        type="button"
        onClick={() => {
          // *** תיקון (בקשה מפורשת - "ברגע שגוללים זה פותח סטורי
          // שלחוץ"): ref, לא state - ר' ההערה על DRAG_CLICK_THRESHOLD.
          if (hasDraggedRef.current) return;
          onOpenStory(rail.indexOf(entry));
        }}
        className="flex shrink-0 flex-col items-center gap-2"
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
    <div ref={outerRef} className="relative pb-4 pt-10" style={{ height: 148 }}>
      {/* המסלול - כל שאר הסטוריז + רווחנים אמיתיים, נגרר וגולש בלולאה. */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        {repeatedItems.length > 0 ? (
          <div
            ref={trackRef}
            className="flex touch-pan-y select-none items-start justify-center"
            style={{
              gap: ITEM_GAP,
              transform: `translateX(${dragOffset}px)`,
              transition: isDragging ? "none" : `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {repeatedItems.map((row) =>
              row.type === "spacer" ? (
                <div key={row.renderKey} data-spacer aria-hidden className="shrink-0" style={{ width: SPACER_WIDTH }} />
              ) : (
                renderCycleItem(row)
              )
            )}
          </div>
        ) : null}
      </div>

      {/* הסטורי שלי - ממורכז מוחלט, קבוע לגמרי, בלי רקע (שקוף), מעל
          הכל - לא זז, לא נגרר, לא משתתף בלולאה בכלל. */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center" style={{ zIndex: 10 }}>
        <div className="pointer-events-auto flex w-[92px] shrink-0 flex-col items-center gap-2">
          {/* *** תוספת (בקשה מפורשת - "העיגול קצת גבוה יותר משאר
              הסטוריז, אבל הטקסט מתחתיו באותו גובה כמו כולם"): ההרמה
              (-mt) על העיגול בלבד, לא על כל הבלוק - כך שהכיתוב
              מתחתיו נשאר בדיוק באותה שורה כמו הכיתובים של כל
              האליפסות האחרות (בקשה קודמת ונפרדת שעדיין בתוקף). */}
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
