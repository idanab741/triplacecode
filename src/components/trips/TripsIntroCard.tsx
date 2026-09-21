"use client";

import { useEffect, useState } from "react";
import { UNLIMITED_TRIPS_PROMO } from "@/constants/tokenCosts";

const DISMISS_KEY = "triplace_trips_intro_dismissed_v1";
const BLUE_GRADIENT = "linear-gradient(150deg, #22B8FD, #007CFE)";

const CSS = `
.ti-card { animation:ti-in .65s cubic-bezier(.2,.85,.25,1) both; }
@keyframes ti-in { from{opacity:0; transform:translateY(16px) scale(.97)} to{opacity:1; transform:none} }

/* מטבע שמסתובב (Y) בהפסקות, וזוהר פועם מאחוריו */
.ti-coin { animation:ti-flip 4.2s cubic-bezier(.45,.05,.25,1) .8s infinite; transform-style:preserve-3d; }
@keyframes ti-flip { 0%,55%{transform:rotateY(0)} 80%,100%{transform:rotateY(360deg)} }
.ti-glow { animation:ti-glow 2.4s ease-out infinite; }
@keyframes ti-glow { 0%{transform:scale(.85); opacity:.55} 100%{transform:scale(1.5); opacity:0} }

/* נצנצים שמקיפים את המטבע */
.ti-orbit { animation:ti-spin 9s linear infinite; }
@keyframes ti-spin { to{transform:rotate(360deg)} }
.ti-star { animation:ti-twinkle 1.8s ease-in-out infinite; animation-delay:var(--d,0s); }
@keyframes ti-twinkle { 0%,100%{opacity:.25; transform:scale(.6)} 50%{opacity:1; transform:scale(1.15)} }

/* טקסט שעולה אחד-אחד */
.ti-line { animation:ti-line .55s cubic-bezier(.2,.85,.25,1) both; animation-delay:var(--d,0s); }
@keyframes ti-line { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }

/* ברק על תג המבצע */
.ti-chip { position:relative; overflow:hidden; }
.ti-chip::after { content:""; position:absolute; inset:0; background:linear-gradient(105deg, transparent 35%, rgba(255,255,255,.7) 50%, transparent 65%); transform:translateX(130%); animation:ti-sweep 3.4s ease-in-out 1.6s infinite; }
@keyframes ti-sweep { 0%{transform:translateX(130%)} 55%,100%{transform:translateX(-130%)} }

@media (prefers-reduced-motion: reduce) {
  .ti-card,.ti-coin,.ti-glow,.ti-orbit,.ti-star,.ti-line,.ti-chip::after { animation:none !important; }
}
`;

/**
 * "מה זה טריפים?" - כרטיס הסבר קטן ואנימטיבי *בתוך* העמוד (לא פופאפ), בעמודים שבהם טריפים רלוונטיים:
 * צ'אט Trippy AI ו-TripMatch. בכוונה קצר: מטבע מסתובב, שורת הסבר אחת, ותג "ללא הגבלה" בתקופת ההרצה.
 * אפשר לסגור (X) - נזכר ב-localStorage ולא יוצג שוב. מכבד prefers-reduced-motion.
 */
export function TripsIntroCard({ className = "" }: { className?: string }) {
  // null = עוד לא נבדק (לא מציגים כלום עד שנבדק localStorage - בלי הבהוב אצל מי שכבר סגר)
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage חסום - נסגר רק עד הרענון
    }
  }

  return (
    <div
      className={`ti-card relative flex items-center gap-3.5 rounded-3xl p-4 ${className}`}
      style={{ background: "linear-gradient(135deg, #EAF6FF 0%, #F1F3FF 100%)", boxShadow: "inset 0 0 0 1px rgba(10,109,254,.16)" }}
    >
      <style>{CSS}</style>

      {/* מטבע + נצנצים */}
      <div className="relative h-[60px] w-[60px] shrink-0" style={{ perspective: 300 }} aria-hidden="true">
        <span className="ti-glow absolute inset-0 rounded-full" style={{ background: BLUE_GRADIENT }} />
        <div className="ti-orbit absolute -inset-2">
          <span className="ti-star absolute left-1/2 top-0 -translate-x-1/2 text-[11px]" style={{ color: "#22B8FD", ["--d" as string]: "0s" }}>✦</span>
          <span className="ti-star absolute bottom-1 right-0 text-[9px]" style={{ color: "#0A6DFE", ["--d" as string]: ".6s" }}>✦</span>
          <span className="ti-star absolute bottom-1 left-0 text-[10px]" style={{ color: "#22B8FD", ["--d" as string]: "1.2s" }}>✦</span>
        </div>
        <div
          className="ti-coin relative flex h-full w-full items-center justify-center rounded-full text-[26px] font-black text-white"
          style={{ background: BLUE_GRADIENT, boxShadow: "0 6px 16px -4px rgba(0,124,254,.55), inset 0 0 0 3px rgba(255,255,255,.35)" }}
        >
          ✦
        </div>
      </div>

      <div className="min-w-0 flex-1 text-start">
        <p className="ti-line text-[15.5px] font-extrabold leading-tight text-ink" style={{ ["--d" as string]: ".25s" }}>
          מה זה טריפים?
        </p>
        <p className="ti-line mt-1 text-[13px] leading-snug text-ink-secondary" style={{ ["--d" as string]: ".45s" }}>
          המטבע של triplace - משתמשים בו לבניית מסלול ולייקים.
        </p>
        {UNLIMITED_TRIPS_PROMO && (
          <span
            className="ti-line ti-chip mt-2 inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-extrabold text-white"
            style={{ background: BLUE_GRADIENT, ["--d" as string]: ".7s" }}
          >
            <span aria-hidden="true">∞</span> בהרצה: ללא הגבלה
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="סגירה"
        className="absolute end-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-ink-secondary/70 hover:bg-black/[0.05]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
