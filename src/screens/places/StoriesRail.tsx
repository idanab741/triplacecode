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
  // *** תיקון (בדקתי לפני שליחה): gradient מגיע כאן בשני סוגים שונים -
  // לפעמים פונקציית gradient אמיתית ("linear-gradient(...)"), לפעמים
  // צבע שטוח ("#e2e2e8") כשאין סטורי פעיל. backgroundImage מקבל רק
  // gradient/image - לא צבע שטוח (זה היה נכשל בשקט על #e2e2e8).
  const isRealGradient = gradient.includes("gradient(");
  return (
    <span
      className="flex h-[92px] w-[92px] items-center justify-center rounded-full p-[3px]"
      style={{
        // שכבת ביטחון אטומה *בצורת העיגול עצמו בדיוק* (rounded-full
        // כבר גוזר את הצורה) - בקשה מפורשת: לא מלבנית מסביב לעיגול.
        // *** תיקון (בדיקה עצמית): var(--surface-2) הוא טוקן שלא קיים
        // בכלל בפרויקט הזה - הפולבק #fff תמיד היה מה שבאמת קורה, אבל
        // בצורה עמומה. לבן מפורש, בלי תלות במשתנה CSS שלא קיים.
        backgroundColor: isRealGradient ? "#ffffff" : gradient,
        backgroundImage: isRealGradient ? gradient : "none",
        boxShadow: glow ? "0 6px 18px -4px rgba(124,58,237,0.55)" : "none",
      }}
    >
      <span className="h-full w-full overflow-hidden rounded-full border-[3px] border-white">{children}</span>
    </span>
  );
}

const ITEM_WIDTH = 70;
const ITEM_GAP = 24; // *** בקשה מפורשת (סעיף 13) - "gap: 24px" קבוע, לא space-between.
/** *** תיקון-ארכיטקטורה נוסף (בקשה מפורשת - "יש פתאום פער בצד? רווח
 *  גדול כזה?"): הרווחן המיוחד בוטל לגמרי. הוא יצר "עצירה" נדירה מדי
 *  (פעם אחת לכל מחזור שלם) - גרירה רגילה לא הגיעה לחצי המרחק אליה
 *  ותמיד "קפצה בחזרה" לאותה עצירה, ובנוסף - ברגע שהיו כמה רווחנים
 *  גלויים בו-זמנית בתוך אותה תצוגה, הופיע רווח גדול במקום אקראי,
 *  לא דווקא ליד העיגול שלי. עכשיו: שורה אחידה לגמרי, כל פריט הוא
 *  עצירה (scroll-snap-align על כל אחד), בלי אלמנט מיוחד בכלל. ההגנה
 *  על העיגול שלי (בקשה מפורשת - "עיגול עם רקע בדיוק בגודל העיגול")
 *  עברה ל-MyStoryCircle עצמו - הוא אטום, מסתיר לגמרי מה שמתחתיו,
 *  בלי תלות באלמנט-רווח נפרד בתוך הנתונים. */

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
  // *** תיקון (בקשה מפורשת - "איפה שני הצדדים?!"): 50vw מודד מול
  // ה-viewport הגלובלי של הדפדפן - לא מול הרוחב האמיתי של הקונטיינר
  // הזה. ברוב המקרים באפליקציה מובייל זה מתלכד, אבל זו הנחה שיכולה
  // להישבר (מסכים רחבים, קונטיינר עם max-width וכו') - עכשיו נמדד
  // בפועל עם ResizeObserver, לא מונח.
  const [padWidth, setPadWidth] = useState(0);
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => setPadWidth(container.clientWidth / 2);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
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

  // שורה אחידה - כל עותק של מחזור-הבסיס מיד אחרי הקודם, בלי רווחן
  // מיוחד בין המחזורים.
  const repeatedItems = useMemo(() => {
    if (baseCycle.length === 0) return [];
    const out: { item: CycleItem; renderKey: string }[] = [];
    for (let rep = 0; rep < REPEAT_COUNT; rep++) {
      baseCycle.forEach((item) => out.push({ item, renderKey: `${rep}-${item.renderKey}` }));
    }
    return out;
  }, [baseCycle]);

  // פריט האמצע המדויק (לא רווחן - אין יותר כזה) - זה מה שהגלילה
  // הראשונית ממרכזת מתחת לעיגול שלי.
  const middleItemKey =
    repeatedItems.length > 0 ? repeatedItems[Math.floor(repeatedItems.length / 2)].renderKey : null;

  // *** מיקום התחלתי - גלילה (לא transform, לא חישוב) עד שהפריט
  // האמצעי נמצא בדיוק במרכז הקונטיינר. scrollIntoView הוא API דפדפן
  // סטנדרטי - עושה בדיוק את זה בעצמו, בלי שאצטרך לחשב שום פיקסל.
  useLayoutEffect(() => {
    if (!middleItemKey) return;
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-key="${middleItemKey}"]`);
    if (el) el.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" as ScrollBehavior });
  }, [middleItemKey]);

  /**
   * *** תוספת (בקשה מפורשת - "ברגע שהסטורי שנופל במרכז - הטקסט
   * והחלונית עצמה מתבטלים! יישאר במרכז רק הסטורי שלי"): פתרון שונה
   * לגמרי מכל הניסיונות הקודמים - במקום לנסות "להסתיר" את השכן עם
   * רקע/רווח, הפריט שבפועל הכי קרוב למרכז הקונטיינר **נעלם לגמרי**
   * (opacity: 0) - כך שאין בכלל תוכן מתחרה שם, לא רק תוכן מוסתר-חלקית.
   * נמדד בפועל (getBoundingClientRect) על כל גלילה, לא מחושב מראש.
   */
  const [hiddenItemKey, setHiddenItemKey] = useState<string | null>(null);
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let ticking = false;
    function updateHiddenItem() {
      ticking = false;
      const track = scrollRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;
      const candidates = Array.from(track.querySelectorAll<HTMLElement>("[data-key]"));
      let closestKey: string | null = null;
      let closestDist = Infinity;
      candidates.forEach((el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - centerX);
        if (dist < closestDist) {
          closestDist = dist;
          closestKey = el.dataset.key ?? null;
        }
      });
      // סף של 45px - בערך חצי-רוחב חלונית - כדי לא "לבטל" פריט
      // שרק במקרה קרוב יחסית, אבל עדיין לא ממש חופף.
      setHiddenItemKey(closestDist < 45 ? closestKey : null);
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateHiddenItem);
      }
    }
    updateHiddenItem();
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [repeatedItems.length]);

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
    // הפריט שכרגע הכי קרוב למרכז - נעלם לגמרי (לא רק מוסתר-חלקית).
    const isHidden = hiddenItemKey === renderKey;
    if (item.kind === "placeholder") {
      return (
        <div
          key={renderKey}
          data-key={renderKey}
          className="flex shrink-0 flex-col items-start gap-2 opacity-60"
          style={{ width: ITEM_WIDTH, scrollSnapAlign: "center", opacity: isHidden ? 0 : undefined }}
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
        style={{ width: ITEM_WIDTH, scrollSnapAlign: "center", opacity: isHidden ? 0 : 1, pointerEvents: isHidden ? "none" : "auto" }}
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
    <div className="relative pb-4 pt-20" style={{ height: 160 }}>
      {/* מסלול-גלילה אמיתי של הדפדפן - לא transform מחושב. z-0, שכבה
          תחתונה - "מתחת" לעיגול שלי. */}
      <div
        ref={scrollRef}
        className="stories-rail-track absolute inset-0 flex touch-pan-y select-none items-start overflow-x-auto"
        style={{ gap: ITEM_GAP, scrollSnapType: "x mandatory", scrollbarWidth: "none", zIndex: 0 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* ריפוד בתחילת/סוף המסלול - כדי שגם הפריטים הראשונים/אחרונים
            יוכלו להגיע למרכז המסך בזמן גלילה (בלי זה הגלילה הייתה
            "נתקעת" בקצה לפני שהאלמנט הראשון מגיע למרכז). */}
        <div className="shrink-0" style={{ width: padWidth }} aria-hidden />
        {repeatedItems.map((row) => renderCycleItem(row))}
        <div className="shrink-0" style={{ width: padWidth }} aria-hidden />
      </div>

      {/* הסטורי שלי - קבוע, לא חלק מהגלילה, לא ב-transform, לא ב-
          scroll position של המסלול בכלל - ממורכז מוחלט מעל הכל. */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center" style={{ zIndex: 10 }}>
        {/* *** תיקון (בקשה מפורשת - הראה לי בעיגול אדום איפה בדיוק):
            הרמת העיגול עם translateY יצרה פער קטן (כ-8px) בין תחתית
            העיגול (שזז ויזואלית) לתחילת הכיתוב (שנשאר במקומו בזרימה
            הרגילה - בכוונה, כדי לשמור על baseline משותף) - בפער הקטן
            הזה בדיוק לא היה שום דבר שמכסה את המסלול הגולל מתחתיו.
            הפתרון: רקע לבן אחד רציף על **כל העמודה** (עיגול+פער+כיתוב
            יחד), לא שני רקעים נפרדים עם חור ביניהם - לבן על לבן
            נשאר בלתי-נראה (לא "מסגרת"), אבל סוגר את הפער לחלוטין. */}
        {/* *** תיקון (בקשה מפורשת - "לא רקע שהוא לא שקוף מאחורי
            הסטורי שלי"): הרקע הלבן על כל העמודה (rounded-2xl,
            padding) היה תיקון-יתר - זה כן נראה כמו "קופסה" נראית
            לעין, לא כמו שקיפות. חוזר לעמודה שקופה רגילה, בלי רקע
            כלל - כמו שאושר קודם לגבי העיגול עצמו (שנשאר עם המילוי
            האטום שלו בלבד, לא משהו נוסף מסביבו). */}
        <div className="pointer-events-auto flex w-[92px] shrink-0 flex-col items-center gap-2">
          {/* רק התמונה מורמת - הטקסט מתחת לא זז, נשאר על אותו
              baseline כמו כל שאר הטקסטים (בקשה מפורשת, סעיף 8). */}
          {/* *** תיקון (בקשה מפורשת - "החלק העליון של הסטורי שלי
              חתוך"): transform: translateY, לא margin שלילי - margin
              שלילי יכול "למשוך" את האלמנט אל מחוץ לתיבת-התוכן של
              ההורה בצורה שגורמת לגזירה ע"י overflow/מדידת-גובה של
              אבות בשרשרת; translateY מזיז רק את הציור עצמו, לא את
              תיבת-הפריסה - בלי הסיכון הזה. */}
          <span className="relative" style={{ transform: "translateY(-4px)" }}>
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
          <button type="button" onClick={handleMyStoryClick} className="flex w-full justify-center">
            {/* כיתוב פשוט, זהה בדיוק לכיתובי שאר הסטוריז - בלי
                רקע/כרית משלו (בקשה מפורשת - שקוף לגמרי). */}
            <span className="w-full truncate text-center text-[11.5px] font-bold text-ink">
              {selfEntry ? (viewerName?.trim() || "הסטורי שלי") : "צור סטורי"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
