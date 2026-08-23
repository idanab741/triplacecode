import { CRUISE_LINES } from "@/constants/worldwideVacationCategories";

/**
 * "קרוזים ושייט" (Audit - "4 תמונות הספינות... שיהיה בגודל של הכרטיסייה
 * בעמוד כמו שיש בעמוד"): תוקן - במקום לוגו ממורכז על רקע אחיד, עכשיו
 * זה בדיוק אותו כרטיס-יעד כמו ב-WorldwideCategorySection.tsx (220x150,
 * rounded-card, shadow-soft, תמונה מלאה עם גרדיאנט+שם בתחתית) - חברת
 * ספנות מוצגת עם תמונת הספינה עצמה, לא יעד גיאוגרפי, אז עדיין בלי דגל
 * ובלי קישור ל-/destination (אין לה רשומה שם בכלל) - div רגיל, לא Link.
 */
export function CruiseLinesSection() {
  return (
    <section className="px-6">
      <div className="mb-3 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/vacation-type-icons/cruise.png"
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <h3 className="text-lg font-semibold text-ink">קרוזים ושייט</h3>
      </div>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
        {CRUISE_LINES.map((line) => (
          <div
            key={line.slug}
            className="relative block h-[220px] w-[150px] shrink-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={line.imageUrl}
              alt={line.name}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
              <p className="truncate text-sm font-bold leading-tight text-white">{line.name}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
