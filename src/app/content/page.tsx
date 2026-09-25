"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CollectionTypeSheet } from "@/screens/collections/CollectionTypeSheet";
import { CreateModePreview, CREATE_PREVIEW_CSS } from "@/screens/create/CreateModePreviews";

type TileId = "post" | "place" | "collection" | "trip";

interface Mode {
  id: TileId;
  /** השם בשורת המצבים למטה */
  label: string;
  title: string;
  sub: string;
  /** 3 צעדים קצרים - איך יוצרים */
  includes: string[];
  cta: string;
}

const MODES: Mode[] = [
  { id: "post", label: "פוסט", title: "שתפו רגע מהדרך", sub: "תמונה או סרטון, כמה מילים ותיוג של המקום", includes: ["בוחרים תמונות", "כותבים כמה מילים", "מפרסמים"], cta: "צרו פוסט" },
  { id: "place", label: "מקום", title: "המליצו על מקום שאהבתם", sub: "ציון, כמה מילים ותמונות - וכולם יגלו אותו במפה", includes: ["מחפשים את המקום", "נותנים ציון", "כותבים ביקורת"], cta: "המליצו על מקום" },
  { id: "collection", label: "חוויה", title: "אספו מקומות תחת רעיון אחד", sub: "\"בתי הקפה הכי שווים\", \"מקומות לדייט\" - רשימה שכולם יכולים לשמור", includes: ["נותנים שם", "מוסיפים מקומות", "מפרסמים"], cta: "צרו חוויה" },
  { id: "trip", label: "טיול", title: "בנו מסלול מוכן לדרך", sub: "תחנות לפי סדר, יום אחד או כמה ימים - עם מפה וניווט", includes: ["מוסיפים תחנות", "מסדרים לפי ימים", "יוצאים לדרך"], cta: "צרו טיול" },
];

const CSS = `
.cx-page { background:#000; color:#fff; min-height:100vh; min-height:100dvh; }
/* הכרטיס המרכזי - "המסך" של המצב הנבחר (כמו העינית במצלמה של אינסטגרם) */
/* *** בקשה מפורשת ("צעקני, כפתורים לא בסגנון שלנו"): משטח כהה שקט ואחיד - כמו הריבועים הקודמים בעמוד -
   בלי הילות צבעוניות וגרדיאנטים. הצבע היחיד בעמוד הוא הכחול של כפתור היצירה. */
.cx-stage { position:relative; border-radius:24px; overflow:hidden; touch-action:pan-y; user-select:none; background:#141416; }
.cx-scene { animation:cx-scene-in .42s cubic-bezier(.2,.8,.2,1) both; }
.cx-scene[data-dir="prev"] { animation-name:cx-scene-in-prev; }
@keyframes cx-scene-in { from { opacity:0; transform:translateX(-28px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes cx-scene-in-prev { from { opacity:0; transform:translateX(28px) scale(.98); } to { opacity:1; transform:none; } }
/* שורת המצבים - כמו POST / STORY / REEL */
.cx-rail { transition:transform .35s cubic-bezier(.2,.8,.2,1); }
.cx-mode { transition:color .25s, opacity .25s, transform .25s; -webkit-tap-highlight-color:transparent; }
/* כפתור היצירה - הכפתור הראשי של האפליקציה (כחול, h-12, rounded-xl), כמו בכל שאר העמודים */
.cx-cta { -webkit-tap-highlight-color:transparent; transition:transform .15s cubic-bezier(.2,.8,.2,1), opacity .15s; }
.cx-cta:active { transform:scale(.98); opacity:.92; }
@media (prefers-reduced-motion: reduce) { .cx-scene { animation:none !important; } .cx-rail { transition:none; } }
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
      <style>{CSS + CREATE_PREVIEW_CSS}</style>

      <div className="cx-page relative isolate flex flex-col">
        {/* הבר העליון של triplace (אותו בר כמו בעמוד הבית: צ'אט · לוגו · התראות), לוגו בלבן על הרקע הכהה */}
        <CollapsibleTopBar logoTone="white" />

        <main className="flex flex-1 flex-col px-4 pt-2" style={{ paddingBottom: "calc(66px + max(env(safe-area-inset-bottom), 22px) + 12px)" }}>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <section
              aria-roledescription="קרוסלה"
              aria-label="סוג ההעלאה"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (drag.current = null)}
              className="cx-stage mt-2 flex min-h-[420px] flex-1 flex-col outline-none"
            >
              <div key={mode.id} data-dir={dir} className="cx-scene relative flex flex-1 flex-col items-center justify-center px-5 pb-4 pt-6 text-center">
                {/* דוגמה חיה של התוצאה - איך זה ייראה באפליקציה */}
                <div className="flex w-full justify-center" aria-hidden="true">
                  <CreateModePreview mode={mode.id} />
                </div>
                <h1 className="mt-5 text-[22px] font-bold leading-tight tracking-tight">{mode.title}</h1>
                <p className="mt-1.5 max-w-[19rem] text-balance text-[14.5px] leading-snug text-white/60">{mode.sub}</p>
                {/* איך זה עובד - שורת טקסט שקטה, בלי "בועות" */}
                <p className="mt-3 text-[13px] font-medium text-white/45">{mode.includes.join(" · ")}</p>
              </div>
              {/* נקודות - איפה אנחנו בין 4 הסוגים */}
              <div className="relative flex justify-center gap-1.5 pb-4" aria-hidden="true">
                {MODES.map((m, i) => (
                  <span key={m.id} className="h-1.5 rounded-full bg-white transition-all duration-300" style={{ width: i === index ? 18 : 6, opacity: i === index ? 0.95 : 0.35 }} />
                ))}
              </div>
            </section>

            {/* כפתור היצירה - הכפתור הראשי הרגיל של האפליקציה */}
            <button
              type="button"
              onClick={start}
              className="cx-cta mt-4 flex h-12 w-full items-center justify-center rounded-xl text-[15.5px] font-semibold text-white"
              style={{ background: "#0A6DFE" }}
            >
              {mode.cta}
            </button>

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
