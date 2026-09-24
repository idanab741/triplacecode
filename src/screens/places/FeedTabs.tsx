"use client";

/** *** בקשה מפורשת: הפיד עבר לעמוד הבית עם "עבורך / חברים". המפה יצאה מהפיד
 *  והפכה לעמוד place's עצמו. */
export type PlacesFeedView = "for_you" | "friends";

const TABS: { id: PlacesFeedView; label: string }[] = [
  { id: "for_you", label: "עבורך" },
  { id: "friends", label: "חברים" },
];

/**
 * *** עיצוב מחדש (בקשה מפורשת - "נראה מצועצע, פחות טוב"): טאבים שטוחים ונקיים
 * כמו בפידים המוכרים (X/אינסטגרם) - שתי לשוניות ברוחב מלא, קו תחתון הפרדה, וקו
 * הדגשה סגול קצר שגולש בין הלשוניות. בלי כדורים, צללים וגרדיאנטים.
 * right + translateX שלילי, כי העמוד RTL (הלשונית הראשונה בימין).
 */
export function FeedTabs({ active, onChange }: { active: PlacesFeedView; onChange: (view: PlacesFeedView) => void }) {
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.id === active)
  );

  return (
    <div role="tablist" aria-label="תצוגת פיד" className="relative grid grid-cols-2 border-b border-black/[0.07] bg-transparent">
      {TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className="py-3 text-[15px] outline-none transition-colors focus-visible:bg-black/[0.04] active:bg-black/[0.03]"
            style={{
              color: selected ? "var(--color-ink)" : "var(--color-ink-secondary, #8a94a6)",
              fontWeight: selected ? 700 : 500,
            }}
          >
            {tab.label}
          </button>
        );
      })}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 flex w-1/2 justify-center"
        style={{ transform: `translateX(${-activeIndex * 100}%)`, transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <span className="h-[3px] w-14 rounded-full" style={{ background: "var(--color-places-purple)" }} />
      </div>
    </div>
  );
}
