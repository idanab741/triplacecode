import type { ReactNode } from "react";

/**
 * *** בקשה מפורשת ("עדיין לא ברור - צריך דוגמאות, משהו יותר טוב"): בעמוד התוכן כל סוג העלאה מציג
 * דוגמה חיה של איך התוצאה תיראה באפליקציה - פוסט, המלצה על מקום, חוויה ומסלול - ככרטיס לבן
 * שמרחף מעל הרקע הצבעוני. רק תצוגה (aria-hidden), בלי נתונים אמיתיים.
 */

const IMG = "/images/vacation-destinations";

function Avatar({ letter, color }: { letter: string; color: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: color }}>
      {letter}
    </span>
  );
}

function Frame({ children, tilt = 0 }: { children: ReactNode; tilt?: number }) {
  return (
    <div
      className="cx-preview w-[78%] max-w-[270px] overflow-hidden rounded-[22px] bg-white text-[#0f1419] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.65)]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </div>
  );
}

function PostPreview() {
  return (
    <Frame tilt={-2}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar letter="נ" color="#FF8FB8" />
        <div className="min-w-0 leading-tight">
          <p className="text-[12.5px] font-bold">נועה לוי</p>
          <p className="text-[10.5px] text-[#5b6472]">לפני שעה</p>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${IMG}/telaviv.png`} alt="" className="aspect-[4/3] w-full object-cover" />
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center gap-3 text-[12px] font-semibold">
          <span className="cx-heart text-[#e5484d]">♥ 128</span>
          <span className="text-[#5b6472]">💬 12</span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug">שקיעה מושלמת בחוף 🌅 חייבים לבוא לפה בערב</p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F1EDFB] px-2 py-0.5 text-[11px] font-semibold text-[#7C3AED]">📍 חוף הצוק</span>
      </div>
    </Frame>
  );
}

function PlacePreview() {
  return (
    <Frame tilt={2}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${IMG}/haifa.png`} alt="" className="aspect-[16/10] w-full object-cover" />
        <span className="absolute end-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold">☕ בית קפה</span>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="text-[14px] font-extrabold">קפה על המדרגות</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[14px] leading-none tracking-tight text-[#F59E0B]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="cx-star inline-block" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
                ★
              </span>
            ))}
          </span>
          <span className="text-[12px] font-bold">5.0</span>
        </div>
        <div className="mt-2 flex gap-2 rounded-xl bg-[#F5F6F8] p-2">
          <Avatar letter="ע" color="#B69CFF" />
          <p className="text-[11.5px] leading-snug text-[#3a3f4b]">&quot;הקרואסון הכי טוב שאכלתי, והנוף מהמרפסת מטורף&quot;</p>
        </div>
      </div>
    </Frame>
  );
}

function CollectionPreview() {
  const pics = ["telaviv", "eilat", "jerusalem", "tiberias"];
  return (
    <Frame tilt={-1.5}>
      <div className="relative grid grid-cols-2 gap-0.5">
        {pics.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={`${IMG}/${p}.png`} alt="" className="aspect-square w-full object-cover" />
        ))}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-white">
          <span className="block text-[14px] font-extrabold leading-tight">בתי הקפה הכי שווים בת״א</span>
          <span className="block text-[11px] text-white/85">8 מקומות</span>
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar letter="ד" color="#38D6E8" />
        <p className="text-[12px] font-semibold">דניאל · <span className="font-normal text-[#5b6472]">חוויה</span></p>
      </div>
    </Frame>
  );
}

function TripPreview() {
  const stops = [
    { x: 22, y: 76, n: 1, img: "zafongolan", day: "#0A6DFE" },
    { x: 50, y: 48, n: 2, img: "tiberias", day: "#0A6DFE" },
    { x: 78, y: 26, n: 1, img: "haifa", day: "#E0701A" },
  ];
  return (
    <Frame tilt={1.5}>
      <div className="relative aspect-[16/11] w-full overflow-hidden bg-[#EAF1E4]">
        {/* "מפה" - פסי דרך ומים עדינים */}
        <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M0 58 C 25 50, 40 64, 100 40" stroke="#fff" strokeWidth="3" fill="none" />
          <path d="M70 0 C 64 20, 88 30, 84 70" stroke="#CFE3F5" strokeWidth="7" fill="none" />
          <path className="cx-route" d="M22 53 L50 33.6 L78 18" stroke="#0A6DFE" strokeWidth="1.6" strokeDasharray="3 2.4" fill="none" strokeLinecap="round" />
        </svg>
        {stops.map((s, i) => (
          <span key={i} className="cx-pin absolute -translate-x-1/2 -translate-y-full" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${0.2 + i * 0.18}s` }}>
            <span className="relative block h-9 w-9 overflow-hidden rounded-full border-[2.5px] border-white shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG}/${s.img}.png`} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="absolute -start-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-white ring-2 ring-white" style={{ background: s.day }}>
              {s.n}
            </span>
          </span>
        ))}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="text-[14px] font-extrabold">סופ״ש בצפון</p>
        <div className="mt-1.5 flex gap-1.5 text-[10.5px] font-bold">
          <span className="rounded-full bg-[#E8F1FF] px-2 py-0.5 text-[#0A6DFE]">● יום 1 · 2 תחנות</span>
          <span className="rounded-full bg-[#FDEEE2] px-2 py-0.5 text-[#E0701A]">● יום 2 · תחנה אחת</span>
        </div>
      </div>
    </Frame>
  );
}

export type CreateModeId = "post" | "place" | "collection" | "trip";

export function CreateModePreview({ mode }: { mode: CreateModeId }) {
  if (mode === "post") return <PostPreview />;
  if (mode === "place") return <PlacePreview />;
  if (mode === "collection") return <CollectionPreview />;
  return <TripPreview />;
}

/** אנימציות הדוגמאות - נכנס לעמוד עם ה-CSS שלו */
export const CREATE_PREVIEW_CSS = `
.cx-preview { animation:cx-preview-in .55s cubic-bezier(.2,.8,.2,1) both; }
@keyframes cx-preview-in { from { opacity:0; transform:translateY(22px) scale(.94) rotate(0deg); } }
.cx-star { animation:cx-star-in .35s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes cx-star-in { from { opacity:0; transform:scale(.2); } }
.cx-heart { display:inline-block; animation:cx-heart-beat 1.6s ease-in-out .5s infinite; }
@keyframes cx-heart-beat { 0%,100% { transform:scale(1); } 12% { transform:scale(1.25); } 24% { transform:scale(1); } }
.cx-pin { animation:cx-pin-drop .45s cubic-bezier(.3,1.5,.5,1) both; }
@keyframes cx-pin-drop { from { opacity:0; transform:translateY(-14px); } }
.cx-route { stroke-dashoffset:60; animation:cx-route-draw 1.2s ease .5s forwards; }
@keyframes cx-route-draw { to { stroke-dashoffset:0; } }
@media (prefers-reduced-motion: reduce) { .cx-preview, .cx-star, .cx-heart, .cx-pin, .cx-route { animation:none !important; } .cx-route { stroke-dashoffset:0; } }
`;
