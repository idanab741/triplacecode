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
import { PlaceHeroActions } from "@/screens/place/PlaceHeroActions";

interface DestinationPlacesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

// "ראה הכל" אמור להיות ממש הכל - 200 מכסה בנוחות כל עיר ריאלית
const SEE_ALL_LIMIT = 200;

const TYPE_LABELS: Record<string, string> = {
  restaurants: "מסעדות",
  attractions: "אטרקציות",
  nature: "טבע",
  hotels: "מלונות",
  nightlife: "חיי לילה",
};

export default async function DestinationPlacesPage({
  params,
  searchParams,
}: DestinationPlacesPageProps) {
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
    places = await getPlacesByCityAndKeywords(
      destination.name,
      RESTAURANT_CATEGORY_KEYWORDS,
      SEE_ALL_LIMIT
    );
  } else if (type === "attractions") {
    places = await getPlacesByCityAndKeywords(
      destination.name,
      ATTRACTION_CATEGORY_KEYWORDS,
      SEE_ALL_LIMIT
    );
  } else if (type === "nature") {
    places = await getPlacesByCityAndKeywords(
      destination.name,
      NATURE_CATEGORY_KEYWORDS,
      SEE_ALL_LIMIT
    );
  } else if (type === "nightlife") {
    places = await getPlacesByCityAndKeywords(
      destination.name,
      NIGHTLIFE_CATEGORY_KEYWORDS,
      SEE_ALL_LIMIT
    );
  } else {
    places = await getPlacesByCityAndCategory(
      destination.name,
      "hotels",
      SEE_ALL_LIMIT
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="relative h-72 w-full">
        <PlaceHeroActions
          placeId={destination.id}
          placeName={destination.name}
          placeType="destination"
          backHref={`/destination/${id}`}
        />

        {destination.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={destination.image_url}
            alt={destination.name}
            className="h-full w-full object-cover"
          />
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
            <Link
              key={place.id}
              href={`/place/${place.id}`}
              className="block"
            >
              <div className="h-32 w-full overflow-hidden rounded-card bg-bg-secondary shadow-soft">
                {place.image_urls[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={place.image_urls[0]}
                    alt={place.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <p className="mt-1.5 truncate text-sm font-medium text-ink">
                {place.name}
              </p>

              {place.rating != null && (
                <p className="text-xs text-ink-secondary">
                  ★ {place.rating.toFixed(1)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <MainBottomNav active="home" />
    </div>
  );
}