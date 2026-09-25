"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { setPendingCreateMedia } from "@/screens/create/pendingCreateMedia";

const PlacesFriendsMap = dynamic(() => import("@/screens/places/PlacesFriendsMap").then((m) => m.PlacesFriendsMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#F2F0EB]" />,
});

type ModeId = "moment" | "place" | "map";

/* *** בקשה מפורשת ("רגע · מקום · מפה" - וכל מצב פותח את הכלי עצמו, כמו באפליקציות המוכרות):
   רגע = מצלמה / גלריה (כמו אפליקציית המצלמה), מקום = כוכבים (כמו "דרגו וכתבו ביקורת" ב-Google Maps),
   מפה = המפה של places עצמה - נוגעים בנעצים ויוצרים מפה או מסלול. */
const MODES: { id: ModeId; label: string }[] = [
  { id: "moment", label: "רגע" },
  { id: "place", label: "מקום" },
  { id: "map", label: "מפה" },
];

const RATING_LABELS = ["", "לא משהו", "סביר", "טוב", "טוב מאוד", "מושלם!"];
const STAR_PATH = "M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31l-5.68 2.99 1.08-6.33-4.6-4.49 6.36-.92L12 2.8z";

const CSS = `
.cx-page { background:#000; color:#fff; min-height:100vh; min-height:100dvh; }
.cx-stage { position:relative; border-radius:24px; overflow:hidden; background:#121214; touch-action:pan-y; user-select:none; -webkit-user-select:none; }
.cx-scene { animation:cx-scene-in .38s cubic-bezier(.2,.8,.2,1) both; }
.cx-scene[data-dir="prev"] { animation-name:cx-scene-in-prev; }
@keyframes cx-scene-in { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:none; } }
@keyframes cx-scene-in-prev { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
/* עינית: פינות מסגרת, כמו במצלמה */
.cx-corner { position:absolute; width:26px; height:26px; border:0 solid rgba(255,255,255,.3); }
.cx-corner[data-c="tl"] { top:0; left:0; border-top-width:2px; border-left-width:2px; border-top-left-radius:14px; }
.cx-corner[data-c="tr"] { top:0; right:0; border-top-width:2px; border-right-width:2px; border-top-right-radius:14px; }
.cx-corner[data-c="bl"] { bottom:0; left:0; border-bottom-width:2px; border-left-width:2px; border-bottom-left-radius:14px; }
.cx-corner[data-c="br"] { bottom:0; right:0; border-bottom-width:2px; border-right-width:2px; border-bottom-right-radius:14px; }
.cx-press { -webkit-tap-highlight-color:transparent; transition:transform .16s cubic-bezier(.2,.8,.2,1), background-color .2s, opacity .2s; }
.cx-press:active { transform:scale(.94); }
.cx-shutter:active .cx-shutter-core { transform:scale(.86); }
.cx-shutter-core { transition:transform .16s cubic-bezier(.2,.8,.2,1); }
.cx-star { -webkit-tap-highlight-color:transparent; transition:transform .18s cubic-bezier(.3,1.6,.5,1); }
.cx-star[data-on="true"] { animation:cx-star-pop .34s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes cx-star-pop { 0% { transform:scale(.8); } 60% { transform:scale(1.14); } 100% { transform:scale(1); } }
.cx-rail { transition:transform .35s cubic-bezier(.2,.8,.2,1); }
.cx-mode { -webkit-tap-highlight-color:transparent; transition:color .25s; }
.cx-page :focus-visible { outline:2px solid #0A6DFE; outline-offset:3px; }
@media (prefers-reduced-motion: reduce) { .cx-scene, .cx-star[data-on="true"] { animation:none !important; } .cx-rail { transition:none; } }
`;

/* ───────────── אייקונים ───────────── */

function GalleryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="9" cy="9.2" r="1.7" />
      <path d="m20.5 15.5-4.6-4.6a1.2 1.2 0 0 0-1.7 0L5 20.2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.3-1.8c.3-.4.7-.7 1.2-.7h3.4c.5 0 .9.3 1.2.7L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" />
      <circle cx="12" cy="12.4" r="3.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

/* ───────────── רגע: מצלמה / גלריה ───────────── */

/** כמו אפליקציית המצלמה: עינית, ולמטה גלריה · כפתור צילום · טקסט. בחירה -> עמוד הפוסט עם הקבצים כבר בפנים. */
function MomentStage({ onFiles, onTextOnly }: { onFiles: (files: File[]) => void; onTextOnly: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handle(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onFiles(files);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative m-4 mb-0 flex flex-1 flex-col items-center justify-center px-8 text-center">
        {["tl", "tr", "bl", "br"].map((c) => (
          <span key={c} aria-hidden="true" data-c={c} className="cx-corner" />
        ))}
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.07] text-white/85">
          <CameraIcon />
        </span>
        <h2 className="mt-4 text-[21px] font-bold tracking-tight">שתפו רגע מהדרך</h2>
        <p className="mt-1 text-[14.5px] text-white/55">צלמו עכשיו, או בחרו מהגלריה</p>
      </div>

      {/* שורת המצלמה - אותו סדר כמו בכל אפליקציית מצלמה (גלריה משמאל, טקסט מימין) */}
      <div className="flex items-center justify-between px-8 pb-6 pt-4" dir="ltr">
        <span className="flex w-16 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            aria-label="בחירה מהגלריה"
            className="cx-press flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white/10 text-white ring-2 ring-white/85"
          >
            <GalleryIcon />
          </button>
          <span className="text-[11.5px] font-medium text-white/60" aria-hidden="true">גלריה</span>
        </span>

        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          aria-label="צילום"
          className="cx-press cx-shutter flex h-[78px] w-[78px] items-center justify-center rounded-full border-[4px] border-white"
        >
          <span className="cx-shutter-core block h-[62px] w-[62px] rounded-full bg-white" />
        </button>

        <span className="flex w-16 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onTextOnly}
            aria-label="פוסט טקסט בלבד"
            className="cx-press flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/10 text-[18px] font-bold text-white"
          >
            Aa
          </button>
          <span className="text-[11.5px] font-medium text-white/60" aria-hidden="true">טקסט</span>
        </span>
      </div>

      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files)} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handle(e.target.files)} />
    </div>
  );
}

/* ───────────── מקום: כוכבים ───────────── */

/** כמו "דרגו וכתבו ביקורת" במפות: קודם כוכבים, אחר כך בוחרים את המקום (או מוסיפים חדש). */
function PlaceStage({ onSearch, onAdd }: { onSearch: (rating: number) => void; onAdd: (rating: number) => void }) {
  const [rating, setRating] = useState(0);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <h2 className="text-[24px] font-bold tracking-tight">איך היה?</h2>
      <p className="mt-1 text-[14.5px] text-white/55">דרגו מקום שהייתם בו - וכולם יגלו אותו</p>

      <div className="mt-7 flex justify-center gap-1" dir="ltr" role="radiogroup" aria-label="דירוג">
        {[1, 2, 3, 4, 5].map((star) => {
          const on = star <= rating;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === rating}
              aria-label={`${star} כוכבים - ${RATING_LABELS[star]}`}
              onClick={() => setRating(star)}
              data-on={on}
              className="cx-star p-1"
            >
              <svg width="46" height="46" viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR_PATH} fill={on ? "#F5B301" : "rgba(255,255,255,0.14)"} strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>
      <p className="mt-2 h-5 text-[14.5px] font-semibold text-[#F5B301]" aria-live="polite">
        {RATING_LABELS[rating]}
      </p>

      {/* השלב הבא: על איזה מקום? - מתבהר אחרי שדירגו */}
      <button
        type="button"
        onClick={() => onSearch(rating)}
        className={`cx-press mt-7 flex h-12 w-full max-w-[20rem] items-center gap-2.5 rounded-full px-5 text-start text-[15.5px] ${
          rating > 0 ? "bg-white font-semibold text-[#0f1419]" : "bg-white/10 text-white/70"
        }`}
      >
        <SearchIcon />
        על איזה מקום?
      </button>
      <button type="button" onClick={() => onAdd(rating)} className="cx-press mt-4 text-[14px] font-medium text-white/60 underline-offset-4 active:text-white">
        המקום לא ב-triplace? <span className="font-semibold text-white">הוסיפו אותו</span>
      </button>
    </div>
  );
}

/* ───────────── העמוד ───────────── */

/**
 * *** עיצוב מחדש (בקשה מפורשת - "כמו באינסטגרם: להחליק ימינה ושמאלה בין סוגי ההעלאה"):
 * "תוכן" - הטאב שבבר התחתון. במסך אחד: הכלי של המצב הנבחר, ומתחתיו שורת המצבים רגע · מקום · מפה
 * (כמו POST / STORY / REEL). מחליפים מצב בהחלקה (על המסך או על השורה), בלחיצה על השורה או בחיצים.
 * כל מצב ממשיך לזרימת היצירה הקיימת - לא נוצרת כאן לוגיקה חדשה:
 *  רגע  -> /places/post/create (עם הקבצים שנבחרו)
 *  מקום -> /places/create?rating=N (או ?add=1 להוספת מקום חדש)
 *  מפה  -> בחירת נעצים -> /places/collection/create (מפה) או /places/trip/create (מסלול)
 */
export default function ContentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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

  // החלקה. האפליקציה בעברית (מימין לשמאל): המצב הבא נמצא משמאל, לכן החלקה ימינה = הבא.
  // על המפה ההחלקה מזיזה את המפה - שם מחליפים מצב רק מהשורה שלמטה.
  const drag = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: PointerEvent) {
    drag.current = (e.target as HTMLElement).closest(".places-friends-map") ? null : { x: e.clientX, y: e.clientY };
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
    // רק כשהפוקוס על המסך/השורה עצמם - לא בתוך הכוכבים או המפה
    if (e.target !== e.currentTarget && (e.target as HTMLElement).getAttribute("role") !== "tab") return;
    if (e.key === "ArrowLeft") go(index + 1);
    else if (e.key === "ArrowRight") go(index - 1);
  }
  const swipe = { onPointerDown, onPointerUp, onPointerCancel: () => (drag.current = null) };

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

  const ratingQuery = (rating: number) => (rating > 0 ? `rating=${rating}` : "");

  return (
    <>
      <HomeStatusBarTint />
      <style>{CSS}</style>

      <div className="cx-page relative isolate flex flex-col">
        {/* הבר העליון של triplace (אותו בר כמו בעמוד הבית), לוגו בלבן על הרקע הכהה */}
        <CollapsibleTopBar logoTone="white" />
        <h1 className="sr-only">יצירת תוכן</h1>

        <main className="flex flex-1 flex-col px-3 pt-2" style={{ paddingBottom: "calc(66px + max(env(safe-area-inset-bottom), 22px) + 8px)" }}>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <section
              aria-roledescription="קרוסלה"
              aria-label={`יצירה: ${mode.label}`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              {...swipe}
              className="cx-stage mt-1 min-h-[440px] flex-1 outline-none"
            >
              <div key={mode.id} data-dir={dir} className="cx-scene absolute inset-0">
                {mode.id === "moment" && (
                  <MomentStage
                    onFiles={(files) => {
                      setPendingCreateMedia(files);
                      router.push("/places/post/create");
                    }}
                    onTextOnly={() => router.push("/places/post/create")}
                  />
                )}
                {mode.id === "place" && (
                  <PlaceStage
                    onSearch={(rating) => router.push(`/places/create${rating ? `?${ratingQuery(rating)}` : ""}`)}
                    onAdd={(rating) => router.push(`/places/create?add=1${rating ? `&${ratingQuery(rating)}` : ""}`)}
                  />
                )}
                {mode.id === "map" && <PlacesFriendsMap pickMode />}
              </div>
            </section>

            {/* שורת המצבים - כמו POST / STORY / REEL באינסטגרם */}
            <div ref={railBoxRef} {...swipe} className="relative mt-2 overflow-hidden" role="tablist" aria-label="בחירת סוג העלאה" onKeyDown={onKeyDown}>
              <div className="cx-rail flex w-max gap-8 px-4 py-3" dir="rtl" style={{ transform: `translateX(${railShift}px)` }}>
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
                    className={`cx-mode relative text-[15.5px] font-bold tracking-wide ${i === index ? "text-white" : "text-white/40"}`}
                  >
                    {m.label}
                    <span
                      aria-hidden="true"
                      className={`absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white transition-opacity duration-300 ${i === index ? "opacity-100" : "opacity-0"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* בר תחתון שחור: כל האייקונים והתוויות בלבן, חוץ מ"תוכן" (הטאב הפעיל) שנשאר בצבעיו */}
      <MainBottomNav active="content" tone="dark" />
    </>
  );
}
