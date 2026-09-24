"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface SearchIntroOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

type StepKey = "search" | "swipe" | "actions";

interface StepDef {
  key: StepKey;
  title: string;
  body: string;
  radius: number;
  pad: number;
  icon: ReactNode;
}

const ICON_PROPS = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const STEPS: StepDef[] = [
  {
    key: "search",
    title: "בחרו יעד",
    body: "חפשו עיר או מדינה בשורת החיפוש, או לחצו על הנעץ כדי להשתמש במיקום הנוכחי שלכם.",
    radius: 32,
    pad: 6,
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
    ),
  },
  {
    key: "swipe",
    title: "החליקו על המקומות",
    body: "ימינה למקומות שאהבתם, שמאלה לאלה שפחות. לחיצה על אמצע הכרטיסייה פותחת את עמוד המקום, ולחיצה בצדדים מחליפה תמונה.",
    radius: 30,
    pad: 4,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 12h16" />
        <path d="m8 8-4 4 4 4" />
        <path d="m16 8 4 4-4 4" />
      </svg>
    ),
  },
  {
    key: "actions",
    title: "שמרו לטיול שלכם",
    body: "הלב שומר את המקום, ה-X מדלג עליו, וכפתור החזרה מבטל את הפעולה האחרונה. כל מה שאהבתם נאסף לטיול אחד.",
    radius: 60,
    pad: 6,
    icon: (
      <svg {...ICON_PROPS} fill="#fff">
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
    ),
  },
];

const NAV_SPACE = 100; // גובה הבר התחתון + אוויר, כשהבועה נאלצת לשבת בתחתית המסך.

function boxOf(el: Element | null | undefined, pad: number): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

function centerOf(el: Element | null | undefined): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * *** שדרוג (בקשה מפורשת - "יותר אנימטיבי, יותר רציני ומקצועי"): הסבר
 * מודרך בן 3 שלבים מעל עמוד הבית, במקום בועה סטטית אחת:
 *  1) בחרו יעד - זרקור על שורת החיפוש, עם אינדיקטור נגיעה שלוחץ על החיפוש ועל הנעץ.
 *  2) החליקו - זרקור על כרטיסיית ההחלקה, עם אינדיקטור נגיעה שגורר ימינה (לב)
 *     ושמאלה (X) - אותם חותמות בדיוק שמופיעות בהחלקה האמיתית.
 *  3) שמרו - זרקור על כפתורי הלב/X/חזרה, עם לחיצה מונפשת ולבבות עולים.
 * הזרקור הוא חור אמיתי בעמעום (box-shadow ענק), שנע ומשנה גודל בין השלבים
 * באנימציה חלקה; הבועה עוברת אחריו. התקדמות ב"הבא"/"דלג" - לא נסגר בלחיצה
 * מקרית. כל האנימציות ב-CSS בלבד, ומכובות למי שהגדיר "הפחתת תנועה".
 *
 * הגלילה למעלה (smooth) מופעלת ע"י הקורא; כאן מחכים שתסתיים, ואז מודדים
 * (כדי שהזרקור יהיה במקום המדויק), ואז ננעלת הגלילה.
 */
export function SearchIntroOverlay({ open, onClose }: SearchIntroOverlayProps) {
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [boxes, setBoxes] = useState<(Box | null)[]>([null, null, null]);
  const [pin, setPin] = useState<Point | null>(null);
  const [heart, setHeart] = useState<Point | null>(null);
  const [nope, setNope] = useState<Point | null>(null);
  const [cardHeight, setCardHeight] = useState(260);
  const [viewport, setViewport] = useState({ w: 390, h: 800 });
  const cardRef = useRef<HTMLDivElement>(null);

  const measureAll = useCallback(() => {
    const searchEl = document.querySelector("[data-home-search]");
    const frontCard = document.querySelector("[data-tripmatch-front-card]");
    const heartBtn = document.querySelector('button[aria-label="אהבתי"]');
    const nopeBtn = document.querySelector('button[aria-label="דלג"]');
    const pinBtn = document.querySelector('[data-home-search] [title="המיקום שלי"]');

    setBoxes([boxOf(searchEl, STEPS[0].pad), boxOf(frontCard, STEPS[1].pad), boxOf(heartBtn?.parentElement, STEPS[2].pad)]);
    setPin(centerOf(pinBtn));
    setHeart(centerOf(heartBtn));
    setNope(centerOf(nopeBtn));
    setViewport({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  // איפוס ומדידה בכל פתיחה - מחכים לסיום הגלילה למעלה.
  useEffect(() => {
    if (!open) {
      setReady(false);
      setStep(0);
      return;
    }
    let raf = 0;
    let frames = 0;
    function waitForTop() {
      const settled = window.scrollY <= 1;
      if (settled || frames > 90) {
        measureAll();
        setReady(true);
        return;
      }
      frames += 1;
      raf = requestAnimationFrame(waitForTop);
    }
    raf = requestAnimationFrame(waitForTop);
    return () => cancelAnimationFrame(raf);
  }, [open, measureAll]);

  useEffect(() => {
    if (!open || !ready) return;
    window.addEventListener("resize", measureAll);
    return () => window.removeEventListener("resize", measureAll);
  }, [open, ready, measureAll]);

  // נעילת גלילה בזמן ההסבר.
  useEffect(() => {
    if (!open || !ready) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, ready]);

  // גובה הבועה בפועל (משתנה לפי אורך הטקסט) - לחישוב מיקומה.
  useEffect(() => {
    if (!ready) return;
    const el = cardRef.current;
    if (el) setCardHeight(el.offsetHeight);
  }, [step, ready]);

  if (!open) return null;

  const def = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // אם היעד לא נמצא (למשל הכרטיסים עוד לא נטענו) - זרקור ברירת מחדל במרכז.
  const fallback: Box = {
    top: viewport.h * 0.3,
    left: 24,
    width: viewport.w - 48,
    height: viewport.h * 0.28,
  };
  const spot = boxes[step] ?? fallback;

  // מיקום הבועה: בשלב 1 מתחת לזרקור; אחרת מעליו אם יש מקום; ואם לא - בתחתית המסך.
  const gap = 18;
  const below = spot.top + spot.height + gap;
  const above = spot.top - cardHeight - gap;
  let cardTop: number;
  if (step === 0 && below + cardHeight < viewport.h - 16) cardTop = below;
  else if (above > 76) cardTop = above;
  else cardTop = viewport.h - cardHeight - NAV_SPACE;

  // מיקומי אינדיקטור הנגיעה - יחסית לפינה של הזרקור.
  const local = (p: Point | null): Point | null => (p ? { x: p.x - spot.left, y: p.y - spot.top } : null);
  const pinLocal = local(pin);
  const heartLocal = local(heart);
  const nopeLocal = local(nope);
  const swipeY = Math.max(24, Math.min(spot.height * 0.32, cardTop - spot.top - 44));

  const dotStyle: CSSProperties =
    step === 0
      ? ({
          "--sx": `${spot.width * 0.58}px`,
          "--sy": `${spot.height / 2}px`,
          "--px": `${pinLocal?.x ?? 34}px`,
          animation: "sio-tap-search 4.2s ease-in-out 0.6s infinite",
        } as CSSProperties)
      : step === 1
        ? ({
            "--cx": `${spot.width / 2}px`,
            "--cy": `${swipeY}px`,
            "--dx": `${Math.min(spot.width * 0.3, 110)}px`,
            animation: "sio-swipe 5.2s ease-in-out 0.6s infinite",
          } as CSSProperties)
        : ({
            "--hx": `${heartLocal?.x ?? spot.width * 0.8}px`,
            "--hy": `${heartLocal?.y ?? spot.height / 2}px`,
            "--nx": `${nopeLocal?.x ?? spot.width * 0.2}px`,
            "--ny": `${nopeLocal?.y ?? spot.height / 2}px`,
            animation: "sio-actions 4.6s ease-in-out 0.6s infinite",
          } as CSSProperties);

  return (
    <div className="fixed inset-0 z-[60] touch-none" role="dialog" aria-modal="true" aria-label="איך מתחילים לבנות טיול">
      <style>{CSS}</style>

      {ready && (
        <>
          {/* הזרקור: חור אמיתי בעמעום. נע ומשנה גודל בין השלבים. */}
          <div
            aria-hidden="true"
            className="sio-fade fixed"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              borderRadius: def.radius,
              boxShadow: "0 0 0 100vmax rgba(6, 15, 36, 0.78)",
              transition:
                "top 620ms cubic-bezier(0.22,1,0.36,1), left 620ms cubic-bezier(0.22,1,0.36,1), width 620ms cubic-bezier(0.22,1,0.36,1), height 620ms cubic-bezier(0.22,1,0.36,1), border-radius 620ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            {/* טבעת מתפשטת סביב הזרקור */}
            <span className="sio-ring pointer-events-none absolute inset-0" style={{ borderRadius: def.radius, transition: "border-radius 620ms cubic-bezier(0.22,1,0.36,1)" }} />
            <span className="sio-ring sio-ring-2 pointer-events-none absolute inset-0" style={{ borderRadius: def.radius, transition: "border-radius 620ms cubic-bezier(0.22,1,0.36,1)" }} />

            <div className="pointer-events-none absolute inset-0 overflow-visible" key={def.key}>
              {/* אינדיקטור נגיעה */}
              <span className="sio-dot" style={dotStyle} />

              {def.key === "swipe" && (
                <>
                  <span
                    className="sio-stamp sio-stamp-like absolute"
                    style={{ right: 10, top: spot.height * 0.28, animation: "sio-stamp-like 5.2s ease-in-out 0.6s infinite" }}
                  >
                    <Image src="/images/tripmatch/action-like.png" alt="" width={84} height={84} />
                  </span>
                  <span
                    className="sio-stamp sio-stamp-nope absolute"
                    style={{ left: 10, top: spot.height * 0.28, animation: "sio-stamp-nope 5.2s ease-in-out 0.6s infinite" }}
                  >
                    <Image src="/images/tripmatch/action-nope.png" alt="" width={84} height={84} />
                  </span>
                </>
              )}

              {def.key === "actions" && heartLocal && (
                <>
                  {[0, 1, 2].map((i) => (
                    <svg
                      key={i}
                      className="sio-float absolute"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      style={
                        {
                          left: heartLocal.x - 8 + (i - 1) * 14,
                          top: heartLocal.y - 8,
                          animation: `sio-float 4.6s ease-out ${0.6 + i * 0.09}s infinite`,
                        } as CSSProperties
                      }
                    >
                      <path fill="#1877F2" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2Z" />
                    </svg>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* הבועה */}
          <div
            className="fixed inset-x-4 mx-auto max-w-md"
            style={{ top: cardTop, transition: "top 620ms cubic-bezier(0.22,1,0.36,1)" }}
          >
            <div ref={cardRef} className="sio-card relative overflow-hidden rounded-[26px] bg-white shadow-[0_28px_70px_-12px_rgba(0,20,60,0.55)]">
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))" }} />

              <div className="p-5 pb-4" key={def.key}>
                <div className="sio-step flex items-start gap-3.5">
                  <div
                    className="sio-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_8px_18px_-6px_rgba(24,119,242,0.7)]"
                    style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                  >
                    {def.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-accent">
                      שלב {step + 1} מתוך {STEPS.length}
                    </p>
                    <h3 className="mt-0.5 text-[19px] font-extrabold leading-tight tracking-tight text-ink">{def.title}</h3>
                  </div>
                </div>

                <p className="sio-step mt-3 text-[14px] leading-relaxed text-ink-secondary" style={{ animationDelay: "60ms" }}>
                  {def.body}
                </p>
              </div>

              {/* התקדמות */}
              <div className="flex gap-1.5 px-5" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-ink-secondary/15">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: i <= step ? "100%" : "0%",
                        background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))",
                        transition: "width 520ms cubic-bezier(0.22,1,0.36,1)",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 p-5 pt-4">
                <button
                  type="button"
                  onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
                  className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 text-white shadow-[0_10px_22px_-8px_rgba(24,119,242,0.8)] transition active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                >
                  {isLast ? "בואו נתחיל" : "הבא"}
                  {!isLast && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 12H5" />
                      <path d="m11 6-6 6 6 6" />
                    </svg>
                  )}
                </button>
                {!isLast && (
                  <button type="button" onClick={onClose} className="px-2 py-3 text-sm font-semibold text-ink-secondary">
                    דלג
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.sio-fade{animation:sio-fade-in 380ms ease-out both}
.sio-card{animation:sio-card-in 520ms cubic-bezier(0.22,1,0.36,1) both}
.sio-step{animation:sio-step-in 460ms cubic-bezier(0.22,1,0.36,1) both}
.sio-badge{animation:sio-bob 3.2s ease-in-out infinite}
.sio-ring{border:2px solid rgba(255,255,255,0.95);animation:sio-ring 2s ease-out infinite}
.sio-ring-2{animation-delay:1s}
.sio-dot{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:9999px;
  background:radial-gradient(circle at 35% 30%,#fff,rgba(255,255,255,0.78));
  box-shadow:0 8px 20px rgba(0,0,0,0.38),0 0 0 6px rgba(255,255,255,0.28);opacity:0;will-change:transform,opacity}
.sio-stamp{opacity:0;will-change:transform,opacity;filter:drop-shadow(0 8px 14px rgba(0,0,0,0.35))}
.sio-float{opacity:0;will-change:transform,opacity}

@keyframes sio-fade-in{from{opacity:0}to{opacity:1}}
@keyframes sio-card-in{from{opacity:0;transform:translateY(22px) scale(0.97)}to{opacity:1;transform:none}}
@keyframes sio-step-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes sio-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes sio-ring{0%{transform:scale(1);opacity:0.9}100%{transform:scale(1.09);opacity:0}}

@keyframes sio-tap-search{
  0%{opacity:0;transform:translate3d(var(--sx),calc(var(--sy) + 26px),0) scale(1)}
  10%{opacity:1;transform:translate3d(var(--sx),var(--sy),0) scale(1)}
  22%{transform:translate3d(var(--sx),var(--sy),0) scale(0.8);box-shadow:0 8px 20px rgba(0,0,0,0.38),0 0 0 16px rgba(255,255,255,0.4)}
  30%{transform:translate3d(var(--sx),var(--sy),0) scale(1)}
  52%{transform:translate3d(var(--px),var(--sy),0) scale(1)}
  62%{transform:translate3d(var(--px),var(--sy),0) scale(0.8);box-shadow:0 8px 20px rgba(0,0,0,0.38),0 0 0 16px rgba(255,255,255,0.4)}
  70%{transform:translate3d(var(--px),var(--sy),0) scale(1)}
  88%{opacity:1}
  100%{opacity:0;transform:translate3d(var(--px),calc(var(--sy) + 18px),0) scale(1)}
}
@keyframes sio-swipe{
  0%{opacity:0;transform:translate3d(var(--cx),calc(var(--cy) + 22px),0) scale(1)}
  8%{opacity:1;transform:translate3d(var(--cx),var(--cy),0) scale(1)}
  15%{transform:translate3d(var(--cx),var(--cy),0) scale(0.84)}
  38%{transform:translate3d(calc(var(--cx) + var(--dx)),calc(var(--cy) - 8px),0) scale(0.84) rotate(8deg)}
  46%{opacity:0;transform:translate3d(calc(var(--cx) + var(--dx) + 14px),calc(var(--cy) - 10px),0) scale(1) rotate(10deg)}
  54%{opacity:0;transform:translate3d(var(--cx),var(--cy),0) scale(1)}
  60%{opacity:1;transform:translate3d(var(--cx),var(--cy),0) scale(1)}
  66%{transform:translate3d(var(--cx),var(--cy),0) scale(0.84)}
  88%{transform:translate3d(calc(var(--cx) - var(--dx)),calc(var(--cy) - 8px),0) scale(0.84) rotate(-8deg)}
  96%{opacity:0;transform:translate3d(calc(var(--cx) - var(--dx) - 14px),calc(var(--cy) - 10px),0) scale(1) rotate(-10deg)}
  100%{opacity:0}
}
@keyframes sio-stamp-like{
  0%,30%{opacity:0;transform:scale(0.5) rotate(-10deg)}
  40%{opacity:1;transform:scale(1.15) rotate(6deg)}
  46%{opacity:1;transform:scale(1) rotate(0)}
  54%,100%{opacity:0;transform:scale(0.9)}
}
@keyframes sio-stamp-nope{
  0%,80%{opacity:0;transform:scale(0.5) rotate(10deg)}
  90%{opacity:1;transform:scale(1.15) rotate(-6deg)}
  95%{opacity:1;transform:scale(1) rotate(0)}
  100%{opacity:0;transform:scale(0.9)}
}
@keyframes sio-actions{
  0%{opacity:0;transform:translate3d(var(--hx),calc(var(--hy) + 34px),0) scale(1)}
  12%{opacity:1;transform:translate3d(var(--hx),var(--hy),0) scale(1)}
  22%{transform:translate3d(var(--hx),var(--hy),0) scale(0.8);box-shadow:0 8px 20px rgba(0,0,0,0.38),0 0 0 16px rgba(255,255,255,0.4)}
  30%{transform:translate3d(var(--hx),var(--hy),0) scale(1)}
  52%{transform:translate3d(var(--nx),var(--ny),0) scale(1)}
  62%{transform:translate3d(var(--nx),var(--ny),0) scale(0.8);box-shadow:0 8px 20px rgba(0,0,0,0.38),0 0 0 16px rgba(255,255,255,0.4)}
  70%{transform:translate3d(var(--nx),var(--ny),0) scale(1)}
  88%{opacity:1}
  100%{opacity:0;transform:translate3d(var(--nx),calc(var(--ny) + 20px),0) scale(1)}
}
@keyframes sio-float{
  0%,20%{opacity:0;transform:translateY(0) scale(0.6)}
  26%{opacity:1;transform:translateY(-8px) scale(1)}
  44%{opacity:0;transform:translateY(-58px) scale(1.2)}
  100%{opacity:0}
}
@media (prefers-reduced-motion: reduce){
  .sio-ring,.sio-badge,.sio-dot,.sio-stamp,.sio-float{animation:none !important}
  .sio-dot,.sio-stamp,.sio-float{display:none}
}
`;
