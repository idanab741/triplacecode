import Link from "next/link";
import { getPlaceById } from "@/services/places/placesServerService";
import { getTripAddPlaceById } from "@/services/tripadd/tripAddPlaceService";
import { Screen } from "@/components/ui";
import { AttractionView } from "@/screens/place/attraction/AttractionView";
import { attractionFromPlace, attractionFromTripAdd } from "@/screens/place/attraction/loadAttraction";
import { TripLaceRatingSection } from "@/screens/place/TripLaceRatingSection";
import { TripAddRatingSection } from "@/screens/place/TripAddRatingSection";

interface PlacePageProps {
  params: Promise<{ id: string }>;
  /** "from" אופציונלי - איזה טאב בבר התחתון מודגש. */
  searchParams: Promise<{ from?: string }>;
}

/**
 * עמוד אטרקציה - *** אחיד לכל האטרקציות (בקשה מפורשת - "צריך להיות עמוד אחיד לכולם!!!").
 * שני מקורות הנתונים (tripadd_submissions, places) עוברים דרך אותו ממיר (loadAttraction.ts) לאותו
 * מבנה, ומוצגים באותו רכיב בדיוק (AttractionView) - כך שלא יכול להיווצר יותר הבדל ביניהם.
 * ההבדל היחיד: מערכת הדירוגים של כל מקור (place_reviews / tripadd_reviews).
 */
export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const activeNavTab = from === "ai" ? "ai" : "home";

  const [tripAddPlace, place] = await Promise.all([getTripAddPlaceById(id), getPlaceById(id)]);

  if (tripAddPlace) {
    return (
      <AttractionView
        data={attractionFromTripAdd(tripAddPlace)}
        reviews={<TripAddRatingSection place={tripAddPlace} />}
        activeNavTab={activeNavTab}
      />
    );
  }

  if (!place) {
    return (
      <Screen withBottomNavSpacing={false}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-bold text-ink">המקום לא נמצא</p>
          <Link href="/home" className="text-sm font-semibold text-ink underline">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  return <AttractionView data={await attractionFromPlace(place)} reviews={<TripLaceRatingSection placeId={place.id} />} activeNavTab={activeNavTab} />;
}
