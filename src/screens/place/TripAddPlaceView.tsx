import { AttractionView } from "./attraction/AttractionView";
import { attractionFromTripAdd } from "./attraction/loadAttraction";
import { TripAddRatingSection } from "./TripAddRatingSection";
import type { TripAddPlace } from "@/services/tripadd/tripAddPlaceService";

/**
 * *** הוחלף (בקשה מפורשת - "עמוד אחיד לכל האטרקציות"): היה עמוד נפרד למקומות TripAdd, עם סדר ועיצוב
 * משלו. עכשיו זו רק עטיפה לעמוד האחיד (AttractionView) - נשארה כדי שקוד ישן שמייבא אותה ימשיך לעבוד.
 */
export function TripAddPlaceView({ place }: { place: TripAddPlace; savedCount?: number }) {
  return <AttractionView data={attractionFromTripAdd(place)} reviews={<TripAddRatingSection place={place} />} />;
}
