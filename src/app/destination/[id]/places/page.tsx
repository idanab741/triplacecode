import Image from "next/image";
import Link from "next/link";
import { getDestinationById } from "@/services/destinations/destinationsServerService";
import {
  getPlacesByCityAndCategory,
  getPlacesByCityAndKeywords,
  RESTAURANT_CATEGORY_KEYWORDS,
  ATTRACTION_CATEGORY_KEYWORDS,
  NATURE_CATEGORY_KEYWORDS,
  NIGHTLIFE_CATEGORY_KEYWORDS,
  type PlaceSummary,
} from "@/services/places/placesServerService";
import { MainBottomNav } from "@/components/MainBottomNav";
import { WHITE_ICON_FILTER } from "@/screens/layout/TripHeroHeader";

interface DestinationPlacesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

// "ראה הכל" אמור להיות ממש הכל - 200 מכסה בנוחות כל עיר ריאלית (אילת
// למשל: 24 מסעדות, 57 אטרקציות - שתיהן רחוק מ-200), לא רק "עוד קצת".
const SEE_ALL_LIMIT = 200;

const TYPE_LABELS: Record<string, string> = {
  restaurants: "מסעדות",
  attractions: "אטרקציות",
  nature: "טבע",
  hotels: "מלונות",
  nightlife: "חיי לילה",
};

/**
 * "ראה הכל" ל-PlaceRow.tsx בעמוד יעד (תיקון Product מפורש: "למה אין לי
 * בכל העמודים אוטומטית כפתור של ראה עוד??") - גריד מלא (לא גלילה
 * אופקית מוגבלת-10 כמו בעמוד ההורה) של כל היעדים התואמים type בעיר של
 * היעד הזה, עד SEE_ALL_LIMIT. אותה לוגיקת התאמה בדיוק כמו העמוד ההורה
 * (מילות-מפתח מטושטשות ל-restaurants/attractions/nightlife, שוויון
 * מדויק ל-hotels) - ר' placesServerService.ts.
 */
export default async function DestinationPlacesPage({ params, searchParams }: DestinationPlacesPageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const destination = await getDestinationById(id);

  if (!destination || !type || !(type in TYPE_LABELS)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-bold text-ink">לא נמצא</p>
        <Link href="/home" className="text-sm text-accent">
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  let places: PlaceSummary[];
  if (type === "restaurants") {
    places = await getPlacesByCityAndKeywords(destination.name, RESTAURANT_CATEGORY_KEYWORDS, SEE_ALL_LIMIT);
  } else if (type === "attractions") {
    places = await getPlacesByCityAndKeywords(destination.name, ATTRACTION_CATEGORY_KEYWORDS, SEE_ALL_LIMIT);
  } else if (type === "nature") {
    places = await getPlacesByCityAndKeywords(destination.name, NATURE_CATEGORY_KEYWORDS, SEE_ALL_LIMIT);
  } else if (type === "nightlife") {
    places = await getPlacesByCityAndKeywords(destination.name, NIGHTLIFE_CATEGORY_KEYWORDS, SEE_ALL_LIMIT);
  } else {
    places = await getPlacesByCityAndCategory(destination.name, "hotels", SEE_ALL_LIMIT);
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* *** תיקון (בר שקוף מעל ה-HERO - אותו טיפול כמו destination/[id]/page.tsx) */}
      <div className="relative h-72 w-full">
        <div className="absolute inset-x-0 top-0 z-30 h-16">
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className={`object-contain ${WHITE_ICON_FILTER}`} />
            <Link
              href={`/destination/${id}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center"
              aria-label="חזרה ליעד"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
              >
                <path d="m14 6-6 6 6 6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* תיקון Product מפורש ("למה אין את התמונה של היעד? מעל
            המסעדות?") - אותה תמונת hero בדיוק כמו בעמוד היעד ההורה
            (destination.image_url), כדי שברור על איזה יעד מסתכלים גם
            פה, לא רק כותרת טקסט. */}
        {destination.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={destination.image_url} alt={destination.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.65),transparent)] px-6 pb-5 pt-16">
          <h1 className="text-2xl font-extrabold text-white">
            {TYPE_LABELS[type]} - {destination.name}
          </h1>
        </div>
      </div>

      {places.length === 0 ? (
        <div className="px-6 pt-6">
          <div className="rounded-card bg-bg-secondary px-4 py-6 text-center text-sm text-ink-secondary">
            עוד לא אספנו {TYPE_LABELS[type]} ליעד הזה
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-6 pt-5">
          {places.map((place) => (
            <Link key={place.id} href={`/place/${place.id}`} className="block">
              <div className="h-32 w-full overflow-hidden rounded-card bg-bg-secondary shadow-soft">
                {place.image_urls[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={place.image_urls[0]} alt={place.name} className="h-full w-full object-cover" />
                )}
              </div>
              <p className="mt-1.5 truncate text-sm font-medium text-ink">{place.name}</p>
              {place.rating != null && <p className="text-xs text-ink-secondary">★ {place.rating.toFixed(1)}</p>}
            </Link>
          ))}
        </div>
      )}

      <MainBottomNav active="home" />
    </div>
  );
}
