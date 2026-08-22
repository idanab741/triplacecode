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
 * מול "PROMPT 1" סעיף 15/16): כותרת+אימוג'י, שורת כרטיסים בגלילה
 * אופקית (אותו דפוס בדיוק כמו QuickCategories.tsx/DiscoverCard.tsx -
 * flex + overflow-x-auto, לא ספריית קרוסלה נוספת), ו"ראה הכל". EMPTY
 * STATE (סעיף 16 - "לא להציג כרטיסים לא רלוונטיים רק כדי למלא מקום"):
 * אם אין תוצאות בכלל, הסקשן לא מוצג - לא כרטיסי placeholder.
 */
export function DiscoverySection({ emoji, title, places, seeAllHref }: DiscoverySectionProps) {
  if (places.length === 0) return null;

  return (
    <section className="px-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">
          {emoji} {title}
        </h3>
        <Link href={seeAllHref} className="text-sm font-medium text-[var(--color-primary-start)]">
          ראה הכל
        </Link>
      </div>

      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
        {places.map((place) => (
          <DiscoveryPlaceCard key={place.id} place={place} from="day-trip-discover" />
        ))}
      </div>
    </section>
  );
}
