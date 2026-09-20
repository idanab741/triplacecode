"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CollectionTypeSheet } from "@/screens/collections/CollectionTypeSheet";

type TileId = "post" | "place" | "collection" | "trip";

/* ───────────── אייקוני קו דקים, בגרדיאנט של האקסנט של כל ריבוע ───────────── */

function Icon({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" stroke={`url(#${id})`} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--a)" }} />
          <stop offset="1" style={{ stopColor: "var(--b)" }} />
        </linearGradient>
      </defs>
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

interface Tile {
  id: TileId;
  title: string;
  /** שורה אחת: מה זה. */
  sub: string;
  a: string;
  b: string;
}

const TILES: Tile[] = [
  { id: "post", title: "פוסט", sub: "שתפו רגע מהדרך", a: "#FF7AB6", b: "#FFA96B" },
  { id: "place", title: "מקום", sub: "המלצה על מקום שאהבתם", a: "#A78BFA", b: "#5EC8FF" },
  { id: "collection", title: "אוסף", sub: "מקומות וטיולים תחת רעיון אחד", a: "#4ADE9C", b: "#38D6E8" },
  { id: "trip", title: "טיול", sub: "מסלול תחנות מוכן לדרך", a: "#FCC24A", b: "#FF7F8E" },
];

const CSS = `
.cx-page { background:#000; color:#fff; min-height:100vh; min-height:100dvh; }
/* זוהר יחיד ושקט בראש העמוד - בלי תנועה */
.cx-glow { position:absolute; inset-inline:0; top:0; height:26rem; pointer-events:none;
  background:radial-gradient(ellipse 80% 100% at 50% 0%, rgba(0,124,254,.20), transparent 72%); }
.cx-hero { animation:cx-hero-in .8s cubic-bezier(.2,.8,.2,1) .05s backwards; }
@keyframes cx-hero-in { from{opacity:0; transform:translateY(22px)} to{opacity:1; transform:none} }

.cx-tile { position:relative; isolation:isolate; overflow:hidden; border-radius:26px; text-align:start;
  background:#0c0c0e; box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
  -webkit-tap-highlight-color:transparent; transition:transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .3s;
  animation:cx-in .6s cubic-bezier(.2,.8,.2,1) backwards; }
/* הילה עדינה בצבע הריבוע, מאחורי האייקון */
.cx-tile::before { content:""; position:absolute; z-index:-1; width:9rem; height:9rem; top:-3.2rem; inset-inline-start:-3rem;
  background:radial-gradient(circle, var(--a), transparent 68%); opacity:.16; transition:opacity .35s; }
.cx-tile:active { transform:scale(.97); }
@media (hover:hover) {
  .cx-tile:hover { box-shadow:inset 0 0 0 1px rgba(255,255,255,.18); }
  .cx-tile:hover::before { opacity:.3; }
}
.cx-tile:focus-visible { outline:2px solid var(--a); outline-offset:3px; }
@keyframes cx-in { from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:none} }
@media (prefers-reduced-motion: reduce) { .cx-tile, .cx-hero { animation:none !important; } }
`;

/**
 * "תוכן" - הטאב שבבר התחתון. עמוד יצירה שחור: הבר העליון של triplace (כמו בעמוד הבית), כותרת + שורת הסבר, ה-HERO (הדמות מציצה מעל
 * הכרטיסיות ומצביעה עליהן), ו-4 ריבועים (פוסט / מקום / אוסף / טיול - אותן 4 פעולות של תפריט ה-+ ב-places).
 * הבר התחתון שחור (tone="dark") - אייקונים ותוויות בלבן, הטאב הפעיל נשאר בצבעיו.
 * לחיצה על ריבוע מובילה לזרימת היצירה הקיימת - לא נוצרת כאן לוגיקה חדשה:
 *  פוסט -> /places?create=post · מקום -> /places/create
 *  אוסף -> "מה תרצו לאסוף?" -> /places/collection/create · טיול -> /places/trip/create
 */
export default function ContentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [collectionTypeOpen, setCollectionTypeOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  function handleSelect(id: TileId) {
    if (id === "post") router.push("/places?create=post");
    else if (id === "place") router.push("/places/create");
    else if (id === "collection") setCollectionTypeOpen(true);
    else router.push("/places/trip/create");
  }

  return (
    <>
      <HomeStatusBarTint />
      <style>{CSS}</style>

      <div className="cx-page relative isolate flex flex-col">
        <span className="cx-glow -z-10" aria-hidden="true" />

        {/* הבר העליון של triplace (אותו בר כמו בעמוד הבית: צ'אט · לוגו · התראות) */}
        <CollapsibleTopBar />

        <main className="flex flex-1 flex-col justify-start px-6 pb-32 pt-1">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-center text-[28px] font-extrabold leading-tight tracking-tight">מה ניצור היום?</h1>
            <p className="mx-auto mb-6 mt-1.5 max-w-[19rem] text-balance text-center text-[14px] leading-snug text-white/55">שתפו את המקומות, הטיולים והרעיונות שלכם</p>

            {/* ה-HERO: הדמות "מציצה" מעל קצה הכרטיסיות ומצביעה עליהן. החלק שמתחת לקצה התמונה (האצבע, ~6.6% מרוחב המכולה)
                יורד אל תוך הכרטיסיות - לכן margin שלילי, ו-pointer-events-none כדי לא לחסום לחיצה על הכרטיס. */}
            <div className="cx-hero pointer-events-none relative z-10 mx-auto -mb-[6.6%] w-[88%]" aria-hidden="true">
              <Image
                src="/images/content-hero.png"
                alt=""
                width={720}
                height={492}
                priority
                draggable={false}
                sizes="(max-width: 420px) 80vw, 340px"
                className="h-auto w-full select-none"
              />
            </div>

            <section aria-label="בחירת סוג תוכן ליצירה">
              <div className="grid w-full grid-cols-2 gap-3">
                {TILES.map((tile, i) => (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleSelect(tile.id)}
                    aria-label={`יצירת ${tile.title}: ${tile.sub}`}
                    className="cx-tile flex aspect-square flex-col justify-between p-4"
                    style={{ "--a": tile.a, "--b": tile.b, animationDelay: `${0.05 + i * 0.07}s` } as CSSProperties}
                  >
                    <span className="block h-11 w-11">{ART[tile.id]}</span>
                    <span className="block">
                      <span className="block text-[20px] font-bold leading-none text-white">{tile.title}</span>
                      <span className="mt-2 block min-h-[2.75em] text-balance text-[12px] leading-snug text-white/45">{tile.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* בר תחתון שחור: כל האייקונים והתוויות בלבן, חוץ מ"תוכן" (הטאב הפעיל) שנשאר בצבעיו */}
      <MainBottomNav active="content" tone="dark" />

      {collectionTypeOpen && (
        <CollectionTypeSheet
          onClose={() => setCollectionTypeOpen(false)}
          onSelect={(type) => router.push(`/places/collection/create?type=${type}`)}
        />
      )}
    </>
  );
}
