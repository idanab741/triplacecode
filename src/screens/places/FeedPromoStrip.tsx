"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSurpriseMe } from "@/hooks/useSurpriseMe";

type Promo = {
  id: "surprise" | "runtrippy" | "my-trips";
  /** לאן מנווטים בלחיצה. בלי href - הבאנר מפעיל את "תפתיעו אותי". */
  href?: string;
  image: string;
  alt: string;
  /** יחס רוחב/גובה אמיתי של התמונה - כדי שכל באנר יוצג בשלמותו באותו גובה. */
  ratio: number;
};

const PROMOS: Promo[] = [
  {
    id: "surprise",
    image: "/images/home/feed-promo-surprise.webp",
    alt: "בא לכם לצאת לטייל עכשיו? תפתיעו אותי",
    ratio: 1600 / 345,
  },
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
];

/** גובה אחיד לכל הבאנרים בפס (px). הרוחב נגזר מהיחס של כל תמונה. */
const PROMO_HEIGHT = 66;
/** מרווח בין באנרים (px) - חייב להתאים ל-gap של הפס. */
const GAP = 10;
/** ריפוד הצדדים של הפס (px) - חייב להתאים ל-padding של הפס. */
const SIDE_PADDING = 16;
/** גלילה אוטומטית לבאנר הבא כל X מילישניות. */
const AUTOPLAY_MS = 6000;

/**
 * הלולאה האינסופית: הרשימה מרונדרת 3 פעמים ברצף, ומתחילים בעותק האמצעי.
 * אחרי כל גלילה (אוטומטית או ידנית) - אם יצאנו מהעותק האמצעי, קופצים
 * מיידית (בלי אנימציה) לאותו באנר בדיוק בעותק האמצעי. התמונה על המסך
 * זהה לחלוטין, כך שהקפיצה לא נראית - והגלילה ממשיכה קדימה לנצח.
 */
const COPIES = 3;
const LOOPED = Array.from({ length: COPIES }, (_, copy) => PROMOS.map((p) => ({ promo: p, copy }))).flat();

/**
 * *** בקשה מפורשת - פס קידום אופקי מתחת ל"עבורך / חברים", בסגנון הפס של
 * X ("... is live"), עם גלילה אוטומטית כל 6 שניות בלופ אינסופי.
 * - "בא לכם לצאת עכשיו?" -> אותה לוגיקת "תפתיעו אותי" של TripMatch (useSurpriseMe).
 * - RunTrippy -> עמוד המשחק (/test-game).
 * - "הבחירות שלי" -> עמוד כל הטיולים (/trips?filter=all).
 * נגיעה/גלילה ידנית עוצרת את הגלילה האוטומטית, והיא חוזרת 6 שניות אחרי.
 */
export function FeedPromoStrip() {
  const router = useRouter();
  const { surprise, loading } = useSurpriseMe();

  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastInteractionRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** המרחק (px) שצריך לגלול כדי שהבאנר באינדקס הנתון ייצמד לנקודת ה-snap
   *  (הקצה הימני, כי העמוד RTL). עובד בלי תלות במוסכמת ה-scrollLeft של RTL. */
  const deltaTo = useCallback((index: number) => {
    const track = trackRef.current;
    const item = itemRefs.current[index];
    if (!track || !item) return 0;
    const snapLine = track.getBoundingClientRect().right - SIDE_PADDING;
    return item.getBoundingClientRect().right - snapLine;
  }, []);

  /** הבאנר שכרגע צמוד לנקודת ה-snap. */
  const currentIndex = useCallback(() => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < LOOPED.length; i++) {
      const d = Math.abs(deltaTo(i));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }, [deltaTo]);

  /** אם יצאנו מהעותק האמצעי - קפיצה שקופה לאותו באנר בעותק האמצעי. */
  const normalize = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const n = PROMOS.length;
    const idx = currentIndex();
    if (idx >= n && idx < 2 * n) return;
    const target = n + (idx % n);
    track.scrollBy({ left: deltaTo(target), behavior: "instant" as ScrollBehavior });
  }, [currentIndex, deltaTo]);

  // מיקום התחלתי: הבאנר הראשון בעותק האמצעי (לפני הציור, בלי הבהוב).
  useLayoutEffect(() => {
    trackRef.current?.scrollBy({ left: deltaTo(PROMOS.length), behavior: "instant" as ScrollBehavior });
  }, [deltaTo]);

  // אחרי שהגלילה נרגעת - נרמול ללולאה.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(normalize, 150);
    };
    const onInteract = () => {
      lastInteractionRef.current = Date.now();
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("pointerdown", onInteract, { passive: true });
    track.addEventListener("touchstart", onInteract, { passive: true });
    track.addEventListener("wheel", onInteract, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("pointerdown", onInteract);
      track.removeEventListener("touchstart", onInteract);
      track.removeEventListener("wheel", onInteract);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [normalize]);

  // הגלילה האוטומטית.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastInteractionRef.current < AUTOPLAY_MS) return;
      const track = trackRef.current;
      if (!track) return;
      const next = Math.min(currentIndex() + 1, LOOPED.length - 1);
      track.scrollBy({ left: deltaTo(next), behavior: "smooth" });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [currentIndex, deltaTo]);

  function handleClick(promo: Promo) {
    if (promo.href) {
      router.push(promo.href);
      return;
    }
    void surprise();
  }

  return (
    <div className="border-b border-black/[0.07]">
      <div
        ref={trackRef}
        className="stories-rail-track flex snap-x snap-mandatory overflow-x-auto py-2.5"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          gap: GAP,
          paddingInline: SIDE_PADDING,
          scrollPaddingInline: SIDE_PADDING,
        }}
      >
        {LOOPED.map(({ promo, copy }, i) => {
          const busy = promo.id === "surprise" && loading;
          const isClone = copy !== 1;
          const width = Math.round(PROMO_HEIGHT * promo.ratio);
          return (
            <button
              key={`${promo.id}-${copy}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              onClick={() => handleClick(promo)}
              disabled={busy}
              aria-busy={busy}
              aria-label={promo.alt}
              aria-hidden={isClone || undefined}
              tabIndex={isClone ? -1 : 0}
              className="relative shrink-0 snap-start overflow-hidden rounded-[16px] outline-none transition-[transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-places-purple)] focus-visible:ring-offset-2 active:scale-[0.98]"
              style={{ height: PROMO_HEIGHT, width, opacity: busy ? 0.6 : 1 }}
            >
              {/* unoptimized: התמונה כבר מוכנה בגודל ובאיכות הנכונים - בלי דחיסה
                  חוזרת של next/image (ברירת מחדל quality 75), שהיא מה שטשטש אותה. */}
              <Image
                src={promo.image}
                alt=""
                width={1600}
                height={Math.round(1600 / promo.ratio)}
                unoptimized
                priority={copy === 1}
                draggable={false}
                className="h-full w-full select-none object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
