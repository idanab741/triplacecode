"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { setPendingCreateMedia } from "@/screens/create/pendingCreateMedia";
import { optimizeImage } from "@/utils/imageUrl";

const PlacesFriendsMap = dynamic(() => import("@/screens/places/PlacesFriendsMap").then((m) => m.PlacesFriendsMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#F2F0EB]" />,
});

type ModeId = "moment" | "place" | "map" | "trip";

/* *** בקשה מפורשת ("רגע · מקום · מפה" - וכל מצב פותח את הכלי עצמו, כמו באפליקציות המוכרות):
   רגע = מצלמה / גלריה (כמו אפליקציית המצלמה), מקום = כוכבים (כמו "דרגו וכתבו ביקורת" ב-Google Maps),
   מפה = המפה של places עצמה - נוגעים בנעצים ויוצרים מפה או מסלול. */
const ALL_MODES: { id: ModeId; label: string }[] = [
  { id: "moment", label: "רגע" },
  { id: "place", label: "ביקורת" },
  { id: "map", label: "מפה" },
  { id: "trip", label: "טיול" },
];

/* *** בקשה מפורשת ("לאחד בין רגע לביקורת; רגע בינתיים לא מופיע - רק נשמר"): הביקורת קיבלה את העורך
   של "רגע" (ר' /places/create). "רגע" עצמו מוסתר עד שיהפוך ל-Story - הקוד שלו (MomentStage) נשאר כאן
   כמו שהוא; כדי להחזיר אותו מספיק להפוך את SHOW_MOMENT ל-true. */
const SHOW_MOMENT = false;
const MODES = ALL_MODES.filter((m) => SHOW_MOMENT || m.id !== "moment");

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
/* גל "תצוגת סאונד" על הכוכבים לפני שדירגו */
.cx-wave { animation:cx-wave 1.9s cubic-bezier(.45,0,.3,1) infinite; }
.cx-wave path { animation:cx-wave-fill 1.9s cubic-bezier(.45,0,.3,1) infinite; }
@keyframes cx-wave { 0%, 52%, 100% { transform:translateY(0) scale(1); } 22% { transform:translateY(-13px) scale(1.08); } }
@keyframes cx-wave-fill { 0%, 52%, 100% { fill:rgba(255,255,255,0.14); } 22% { fill:#F5B301; filter:drop-shadow(0 0 6px rgba(245,179,1,0.55)); } }
.cx-art-card { animation:cx-art-in .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes cx-art-in { from { opacity:0; margin-top:14px; } to { opacity:1; margin-top:0; } }
.cx-rail { transition:transform .35s cubic-bezier(.2,.8,.2,1); }
.cx-mode { -webkit-tap-highlight-color:transparent; transition:color .25s; }
.cx-page :focus-visible { outline:2px solid #0A6DFE; outline-offset:3px; }
@media (prefers-reduced-motion: reduce) { .cx-scene, .cx-star[data-on="true"], .cx-art-card, .cx-wave, .cx-wave path { animation:none !important; } .cx-rail { transition:none; } }
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
              {/* *** בקשה מפורשת ("שהכוכבים יעלו וירדו עם הצהוב - כמו תצוגת סאונד"): כל עוד לא דירגו - גל
                  שעובר על הכוכבים (עולים ונצבעים בצהוב אחד אחרי השני). ברגע שבוחרים דירוג - נעצר. */}
              <svg
                width="46"
                height="46"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={rating === 0 ? "cx-wave" : undefined}
                style={rating === 0 ? { animationDelay: `${(star - 1) * 0.13}s` } : undefined}
              >
                <path
                  d={STAR_PATH}
                  fill={on ? "#F5B301" : "rgba(255,255,255,0.14)"}
                  strokeLinejoin="round"
                  style={rating === 0 ? { animationDelay: `${(star - 1) * 0.13}s` } : undefined}
                />
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

/* ───────────── מפה / טיול: מסך יצירה ברור, באותו סגנון כמו הביקורת ───────────── */

/* *** בקשה מפורשת ("המפה זהה מדי ולא ברור מאיפה מעלים"): במקום המפה עצמה - מסך יצירה מזמין עם
   כפתור ראשי אחד ("מפה חדשה" / "טיול חדש"), ובחירת מקומות מהמפה כאפשרות משנית (נפתחת במסך מלא). */
const IMG = "/images/vacation-destinations";
const DEFAULT_MAP_IMAGES = [`${IMG}/telaviv.png`, `${IMG}/haifa.png`, `${IMG}/jerusalem.png`];
const DEFAULT_TRIP_IMAGES = [`${IMG}/zafongolan.png`, `${IMG}/tiberias.png`, `${IMG}/haifa.png`];

/* *** בקשה מפורשת: בתמונות - המקומות של המשתמש עצמו (ששמר / העלה, כמו "שלי" במפה). משתמש בלי
   מספיק מקומות רואה את תמונות ברירת המחדל. */
interface MyPlace {
  imageUrl: string;
  latitude: number;
  longitude: number;
}

function usePersonalArt(enabled: boolean): { map: string[]; trip: string[] } {
  const [places, setPlaces] = useState<MyPlace[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/social/map")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pins?: (MyPlace & { imageUrl: string | null; hasSelf?: boolean; savedByViewer?: boolean })[] } | null) => {
        if (cancelled || !data?.pins) return;
        const seen = new Set<string>();
        const mine = data.pins.filter((p) => {
          if (!(p.hasSelf || p.savedByViewer) || !p.imageUrl || seen.has(p.imageUrl)) return false;
          seen.add(p.imageUrl);
          return true;
        }) as MyPlace[];
        setPlaces(mine);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const img = (p: MyPlace) => optimizeImage(p.imageUrl, 240);
  const map = places.length >= 3 ? places.slice(0, 3).map(img) : DEFAULT_MAP_IMAGES;

  // טיול: 3 מקומות קרובים זה לזה - המקום עם השכנים הקרובים ביותר ושני השכנים שלו, מסודרים מערב -> מזרח
  let trip = DEFAULT_TRIP_IMAGES;
  if (places.length >= 3) {
    const dist = (a: MyPlace, b: MyPlace) => (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;
    let best: MyPlace[] = places.slice(0, 3);
    let bestScore = Infinity;
    for (const center of places.slice(0, 40)) {
      const near = places
        .filter((p) => p !== center)
        .sort((x, y) => dist(center, x) - dist(center, y))
        .slice(0, 2);
      const score = near.reduce((sum, p) => sum + dist(center, p), 0);
      if (score < bestScore) {
        bestScore = score;
        best = [center, ...near];
      }
    }
    trip = [...best].sort((x, y) => x.longitude - y.longitude).map(img);
  }
  return { map, trip };
}

function Photo({ src, className = "", style }: { src: string; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" draggable={false} className={`object-cover ${className}`} style={style} />;
}

/** מפה: שלוש תמונות של מקומות בערימה, כל אחת עם נעץ - "אוסף של מקומות" במבט אחד */
function MapArt({ images }: { images: string[] }) {
  const [a, b, c] = images;
  const cards = [
    { src: a, rotate: -9, x: -78, y: 10, z: 1 },
    // *** בקשה מפורשת ("הכרטיסייה הימנית - תהיה מעל"): הכרטיס הימני עליון בערימה
    { src: b, rotate: 8, x: 78, y: 12, z: 3 },
    { src: c, rotate: 0, x: 0, y: -6, z: 2 },
  ];
  return (
    <div className="relative h-[170px] w-[280px]" aria-hidden="true">
      {cards.map((c, i) => (
        <div
          key={`${i}-${c.src}`}
          className="cx-art-card absolute left-1/2 top-1/2 h-[128px] w-[104px] overflow-hidden rounded-[18px] border-[3px] border-white/90 shadow-[0_18px_36px_-14px_rgba(0,0,0,0.8)]"
          style={{ transform: `translate(calc(-50% + ${c.x}px), calc(-50% + ${c.y}px)) rotate(${c.rotate}deg)`, zIndex: c.z, animationDelay: `${i * 70}ms` }}
        >
          <Photo src={c.src} className="h-full w-full" />
          <span className="absolute bottom-1.5 end-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#7C3AED] text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s7-5.8 7-12a7 7 0 1 0-14 0c0 6.2 7 12 7 12Zm0-9.3a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" /></svg>
          </span>
        </div>
      ))}
    </div>
  );
}

/** טיול: שלוש תחנות ממוספרות על קו מסלול מקווקו, ויום 1 · יום 2 */
function TripArt({ images }: { images: string[] }) {
  const [a, b, c] = images;
  const stops = [
    { src: a, n: 1, x: 40, y: 92, color: "#0A6DFE" },
    { src: b, n: 2, x: 140, y: 42, color: "#0A6DFE" },
    { src: c, n: 3, x: 240, y: 88, color: "#E0701A" },
  ];
  return (
    <div className="relative h-[176px] w-[280px]" aria-hidden="true">
      <svg className="absolute inset-0" width="280" height="170" viewBox="0 0 280 170" fill="none">
        <path d="M40 92 C 70 50, 100 42, 140 42" stroke="#0A6DFE" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
        <path d="M140 42 C 185 42, 215 62, 240 88" stroke="#E0701A" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
      </svg>
      {stops.map((s, i) => (
        <div key={s.n} className="cx-art-card absolute" style={{ left: s.x, top: s.y, transform: "translate(-50%, -50%)", animationDelay: `${i * 90}ms` }}>
          <div className="h-[70px] w-[70px] overflow-hidden rounded-full border-[3px] border-white shadow-[0_14px_28px_-12px_rgba(0,0,0,0.8)]">
            <Photo src={s.src} className="h-full w-full" />
          </div>
          <span
            className="absolute -top-1 end-[-4px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#121214] text-[13px] font-bold text-white"
            style={{ background: s.color }}
          >
            {s.n}
          </span>
        </div>
      ))}
      <span className="absolute left-[40px] top-[146px] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0A6DFE]/20 px-2.5 py-1 text-[11.5px] font-semibold text-[#6DA8FF]">יום 1</span>
      <span className="absolute left-[240px] top-[146px] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#E0701A]/20 px-2.5 py-1 text-[11.5px] font-semibold text-[#F2A15E]">יום 2</span>
    </div>
  );
}

function CreateStage({
  art,
  title,
  sub,
  cta,
  onCreate,
  onPick,
}: {
  art: ReactNode;
  title: string;
  sub: string;
  cta: string;
  onCreate: () => void;
  onPick: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      {art}
      <h2 className="mt-7 text-[24px] font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-[19rem] text-balance text-[14.5px] leading-snug text-white/55">{sub}</p>
      <button
        type="button"
        onClick={onCreate}
        className="cx-press mt-7 flex h-12 w-full max-w-[20rem] items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-[#0f1419]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {cta}
      </button>
      <button type="button" onClick={onPick} className="cx-press mt-4 flex items-center gap-1.5 text-[14px] font-medium text-white/60 active:text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        או <span className="font-semibold text-white">בחרו מקומות מהמפה</span>
      </button>
    </div>
  );
}

/** בחירת מקומות מהמפה - מסך מלא מעל עמוד התוכן, עם כפתור סגירה */
function PickOverlay({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: "max(var(--sat), 14px)" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="cx-press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-white">{title}</p>
          <p className="text-[13px] text-white/55">געו בנעצים או בכרטיסים כדי לבחור</p>
        </div>
      </div>
      <div className="relative mx-3 mb-3 flex-1 overflow-hidden rounded-[24px]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <PlacesFriendsMap pickMode />
      </div>
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
 *  מקום -> /places/create?pick=1&rating=N (בחירת המקום, ואז העורך) · ?add=1 להוספת מקום חדש
 *  מפה  -> בחירת נעצים -> /places/collection/create (מפה) או /places/trip/create (מסלול)
 */
export default function ContentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [pickOpen, setPickOpen] = useState<null | "map" | "trip">(null);
  const art = usePersonalArt(!!user);
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
                    onSearch={(rating) => router.push(`/places/create?pick=1${rating ? `&${ratingQuery(rating)}` : ""}`)}
                    onAdd={(rating) => router.push(`/places/create?add=1${rating ? `&${ratingQuery(rating)}` : ""}`)}
                  />
                )}
                {mode.id === "map" && (
                  <CreateStage
                    art={<MapArt images={art.map} />}
                    title="צרו מפה משלכם"
                    sub="אטרקציות, מסעדות ומקומות שאהבתם - סביב רעיון אחד"
                    cta="מפה חדשה"
                    onCreate={() => router.push("/places/collection/create?type=places&origin=content")}
                    onPick={() => setPickOpen("map")}
                  />
                )}
                {mode.id === "trip" && (
                  <CreateStage
                    art={<TripArt images={art.trip} />}
                    title="בנו טיול לפי מסלול"
                    sub="תחנות לפי סדר, יום אחרי יום - עם מפה וניווט"
                    cta="טיול חדש"
                    onCreate={() => router.push("/places/trip/create")}
                    onPick={() => setPickOpen("trip")}
                  />
                )}
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
      {pickOpen && <PickOverlay title={pickOpen === "map" ? "בחרו מקומות למפה" : "בחרו תחנות לטיול"} onClose={() => setPickOpen(null)} />}
    </>
  );
}
