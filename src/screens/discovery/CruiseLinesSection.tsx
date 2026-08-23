import { CRUISE_LINES } from "@/constants/worldwideVacationCategories";

/**
 * "קרוזים ושייט" (Audit - "למה הקרוזים לא באותו גודל של כל השאר??"):
 * תוקן - אותו גודל כרטיס בדיוק כמו שאר הקטגוריות (220x150, rounded-card,
 * shadow-soft). עדיין שונה מהם *ויזואלית* (לוגו ממורכז על רקע אחיד,
 * לא תמונת נוף עם גרדיאנט+דגל) כי חברת ספנות היא לא יעד גיאוגרפי -
 * אין לה subtitle/דגל, ואין קישור ל-/destination (אין לה רשומה שם בכלל).
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
            className="flex h-[220px] w-[150px] shrink-0 flex-col items-center justify-center gap-3 rounded-card bg-bg-secondary px-3 shadow-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={line.logoUrl}
              alt={line.name}
              className="h-16 max-w-[120px] object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <p className="text-center text-sm font-medium leading-tight text-ink">{line.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
