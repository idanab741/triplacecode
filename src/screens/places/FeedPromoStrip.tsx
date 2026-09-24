"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useSurpriseMe } from "@/hooks/useSurpriseMe";

type Promo = {
  id: "surprise" | "runtrippy" | "my-trips" | "hot";
  /** לאן מנווטים בלחיצה. בלי href - הבאנר מפעיל את "תפתיעו אותי". */
  href?: string;
  image: string;
  alt: string;
  /** יחס רוחב/גובה אמיתי של התמונה - כדי שכל באנר יוצג בשלמותו באותו גובה. */
  ratio: number;
};

/** *** סדר מפורש (בקשה מפורשת): RunTrippy -> הבחירות שלי -> תפתיעו אותי -> כל מה שחם (עמוד /hot). */
const PROMOS: Promo[] = [
  {
    id: "runtrippy",
    href: "/test-game",
    image: "/images/home/feed-promo-runtrippy.webp",
    alt: "RunTrippy - המשחק שלנו",
    ratio: 1600 / 360,
  },
  {
    id: "my-trips",
    href: "/trips?filter=all",
    image: "/images/home/feed-promo-my-trips.webp",
    alt: "הבחירות שלי",
    ratio: 1600 / 359,
  },
  {
    id: "surprise",
    image: "/images/home/feed-promo-surprise.webp",
    alt: "בא לכם לצאת לטייל עכשיו? תפתיעו אותי",
    ratio: 1600 / 345,
  },
  {
    id: "hot",
    href: "/hot",
    image: "/images/home/feed-promo-hot.webp",
    alt: "כל מה שחם",
    ratio: 1600 / 366,
  },
];

/** גובה אחיד לכל הבאנרים בפס (px). הרוחב נגזר מהיחס של כל תמונה. */
const PROMO_HEIGHT = 66;
/** מרווח בין באנרים, וגם המרווח מקצה המסך (px). שווים בכוונה - כך הבאנר הקודם
 *  נמצא בדיוק מחוץ למסך ואף פעם לא "מציץ" מימין. */
const GAP = 12;
/** מעבר לבאנר הבא כל X מילישניות. */
const AUTOPLAY_MS = 6000;
/** משך תנועת המעבר. */
const SLIDE_MS = 450;
/** כמה פיקסלים צריך לגרור כדי לעבור באנר (פחות מזה - חוזר למקום). */
const SWIPE_THRESHOLD = 40;

const WIDTHS = PROMOS.map((p) => Math.round(PROMO_HEIGHT * p.ratio));

/**
 * המסילה: [עותק של האחרון, ...כל הבאנרים, עותק של הראשון]. מתחילים ב-1 (הבאנר הראשון האמיתי).
 * הגענו לעותק שבקצה? מיד בסוף התנועה מחליפים - בלי אנימציה - לבאנר האמיתי הזהה. מה שמוצג
 * על המסך באותו רגע זהה פיקסל-לפיקסל, וכל התמונות כבר טעונות מראש - אז אין שום הבהוב.
 */
const TRACK = [PROMOS.length - 1, ...PROMOS.map((_, i) => i), 0];
const TRACK_WIDTHS = TRACK.map((i) => WIDTHS[i]);

/** כמה צריך להזיז את המסילה כדי שהפריט באינדקס הנתון יעמוד בקצה הימני (RTL). */
function offsetOf(trackIndex: number) {
  let sum = 0;
  for (let i = 0; i < trackIndex; i++) sum += TRACK_WIDTHS[i] + GAP;
  return sum;
}

/**
 * *** בקשה מפורשת - פס קידום מתחת ל"עבורך / חברים" (בסגנון ה-"is live" של X): באנר אחד
 * זז בכל פעם, כל 6 שניות, בלופ אינסופי - "שינועו אחד אחרי השני" ו"שלא ירצד".
 * *** תיקון ריצוד: הגרסה הקודמת גללה (scroll) לעותקים משוכפלים וקפצה חזרה - העותקים נטענו
 * בעצלות (lazy), אז במעבר מהאחרון לראשון התמונה הבהבה. עכשיו: transform חלק, כל התמונות
 * eager, וההחלפה לעותק נעשית רק כשהוא זהה למה שעל המסך.
 * נגיעה/החלקה ידנית עובדת (ימינה/שמאלה), ואחריה הגלילה האוטומטית חוזרת רק אחרי 6 שניות.
 */
export function FeedPromoStrip() {
  const router = useRouter();
  const { surprise, loading } = useSurpriseMe();

  const [index, setIndex] = useState(1);
  const [animate, setAnimate] = useState(false);
  const [drag, setDrag] = useState(0);

  const indexRef = useRef(1);
  const dragRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const busyRef = useRef(false);

  /** מעבר מונפש לאינדקס במסילה, ובסוף - תיקון שקוף אם נחתנו על עותק. */
  const goTo = useCallback((next: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAnimate(true);
    indexRef.current = next;
    setIndex(next);
    window.setTimeout(() => {
      let real = next;
      if (next >= TRACK.length - 1) real = 1;
      else if (next <= 0) real = TRACK.length - 2;
      if (real !== next) {
        setAnimate(false);
        indexRef.current = real;
        setIndex(real);
      }
      busyRef.current = false;
    }, SLIDE_MS + 30);
  }, []);

  // הגלילה האוטומטית - באנר אחד כל 6 שניות.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden || dragStartRef.current) return;
      if (Date.now() - lastInteractionRef.current < AUTOPLAY_MS) return;
      goTo(indexRef.current + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [goTo]);

  // ───────── החלקה ידנית ─────────

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (busyRef.current) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
    lastInteractionRef.current = Date.now();
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!draggedRef.current) {
      // גלילה אנכית של העמוד - לא נוגעים.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
        dragStartRef.current = null;
        return;
      }
      if (Math.abs(dx) < 6) return;
      draggedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setAnimate(false);
    }
    dragRef.current = dx;
    setDrag(dx);
  }

  function onPointerEnd() {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    lastInteractionRef.current = Date.now();
    if (!draggedRef.current) return;
    const dx = dragRef.current;
    dragRef.current = 0;
    setDrag(0);
    // RTL: הבאנר הבא נמצא משמאל. התוכן זז עם האצבע - גרירה ימינה מכניסה את הבא,
    // גרירה שמאלה מחזירה לקודם (בדיוק כמו התנועה האוטומטית, שזזה ימינה).
    if (dx >= SWIPE_THRESHOLD) goTo(indexRef.current + 1);
    else if (dx <= -SWIPE_THRESHOLD) goTo(indexRef.current - 1);
    else setAnimate(true);
  }

  function handleClick(promo: Promo) {
    // קליק שהגיע בסוף גרירה - לא נחשב לחיצה.
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (promo.href) {
      router.push(promo.href);
      return;
    }
    void surprise();
  }

  return (
    <div className="overflow-hidden border-b border-black/[0.07] py-2.5">
      <div
        className="flex w-max select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          gap: GAP,
          marginInlineStart: GAP,
          touchAction: "pan-y",
          transform: `translate3d(${offsetOf(index) + drag}px, 0, 0)`,
          transition: animate && drag === 0 ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
          willChange: "transform",
        }}
      >
        {TRACK.map((promoIndex, i) => {
          const promo = PROMOS[promoIndex];
          const isClone = i === 0 || i === TRACK.length - 1;
          const busy = promo.id === "surprise" && loading;
          return (
            <button
              key={`${promo.id}-${i}`}
              type="button"
              onClick={() => handleClick(promo)}
              disabled={busy}
              aria-busy={busy}
              aria-label={promo.alt}
              aria-hidden={isClone || undefined}
              tabIndex={isClone ? -1 : 0}
              className="relative shrink-0 overflow-hidden rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-places-purple)] focus-visible:ring-offset-2"
              style={{ height: PROMO_HEIGHT, width: WIDTHS[promoIndex], opacity: busy ? 0.6 : 1, transition: "opacity 150ms" }}
            >
              {/* unoptimized: התמונה כבר מוכנה בגודל ובאיכות הנכונים - בלי דחיסה חוזרת.
                  loading=eager לכולן (כולל העותקים) - אף באנר לא נטען "באמצע" מעבר. */}
              <Image
                src={promo.image}
                alt=""
                width={1600}
                height={Math.round(1600 / promo.ratio)}
                unoptimized
                loading="eager"
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
