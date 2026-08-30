import Link from "next/link";
import type { DiscoveryPlace } from "@/services/places/discoveryService";
import { DiscoveryPlaceCard } from "./DiscoveryPlaceCard";

interface DiscoverySectionProps {
  emoji: string;
  title: string;
  places: DiscoveryPlace[];
  /** קישור "ראה הכל" - נבנה מראש ע"י ה-caller (page.tsx), עם query
   *  params למיקום+קטגוריה, כדי שהעמוד הזה יישאר server component טהור
   *  בלי שום state/routing logic פנימי משלו. */
  seeAllHref: string;
  discoverySlug: string;
}

/**
 * סקשן/קרוסלה אחידה לכל הקטגוריות ה"רגילות" בעמוד ה-Discovery (Audit
 * מול "PROMPT 2" סעיף 13-14 - שינוי מהמימוש הקודם: קטגוריה **תמיד**
 * מוצגת, גם עם 0 תוצאות - "הקטגוריות הן חלק קבוע מה-Discovery
 * Experience"). אם אין תוצאות - Empty State מעוצב בתוך הסקשן (לא
 * הודעת שגיאה, לא spinner קבוע, לא הסתרת הסקשן כולו). "ראה הכל" מוצג
 * רק כשיש בפועל מה להראות.
 */
export function DiscoverySection({ emoji, title, places, seeAllHref }: DiscoverySectionProps) {
  const hasResults = places.length > 0;

  return (
    <section className="px-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">
          {emoji} {title}
        </h3>
        {hasResults && (
          <Link href={seeAllHref} className="text-sm font-medium text-[var(--color-primary-start)]">
            ראה הכל
          </Link>
        )}
      </div>

      {hasResults ? (
        <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
          {places.map((place) => (
            <DiscoveryPlaceCard key={place.id} place={place} from="day-trip-discover" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 rounded-card bg-bg-secondary px-6 py-8 text-center">
          <span className="text-2xl">{emoji}</span>
          <p className="text-sm font-medium text-ink">אין כרגע יעדים זמינים באזור</p>
          <p className="text-xs text-ink-secondary">נחזור עם המלצות חדשות בקרוב</p>
        </div>
      )}
    </section>
  );
}
