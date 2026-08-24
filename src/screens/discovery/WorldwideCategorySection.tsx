import Link from "next/link";
import {
  WORLDWIDE_DESTINATION_REGISTRY,
  type WorldwideVacationCategory,
} from "@/constants/worldwideVacationCategories";

interface WorldwideCategorySectionProps {
  category: WorldwideVacationCategory;
  /** slug -> UUID אמיתי מטבלת destinations (או null אם לא נמצאה התאמה) -
   *  מגיע מ-/api/discovery/worldwide-categories, נשלף פעם אחת בעמוד. */
  destinationIdBySlug: Record<string, string | null>;
}

/**
 * סקשן קטגוריית "חופשה בחו״ל" בודדת (Audit - "רשימה של כל סוג טיול,
 * בתוכו יעדים מותאמים... עם האייקון מעמוד PUBLIC IMAGE"): כותרת עם
 * אייקון תמונה אמיתי (לא אימוג'י) + אימוג'י+כיתוב, ומתחת רשימת כרטיסי
 * יעדים בגלילה אופקית - אותו דפוס בדיוק כמו שאר הסקשנים ב-Discovery
 * (DiscoverySection.tsx/HotPlacesSection.tsx), רק עם מקור נתונים סטטי
 * במקום DB query. כרטיס עם התאמה אמיתית (destinationId != null) מוביל
 * ל-/destination/[id] הקיים; בלי התאמה - עדיין מוצג, פשוט לא לחיץ (לא
 * נעלם, לא שגיאה).
 */
export function WorldwideCategorySection({ category, destinationIdBySlug }: WorldwideCategorySectionProps) {
  if (category.destinations.length === 0) return null;

  return (
    <section className="px-6">
      <div className="mb-3 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={category.iconUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <h3 className="text-lg font-semibold text-ink">{category.title}</h3>
      </div>

      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
        {category.destinations.map((ref, i) => {
          const entry = WORLDWIDE_DESTINATION_REGISTRY[ref.slug];
          if (!entry) return null;
          const imageUrl = ref.imageUrl ?? entry.imageUrl;
          const destinationId = destinationIdBySlug[ref.slug];
          // subtitle כ-query param - כך שעמוד היעד (אותו עמוד אחד לכל
          // יעד ייחודי!) יודע להציג את סקשן תת-היעד המתאים (ר'
          // getDestinationEditionSection) רק כשמגיעים דרך הכרטיס הזה
          // ספציפית, ולא כשנכנסים ליעד ה"רגיל".
          const href = destinationId
            ? ref.subtitle
              ? `/destination/${destinationId}?subtitle=${encodeURIComponent(ref.subtitle)}`
              : `/destination/${destinationId}`
            : null;
          const cardContent = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white">
                  {entry.flag} {entry.name}
                </p>
                {ref.subtitle && <p className="truncate text-[11px] text-white/85">{ref.subtitle}</p>}
              </div>
            </>
          );
          const className = "relative block h-[220px] w-[150px] shrink-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft";
          return href ? (
            <Link key={`${ref.slug}-${i}`} href={href} className={className}>
              {cardContent}
            </Link>
          ) : (
            <div key={`${ref.slug}-${i}`} className={className}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </section>
  );
}
