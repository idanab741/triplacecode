"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MONTHLY_TOKEN_ALLOWANCE, TOKEN_COSTS } from "@/constants/tokenCosts";

const BLUE_GRADIENT = "linear-gradient(150deg, #22B8FD, #007CFE)";

/** מונה שעולה מ-0 ליעד (easeOutCubic). מכבד prefers-reduced-motion - קופץ ישר ליעד. */
function useCountUp(target: number, startAt = 0, delayMs = 450, durationMs = 1200): number {
  const [value, setValue] = useState(startAt);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / durationMs);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs, durationMs]);
  return value;
}

const CSS = `
.tx-backdrop { animation:tx-fade .25s ease-out both; }
.tx-sheet { animation:tx-up .5s cubic-bezier(.2,.85,.25,1) both; }
@keyframes tx-fade { from{opacity:0} to{opacity:1} }
@keyframes tx-up { from{transform:translateY(60px); opacity:0} to{transform:none; opacity:1} }

/* פריט שעולה בכניסה, בהשהיה מדורגת (--d) */
.tx-rise { animation:tx-rise .6s cubic-bezier(.2,.85,.25,1) both; animation-delay:var(--d,0s); }
@keyframes tx-rise { from{opacity:0; transform:translateY(18px)} to{opacity:1; transform:none} }

/* מטבעות/נצנצים שצפים למעלה בראש הכרטיס */
.tx-coin { position:absolute; bottom:-14px; color:rgba(255,255,255,.9); animation:tx-float 5.5s linear infinite; animation-delay:var(--d,0s); text-shadow:0 0 12px rgba(255,255,255,.65); }
@keyframes tx-float { 0%{transform:translateY(0) scale(.6) rotate(0); opacity:0} 15%{opacity:1} 100%{transform:translateY(-230px) scale(1.15) rotate(40deg); opacity:0} }

/* הדמות "מציצה" מעל קצה הכרטיס - קפיצה עדינה בכניסה ואחר כך ציפה */
.tx-mascot { animation:tx-pop .8s cubic-bezier(.2,1.3,.3,1) .25s both, tx-bob 3.4s ease-in-out 1.1s infinite; }
@keyframes tx-pop { from{transform:translate(-50%,40%) scale(.85); opacity:0} to{transform:translate(-50%,10.7%) scale(1); opacity:1} }
@keyframes tx-bob { 0%,100%{transform:translate(-50%,10.7%)} 50%{transform:translate(-50%,7%)} }

/* טבעת פועמת מאחורי מונה ה-100 */
.tx-pulse { animation:tx-ring 2.4s ease-out infinite; }
@keyframes tx-ring { 0%{transform:scale(.92); opacity:.55} 100%{transform:scale(1.22); opacity:0} }

/* קו מקווקו שנע בין שלבי ה"איך זה עובד" */
.tx-dash { stroke-dasharray:4 6; animation:tx-dash 1.4s linear infinite; }
@keyframes tx-dash { to{stroke-dashoffset:-20} }

/* אינסוף (∞) שמצויר וחוזר, וברק שעובר על כרטיס המבצע */
.tx-inf { stroke-dasharray:200; stroke-dashoffset:200; animation:tx-draw 2.6s ease-in-out 1s infinite; }
@keyframes tx-draw { 0%{stroke-dashoffset:200} 55%,100%{stroke-dashoffset:0} }
.tx-shine::after { content:""; position:absolute; inset:0; background:linear-gradient(105deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%); transform:translateX(120%); animation:tx-sweep 3.2s ease-in-out 1.4s infinite; pointer-events:none; }
@keyframes tx-sweep { 0%{transform:translateX(120%)} 60%,100%{transform:translateX(-120%)} }

@media (prefers-reduced-motion: reduce) {
  .tx-backdrop,.tx-sheet,.tx-rise,.tx-coin,.tx-mascot,.tx-pulse,.tx-dash,.tx-inf,.tx-shine::after { animation:none !important; }
  .tx-mascot { transform:translate(-50%,10.7%); }
  .tx-inf { stroke-dashoffset:0; }
  .tx-rise { opacity:1; }
}
`;

const COINS = [
  { left: "8%", d: "0s", size: 18 },
  { left: "22%", d: "1.6s", size: 12 },
  { left: "38%", d: "3.1s", size: 16 },
  { left: "58%", d: "0.8s", size: 12 },
  { left: "74%", d: "2.3s", size: 20 },
  { left: "88%", d: "3.9s", size: 14 },
];

function StepIcon({ kind }: { kind: "get" | "use" | "renew" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (kind === "get") {
    return (
      <svg {...common}>
        <rect x="3.5" y="8" width="17" height="12" rx="2.5" />
        <path d="M12 8v12M3.5 13h17M12 8c-1.2-3-4.5-3-4.5-.8 0 1.4 2 .8 4.5.8Zm0 0c1.2-3 4.5-3 4.5-.8 0 1.4-2 .8-4.5.8Z" />
      </svg>
    );
  }
  if (kind === "use") {
    return (
      <svg {...common}>
        <circle cx="5.5" cy="18" r="1.9" />
        <circle cx="18.5" cy="6" r="1.9" />
        <path d="M7 17c3-1 3-5 6-5s3-3 4.5-4.5" strokeDasharray="2 2.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />
    </svg>
  );
}

const STEPS: { kind: "get" | "use" | "renew"; title: string; sub: string }[] = [
  { kind: "get", title: "מקבלים", sub: `${MONTHLY_TOKEN_ALLOWANCE} טריפים כל חודש` },
  { kind: "use", title: "משתמשים", sub: "על פעולות חכמות" },
  { kind: "renew", title: "מתחדשים", sub: "ב־1 לכל חודש" },
];

/**
 * "מה זה טריפים?" - הסבר ברור, אנימטיבי ויפה. נפתח מהכרטיס "100 טריפים" בעמוד התפריט (/profile).
 * מבנה: ראש כחול עם מטבעות שצפים והדמות שמציצה · מה זה (משפט אחד) · מונה 0→100 · 3 שלבים (מקבלים/משתמשים/מתחדשים) ·
 * על מה משתמשים (עם העלויות האמיתיות מ-TOKEN_COSTS) · כרטיס "מבצע הרצה - ללא הגבלה" · כפתור. כל האנימציות ב-CSS/rAF
 * בלבד (בלי ספריות), ומכבדות prefers-reduced-motion.
 */
export function TripsExplainerSheet({ onClose, startCount = 0 }: { onClose: () => void; startCount?: number }) {
  const count = useCountUp(MONTHLY_TOKEN_ALLOWANCE, startCount);

  // נעילת גלילת הרקע + סגירה ב-Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="מה זה טריפים?">
      <style>{CSS}</style>
      <button type="button" aria-label="סגירה" onClick={onClose} className="tx-backdrop absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]" />

      <div className="tx-sheet relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[30px] bg-white">
        {/* ── ראש: גרדיאנט כחול, מטבעות צפים, הדמות מציצה ── */}
        <div className="relative h-[218px] overflow-hidden" style={{ background: "linear-gradient(160deg, #3FCBFD 0%, #0AA9FD 45%, #007CFE 100%)" }}>
          <span className="absolute -start-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <span className="absolute -bottom-16 -end-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          {COINS.map((c, i) => (
            <span key={i} className="tx-coin" style={{ left: c.left, fontSize: c.size, ["--d" as string]: c.d }} aria-hidden="true">
              ✦
            </span>
          ))}
          <div className="tx-mascot absolute bottom-0 left-1/2 w-[64%]" style={{ transform: "translate(-50%, 10.7%)" }} aria-hidden="true">
            <Image src="/images/content-hero.png" alt="" width={720} height={492} priority className="h-auto w-full select-none" draggable={false} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute end-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-soft"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-7 pt-5 text-center">
          <h2 className="tx-rise text-[26px] font-extrabold leading-tight text-ink" style={{ ["--d" as string]: "0.15s" }}>
            מה זה טריפים?
          </h2>
          <p className="tx-rise mx-auto mt-1.5 max-w-[19rem] text-[14.5px] leading-relaxed text-ink-secondary" style={{ ["--d" as string]: "0.25s" }}>
            טריפים הם המטבע של triplace. כל פעולה חכמה באפליקציה עולה כמה טריפים - וכל חודש מקבלים חבילה חדשה.
          </p>

          {/* מונה ענק 0 -> 100 */}
          <div className="tx-rise relative mx-auto mt-5 w-fit" style={{ ["--d" as string]: "0.35s" }}>
            <span className="tx-pulse absolute inset-0 rounded-[28px]" style={{ background: BLUE_GRADIENT, opacity: 0.3 }} aria-hidden="true" />
            <div className="relative rounded-[26px] p-[2px]" style={{ background: BLUE_GRADIENT }}>
              <div className="flex items-baseline justify-center gap-2 rounded-[24px] bg-white px-9 py-3">
                <span className="text-[44px] font-black leading-none tabular-nums text-ink">{count}</span>
                <span className="text-[16px] font-extrabold" style={{ color: "#0A6DFE" }}>
                  ✦ טריפים
                </span>
              </div>
            </div>
            <p className="mt-2 text-[12px] font-semibold text-ink-secondary">בחבילה החודשית</p>
          </div>

          {/* איך זה עובד - 3 שלבים */}
          <div className="relative mt-6 grid grid-cols-3 gap-2">
            <svg className="pointer-events-none absolute inset-x-[16%] top-5 h-1 w-[68%]" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" y1="1" x2="100" y2="1" stroke="#0A6DFE" strokeOpacity=".35" strokeWidth="2" className="tx-dash" vectorEffect="non-scaling-stroke" />
            </svg>
            {STEPS.map((step, i) => (
              <div key={step.kind} className="tx-rise relative flex flex-col items-center gap-1.5" style={{ ["--d" as string]: `${0.5 + i * 0.12}s` }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-soft" style={{ background: BLUE_GRADIENT }}>
                  <StepIcon kind={step.kind} />
                </span>
                <span className="text-[13.5px] font-extrabold text-ink">{step.title}</span>
                <span className="text-[11.5px] leading-snug text-ink-secondary">{step.sub}</span>
              </div>
            ))}
          </div>

          {/* על מה משתמשים - עלויות אמיתיות מ-TOKEN_COSTS */}
          <div className="mt-6 flex flex-col gap-2 text-start">
            <p className="tx-rise text-[12px] font-bold text-ink-secondary" style={{ ["--d" as string]: "0.85s" }}>
              על מה משתמשים בטריפים
            </p>
            {[
              { label: "בניית מסלול עם Trippy AI", cost: TOKEN_COSTS.trippy_ai_generation, kind: "use" as const },
              { label: "לייק ב־TripMatch", cost: TOKEN_COSTS.tripmatch_like, kind: "get" as const },
            ].map((row, i) => (
              <div
                key={row.label}
                className="tx-rise flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-[#F6F9FF] px-3.5 py-3"
                style={{ ["--d" as string]: `${0.95 + i * 0.1}s` }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-soft" style={{ color: "#0A6DFE" }}>
                  {row.kind === "use" ? <StepIcon kind="use" /> : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20.5s-7.5-4.6-9.8-9.4C.7 7.6 2.3 4 6 4c2 0 3.6 1.1 6 3.6C14.4 5.1 16 4 18 4c3.7 0 5.3 3.6 3.8 7.1-2.3 4.8-9.8 9.4-9.8 9.4z" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-bold text-ink">{row.label}</span>
                <span className="shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-extrabold text-white" style={{ background: BLUE_GRADIENT }}>
                  {row.cost} טריפים
                </span>
              </div>
            ))}
          </div>

          {/* מבצע הרצה */}
          <div
            className="tx-rise tx-shine relative mt-5 overflow-hidden rounded-3xl px-5 py-5 text-center"
            style={{ ["--d" as string]: "1.2s", background: "linear-gradient(135deg, #E9F7FF 0%, #EEF2FF 55%, #FFF1F7 100%)", boxShadow: "inset 0 0 0 1.5px rgba(10,109,254,.28)" }}
          >
            <span className="inline-flex items-center gap-1 rounded-pill px-3 py-1 text-[11.5px] font-extrabold text-white" style={{ background: BLUE_GRADIENT }}>
              🎉 מבצע הרצה
            </span>
            <div className="mt-2 flex items-center justify-center gap-2.5">
              <svg width="52" height="26" viewBox="0 0 52 26" fill="none" aria-hidden="true">
                <path
                  className="tx-inf"
                  d="M26 13c-3.5-6-7.5-8-11-8a8 8 0 0 0 0 16c3.5 0 7.5-2 11-8Zm0 0c3.5 6 7.5 8 11 8a8 8 0 0 0 0-16c-3.5 0-7.5 2-11 8Z"
                  stroke="#0A6DFE"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[24px] font-black leading-none text-ink">ללא הגבלה!</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">בתקופת ההרצה הטריפים על הבית: בונים מסלולים ועושים לייקים בלי לספור.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tx-rise mt-5 w-full rounded-pill py-3.5 text-[15px] font-bold text-white shadow-soft"
            style={{ ["--d" as string]: "1.35s", background: BLUE_GRADIENT }}
          >
            הבנתי, יאללה!
          </button>
        </div>
      </div>
    </div>
  );
}
