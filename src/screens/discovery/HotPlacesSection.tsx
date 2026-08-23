import type { DiscoveryPlace } from "@/services/places/discoveryService";

interface HotPlacesSectionProps {
  places: DiscoveryPlace[];
  from: string;
  title?: string;
  description?: string;
  /** תיקון (Audit - "אני רוצה שבכל קטגוריה... יופיע ראה עוד... כמו
   *  שיש בחיי לילה ובילויים"): "הכי חמים עכשיו" היה היחיד בלי קישור
   *  "ראה הכל" בכל 6 עמודי ה-Discovery (כל שאר הסקשנים כבר קיבלו את
   *  זה דרך DiscoverySection.tsx). אופציונלי בכוונה - אם לא מועבר,
   *  שום דבר לא נשבר (התנהגות זהה לקודם). */
  seeAllHref?: string;
}

/**
 * "🔥 הכי חמים עכשיו" (Places, לא Destinations) - קומפוננטה משותפת
 * ל"טיול יומי" ול"חופשה בארץ" (Audit - "אין ליצור Duplicate component
 * רק כדי לעשות את זה מהר"). היה קוד מזוהה כמעט-לגמרי כפול בשני העמודים -
 * חולץ לכאן פעם אחת. `title`/`description` ניתנים לדריסה (ברירת המחדל
 * זהה לשני העמודים כרגע, אבל אין צורך שיישארו זהים בעתיד).
 */
export function HotPlacesSection({
  places,
  from,
  title = "🔥 הכי חמים עכשיו",
  description = "היעדים והבילויים הכי פופולריים באזור.",
  seeAllHref,
}: HotPlacesSectionProps) {
  return (
    <section className="px-6">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        {seeAllHref && places.length > 0 && (
          <a href={seeAllHref} className="text-sm font-medium text-[var(--color-primary-start)]">
            ראה הכל
          </a>
        )}
      </div>
      <p className="mb-3 text-sm text-ink-secondary">{description}</p>
      {places.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-card bg-bg-secondary px-6 py-8 text-center">
          <span className="text-2xl">🔥</span>
          <p className="text-sm font-medium text-ink">אין כרגע יעדים זמינים</p>
          <p className="text-xs text-ink-secondary">נחזור עם המלצות חדשות בקרוב</p>
        </div>
      ) : (
        <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
          {places.map((place) => (
            <a
              key={place.id}
              href={`/place/${place.id}?from=${encodeURIComponent(from)}`}
              className="relative block h-[220px] w-[150px] shrink-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft"
            >
              {place.imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={place.imageUrls[0]} alt={place.name} className="h-full w-full object-cover" loading="lazy" />
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white">{place.name}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
