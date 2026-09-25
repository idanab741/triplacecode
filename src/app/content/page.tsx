"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CollectionTypeSheet } from "@/screens/collections/CollectionTypeSheet";

type TileId = "post" | "place" | "collection" | "trip";

/* ───────────── אייקוני קו דקים, בגרדיאנט של האקסנט של כל ריבוע ───────────── */

/** *** עיצוב מחדש: קו אחיד בצבע האקסנט של הריבוע (בלי גרדיאנט), עבה מעט יותר כדי להיות חד על שחור. */
function Icon({ children }: { id: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" stroke="var(--a)" className="h-full w-full" aria-hidden="true">
      {children}
    </svg>
  );
}

const ART: Record<TileId, ReactNode> = {
  post: (
    <Icon id="cx-post">
      <path d="M8 12.5A4.5 4.5 0 0 1 12.5 8h23A4.5 4.5 0 0 1 40 12.5v16a4.5 4.5 0 0 1-4.5 4.5H21l-8.5 7V33A4.5 4.5 0 0 1 8 28.5v-16Z" />
      <path d="M15 17h18M15 24h11" />
    </Icon>
  ),
  place: (
    <Icon id="cx-place">
      <path d="M24 42S11 30.5 11 20a13 13 0 0 1 26 0c0 10.5-13 22-13 22Z" />
      <circle cx="24" cy="20" r="4.5" />
    </Icon>
  ),
  collection: (
    <Icon id="cx-collection">
      <rect x="9" y="8" width="26" height="22" rx="4.5" opacity=".4" />
      <rect x="13" y="13" width="26" height="22" rx="4.5" opacity=".7" />
      <rect x="17" y="18" width="24" height="22" rx="4.5" />
      <path d="m20 36 6-6 4 4 3-3 5 5" />
    </Icon>
  ),
  trip: (
    <Icon id="cx-trip">
      <circle cx="10" cy="37" r="3" />
      <circle cx="24" cy="26" r="3" />
      <circle cx="38" cy="10" r="3" />
      <path d="M12.5 35c3-2 6-4 9-7.5M26.5 24c4-3 7-6.5 9-11.5" strokeDasharray="2.5 3.5" />
    </Icon>
  ),
};

interface Mode {
  id: TileId;
  /** השם בשורת המצבים למטה */
  label: string;
  title: string;
  sub: string;
  /** מה מוסיפים - שורת "צ'יפים" קצרה במרכז הכרטיס */
  includes: string[];
  cta: string;
  a: string;
  b: string;
}

const MODES: Mode[] = [
  { id: "post", label: "פוסט", title: "שתפו רגע מהדרך", sub: "תמונה או סרטון, כמה מילים, ומקום אם בא לכם", includes: ["תמונות וסרטונים", "טקסט", "תיוג מקום"], cta: "פוסט חדש", a: "#FF8FB8", b: "#FFA96B" },
  { id: "place", label: "מקום", title: "המלצה על מקום", sub: "מקום שאהבתם - עם ציון, כמה מילים ותמונות", includes: ["דירוג", "ביקורת", "תמונות"], cta: "המלצה חדשה", a: "#B69CFF", b: "#5EC8FF" },
  { id: "collection", label: "חוויה", title: "חוויה תחת רעיון אחד", sub: "אספו מקומות או טיולים - \"הבתי קפה הכי שווים\", \"דייטים\"", includes: ["כמה מקומות", "שם ורעיון", "תמונת שער"], cta: "חוויה חדשה", a: "#5BE3A8", b: "#38D6E8" },
  { id: "trip", label: "טיול", title: "מסלול מוכן לדרך", sub: "תחנות לפי סדר, יום אחד או כמה ימים", includes: ["תחנות", "ימים", "מפה וניווט"], cta: "טיול חדש", a: "#FFCB5C", b: "#FF7F8E" },
];

const CSS = `
.cx-page { background:#000; color:#fff; min-height:100vh; min-height:100dvh; }
/* הכרטיס המרכזי - "המסך" של המצב הנבחר (כמו העינית במצלמה של אינסטגרם) */
.cx-stage { position:relative; border-radius:30px; overflow:hidden; touch-action:pan-y; user-select:none;
  background:#0f0f12; box-shadow:0 30px 60px -30px color-mix(in srgb, var(--a) 55%, transparent); transition:box-shadow .4s ease; }
.cx-stage-bg { position:absolute; inset:0; transition:opacity .45s ease;
  background:
    radial-gradient(120% 70% at 85% 0%, color-mix(in srgb, var(--a) 55%, transparent), transparent 60%),
    radial-gradient(110% 70% at 10% 100%, color-mix(in srgb, var(--b) 50%, transparent), transparent 65%),
    #121216; }
.cx-scene { animation:cx-scene-in .42s cubic-bezier(.2,.8,.2,1) both; }
.cx-scene[data-dir="prev"] { animation-name:cx-scene-in-prev; }
@keyframes cx-scene-in { from { opacity:0; transform:translateX(-28px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes cx-scene-in-prev { from { opacity:0; transform:translateX(28px) scale(.98); } to { opacity:1; transform:none; } }
.cx-bigicon { background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.18), 0 18px 40px -12px color-mix(in srgb, var(--a) 70%, transparent);
  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:cx-float 4s ease-in-out infinite; }
@keyframes cx-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
.cx-chip { background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
/* שורת המצבים - כמו POST / STORY / REEL */
.cx-rail { transition:transform .35s cubic-bezier(.2,.8,.2,1); }
.cx-mode { transition:color .25s, opacity .25s, transform .25s; -webkit-tap-highlight-color:transparent; }
/* כפתור ה"צילום" - מתחיל את היצירה */
.cx-shutter { -webkit-tap-highlight-color:transparent; transition:transform .15s cubic-bezier(.2,.8,.2,1); }
.cx-shutter:active { transform:scale(.92); }
.cx-shutter-core { background:linear-gradient(135deg, var(--a), var(--b)); transition:background .35s; box-shadow:0 10px 26px -8px color-mix(in srgb, var(--a) 80%, transparent); }
.cx-hero { animation:cx-hero-in .7s cubic-bezier(.2,.8,.2,1) .05s backwards; }
@keyframes cx-hero-in { from{opacity:0; transform:translateY(18px)} to{opacity:1; transform:none} }
@media (prefers-reduced-motion: reduce) { .cx-hero, .cx-scene, .cx-bigicon { animation:none !important; } .cx-rail { transition:none; } }
`;

/**
 * *** עיצוב מחדש (בקשה מפורשת - "כמו באינסטגרם: להחליק ימינה ושמאלה בין סוגי ההעלאה - פשוט, מעוצב, ברור וכיף"):
 * "תוכן" - הטאב שבבר התחתון. במקום 4 ריבועים: כרטיס גדול אחד שמציג את סוג ההעלאה הנבחר (צבע, אייקון,
 * הסבר קצר ומה מוסיפים), הדמות מציצה מעליו, ולמטה - כפתור עגול גדול ("צילום") ושורת המצבים
 * פוסט · מקום · חוויה · טיול כמו POST / STORY / REEL. מחליפים מצב בהחלקה על הכרטיס, בהחלקה/לחיצה על
 * השורה או בחיצים במקלדת. הכפתור מוביל לזרימת היצירה הקיימת (לא נוצרת כאן לוגיקה חדשה):
 *  פוסט -> /places/post/create · מקום -> /places/create
 *  חוויה -> "מה תרצו לאסוף?" -> /places/collection/create · טיול -> /places/trip/create
 */
export default function ContentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [collectionTypeOpen, setCollectionTypeOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const mode = MODES[index];

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  function go(next: number) {
    const clamped = Math.max(0, Math.min(MODES.length - 1, next));
    if (clamped === index) return;
    setDir(clamped > index ? "next" : "prev");
    setIndex(clamped);
    navigator.vibrate?.(8);
  }

  function start() {
    const id = mode.id;
    if (id === "post") router.push("/places/post/create");
    else if (id === "place") router.push("/places/create");
    else if (id === "collection") setCollectionTypeOpen(true);
    else router.push("/places/trip/create");
  }

  // החלקה על הכרטיס. האפליקציה בעברית (מימין לשמאל): המצב הבא נמצא משמאל, לכן החלקה ימינה = הבא.
  const drag = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: PointerEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    go(index + (dx > 0 ? 1 : -1));
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") go(index + 1);
    else if (e.key === "ArrowRight") go(index - 1);
  }

  // שורת המצבים: המצב הנבחר תמיד במרכז (כמו באינסטגרם) - מזיזים את כל השורה.
  const railBoxRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [railShift, setRailShift] = useState(0);
  const railShiftRef = useRef(0);
  useLayoutEffect(() => {
    const measure = () => {
      const box = railBoxRef.current;
      const item = itemRefs.current[index];
      if (!box || !item) return;
      const boxRect = box.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const current = itemRect.left + itemRect.width / 2 - railShiftRef.current;
      const next = boxRect.left + boxRect.width / 2 - current;
      railShiftRef.current = next;
      setRailShift(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index]);

  return (
    <>
      <HomeStatusBarTint />
      <style>{CSS}</style>

      <div className="cx-page relative isolate flex flex-col" style={{ "--a": mode.a, "--b": mode.b } as CSSProperties}>
        {/* הבר העליון של triplace (אותו בר כמו בעמוד הבית: צ'אט · לוגו · התראות), לוגו בלבן על הרקע הכהה */}
        <CollapsibleTopBar logoTone="white" />

        <main className="flex flex-1 flex-col px-4 pt-2" style={{ paddingBottom: "calc(66px + max(env(safe-area-inset-bottom), 22px) + 12px)" }}>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            {/* הדמות מציצה מעל הכרטיס */}
            <div className="cx-hero pointer-events-none relative z-10 mx-auto -mb-[9%] w-[46%]" aria-hidden="true">
              <Image src="/images/content-hero.png" alt="" width={720} height={492} priority draggable={false} sizes="200px" className="h-auto w-full select-none" />
            </div>

            <section
              aria-roledescription="קרוסלה"
              aria-label="סוג ההעלאה"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (drag.current = null)}
              className="cx-stage flex min-h-[340px] flex-1 flex-col outline-none"
            >
              <span className="cx-stage-bg" aria-hidden="true" />
              <div key={mode.id} data-dir={dir} className="cx-scene relative flex flex-1 flex-col items-center justify-center px-6 pb-7 pt-12 text-center">
                <span className="cx-bigicon flex h-24 w-24 items-center justify-center rounded-[30px]" style={{ "--a": "#ffffff" } as CSSProperties}>
                  <span className="block h-12 w-12">{ART[mode.id]}</span>
                </span>
                <h1 className="mt-6 text-[27px] font-extrabold leading-tight tracking-tight">{mode.title}</h1>
                <p className="mt-2 max-w-[18rem] text-balance text-[15px] leading-snug text-white/75">{mode.sub}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                  {mode.includes.map((t) => (
                    <span key={t} className="cx-chip rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white/90">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {/* נקודות - איפה אנחנו בין 4 הסוגים */}
              <div className="relative flex justify-center gap-1.5 pb-4" aria-hidden="true">
                {MODES.map((m, i) => (
                  <span key={m.id} className="h-1.5 rounded-full bg-white transition-all duration-300" style={{ width: i === index ? 18 : 6, opacity: i === index ? 0.95 : 0.35 }} />
                ))}
              </div>
            </section>

            {/* כפתור ה"צילום" - מתחיל את היצירה של הסוג הנבחר */}
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={start}
                aria-label={mode.cta}
                className="cx-shutter flex h-[78px] w-[78px] items-center justify-center rounded-full bg-transparent p-[5px] ring-[3.5px] ring-white"
              >
                <span className="cx-shutter-core flex h-full w-full items-center justify-center rounded-full text-white">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
            </div>

            {/* שורת המצבים - כמו POST / STORY / REEL באינסטגרם */}
            <div ref={railBoxRef} className="relative mt-3 overflow-hidden" role="tablist" aria-label="בחירת סוג העלאה">
              <div className="cx-rail flex w-max gap-7 px-4 py-2" dir="rtl" style={{ transform: `translateX(${railShift}px)` }}>
                {MODES.map((m, i) => (
                  <button
                    key={m.id}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    onClick={() => go(i)}
                    className={`cx-mode text-[15px] font-bold tracking-wide ${i === index ? "text-white" : "text-white/40"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* בר תחתון שחור: כל האייקונים והתוויות בלבן, חוץ מ"תוכן" (הטאב הפעיל) שנשאר בצבעיו */}
      <MainBottomNav active="content" tone="dark" />

      {collectionTypeOpen && (
        <CollectionTypeSheet
          dark
          onClose={() => setCollectionTypeOpen(false)}
          onSelect={(type) => router.push(`/places/collection/create?type=${type}&origin=content`)}
        />
      )}
    </>
  );
}
