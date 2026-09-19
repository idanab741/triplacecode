"use client";

import { useEffect, useState, type CSSProperties } from "react";

interface LikedDialogProps {
  placeName: string;
  /** תמונת המקום שנאהב - מוצגת בריבוע המעוגל. */
  placeImageUrl?: string;
  /** כמה מקומות כבר בטיול (כולל זה). */
  likedCount?: number;
  /** נקרא כשההודעה נעלמת (אוטומטית או בלחיצה) - ממשיכים להחליק. */
  onContinue: () => void;
  /** "לטיול שלי" - פותח את עמוד הטיול. */
  onFinish: () => void;
}

/** כמה זמן ההודעה נשארת (ms) - הוארך (בקשה מפורשת - "עובר מהר מדי"). */
const VISIBLE_MS = 6500;
const EXIT_MS = 420;
/** גובה ברירת המחדל (קומפקטי) כשאין שורת חיפוש גלויה - שורה אחת בלבד. */
const DEFAULT_HEIGHT = 56;
/** מגובה זה ומעלה - פריסה מלאה (שתי השורות של הבר: כפתורים + חיפוש). */
const TALL_MIN_HEIGHT = 84;

/** כיווני פיצוץ הלבבות (dx, dy ב-px) והשהיה. */
const BURST = [
  { dx: -26, dy: -22, delay: 0 },
  { dx: 4, dy: -32, delay: 50 },
  { dx: 30, dy: -20, delay: 100 },
  { dx: -34, dy: -2, delay: 40 },
  { dx: 36, dy: 2, delay: 90 },
];

interface Placement {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** מודד את אזור התוכן של הבר התכלת בעמוד הבית: מהקצה העליון של כפתורי
 *  ההתראות/הצ'אט ועד **הקצה התחתון של שורת החיפוש** (בקשה מפורשת), ובין קצוות
 *  הכפתורים לרוחב (שהם גם קצוות שורת החיפוש). אם החיפוש לא גלוי (מכווץ בגלילה)
 *  - רק השורה הראשונה (קומפקטי). null אם אין בר כזה (עמוד /tripmatch העצמאי). */
function measureHeaderBand(): Placement | null {
  const bar = document.querySelector("[data-home-top-bar]");
  const header = bar?.querySelector("header");
  if (!bar || !header) return null;

  const hr = header.getBoundingClientRect();
  const cs = getComputedStyle(header);
  const rowTop = hr.top + parseFloat(cs.paddingTop || "0");
  const left = hr.left + parseFloat(cs.paddingLeft || "0");
  const width = hr.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");

  let height = DEFAULT_HEIGHT;
  const search = document.querySelector("[data-home-search]");
  if (search) {
    const sr = search.getBoundingClientRect();
    const candidate = sr.bottom - rowTop;
    // רק אם החיפוש גלוי במלואו (לא מכווץ בגלילה) והמדידה סבירה.
    if (sr.height > 30 && candidate >= TALL_MIN_HEIGHT && candidate <= 140) height = candidate;
  }
  return { top: rowTop, left, width, height };
}

/**
 * *** עיצוב מחדש (בקשה מפורשת - "העמוד הזה נראה מעפן" ואז: "יותר לאט", "בדיוק
 * מהקצה העליון של שני הכפתורים עד החלק התחתון של שורת החיפוש"): הודעת "נוסף
 * לטיול שלך" קלילה שלא חוסמת כלום. יושבת בדיוק על אזור התוכן של הבר התכלת -
 * מהקצה העליון של כפתורי ההתראות/הצ'אט ועד הקצה התחתון של שורת החיפוש, ובין
 * הקצוות של שני הכפתורים - ומכסה אותו כל עוד היא מוצגת (כ-104px, פריסה
 * מלאה). כשהחיפוש מכווץ בגלילה - פריסה קומפקטית על השורה הראשונה בלבד.
 * נכנסת באנימציה איטית יותר, נשארת ~6.5 שניות (פס זמן דק בתחתית), ונעלמת
 * לבד או בלחיצה. לייק נוסף מחליף אותה ומאפס את הטיימר (key בעמוד ההורה).
 */
export function LikedDialog({ placeName, placeImageUrl, likedCount, onContinue, onFinish }: LikedDialogProps) {
  const [leaving, setLeaving] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);

  // מדידה חד-פעמית בעליית ההודעה + משוב מישוש קצר (Android).
  useEffect(() => {
    setPlacement(measureHeaderBand());
    try {
      navigator.vibrate?.(14);
    } catch {
      // לא קריטי
    }
  }, []);

  useEffect(() => {
    const hide = window.setTimeout(() => setLeaving(true), VISIBLE_MS);
    return () => window.clearTimeout(hide);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(onContinue, EXIT_MS);
    return () => window.clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const tall = (placement?.height ?? DEFAULT_HEIGHT) >= TALL_MIN_HEIGHT;
  const burstScale = tall ? 1.45 : 1;

  const style: CSSProperties = placement
    ? { top: placement.top, left: placement.left, width: placement.width, height: placement.height }
    : { top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 16, right: 16, height: DEFAULT_HEIGHT };

  return (
    <div className="pointer-events-none fixed z-[55]" style={style}>
      <style>{CSS}</style>

      <div
        role="status"
        aria-live="polite"
        onClick={() => setLeaving(true)}
        className={`pointer-events-auto relative h-full w-full overflow-hidden bg-white shadow-[0_18px_40px_-14px_rgba(10,40,110,0.65)] ring-1 ring-black/5 ${
          tall ? "rounded-[26px]" : "rounded-[20px]"
        } ${
          leaving ? "ld-out" : "ld-in"
        }`}
      >
        <div className={`flex h-full items-center pb-[3px] ${tall ? "gap-4 px-4" : "gap-3 px-2.5"}`}>
          {/* תמונה + לב קופץ + פיצוץ לבבות */}
          <div className={`relative shrink-0 ${tall ? "h-[68px] w-[68px]" : "h-10 w-10"}`}>
            <div
              className={`h-full w-full overflow-hidden bg-bg-secondary ring-2 ring-white shadow-[0_6px_14px_-6px_rgba(10,40,110,0.6)] ${
                tall ? "rounded-[20px]" : "rounded-xl"
              }`}
            >
              {placeImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={placeImageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base">📍</div>
              )}
            </div>

            <div
              className={`ld-pop absolute -bottom-1 -left-1 flex items-center justify-center rounded-full ring-2 ring-white ${
                tall ? "h-7 w-7" : "h-[18px] w-[18px]"
              }`}
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              <svg width={tall ? 14 : 9} height={tall ? 14 : 9} viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#fff" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2Z" />
              </svg>
            </div>

            {BURST.map((b, i) => (
              <svg
                key={i}
                className="ld-burst pointer-events-none absolute -bottom-1 -left-1"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{
                  ["--dx" as string]: `${b.dx * burstScale}px`,
                  ["--dy" as string]: `${b.dy * burstScale}px`,
                  animationDelay: `${300 + b.delay}ms`,
                }}
              >
                <path fill="#3B82F6" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2Z" />
              </svg>
            ))}
          </div>

          {/* טקסט */}
          <div className="min-w-0 flex-1">
            <p className={`whitespace-nowrap font-extrabold leading-tight tracking-tight text-ink ${tall ? "text-[17px]" : "text-[14px]"}`}>
              נוסף לטיול שלך
            </p>
            <p className={`truncate leading-tight text-ink-secondary ${tall ? "mt-1 text-[13.5px]" : "mt-0.5 text-[12px]"}`}>{placeName}</p>
            {likedCount != null && likedCount > 0 && (
              <span
                className={`inline-block rounded-pill bg-accent/10 font-bold text-accent ${
                  tall ? "mt-2 px-2.5 py-0.5 text-[11.5px]" : "hidden"
                }`}
              >
                {likedCount === 1 ? "המקום הראשון בטיול" : `מקום ${likedCount} בטיול`}
              </span>
            )}
          </div>

          {/* פעולה: פתיחת עמוד הטיול */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFinish();
            }}
            className={`shrink-0 rounded-pill font-bold text-white shadow-[0_8px_16px_-8px_rgba(24,119,242,0.9)] transition active:scale-[0.96] ${
              tall ? "px-4 py-3 text-[13.5px]" : "px-3.5 py-2 text-[12.5px]"
            }`}
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            לטיול שלי
          </button>
        </div>

        {/* פס זמן דק - כמה זמן ההודעה עוד תישאר */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.05]" aria-hidden="true">
          <div
            className="ld-timer h-full origin-right"
            style={{
              background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))",
              animationDuration: `${VISIBLE_MS}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ld-in{animation:ld-in 720ms cubic-bezier(0.22,1.15,0.36,1) both}
.ld-out{animation:ld-out ${EXIT_MS}ms ease-in both}
.ld-pop{animation:ld-pop 700ms cubic-bezier(0.34,1.7,0.5,1) 260ms both}
.ld-burst{opacity:0;animation:ld-burst 1000ms ease-out both}
.ld-timer{animation-name:ld-timer;animation-timing-function:linear;animation-fill-mode:both}
@keyframes ld-in{from{opacity:0;transform:translateY(-60%) scale(0.97)}to{opacity:1;transform:none}}
@keyframes ld-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-30%) scale(0.98)}}
@keyframes ld-pop{0%{transform:scale(0) rotate(-20deg)}60%{transform:scale(1.3) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
@keyframes ld-burst{
  0%{opacity:0;transform:translate(0,0) scale(0.4)}
  20%{opacity:1}
  100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.1)}
}
@keyframes ld-timer{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion: reduce){
  .ld-in,.ld-out,.ld-pop{animation-duration:1ms}
  .ld-burst{display:none}
}
`;
