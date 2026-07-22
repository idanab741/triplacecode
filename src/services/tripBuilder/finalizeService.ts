import type { SupabaseClient } from "@supabase/supabase-js";
import { getUpcomingEvents } from "@/services/events/ticketmasterService";
import { haversineDistanceKm, estimateTravelMinutes } from "./geo";
import { saveFinalItinerary } from "./sessionService";
import { reviewItinerary } from "./qualityCheckService";
import type { TripIntent } from "./tripIntentService";
import type { FinalItinerary, FinalItineraryEvent, FinalItineraryStop, LatLng, TripBuilderStop } from "./types";

interface LikedStopWithPlace extends TripBuilderStop {
  place: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    image_urls: string[];
    price_level: number | null;
    rating: number | null;
    estimated_visit_minutes: number | null;
    opening_hours: string[] | null;
    short_description: string | null;
  } | null;
}

const BUDGET_BAND_MAX_TOTAL: Record<string, number | null> = {
  "0-100": 100,
  "100-300": 300,
  "300-600": 600,
  "600-1000": 1000,
  unlimited: null,
};

/**
 * מבצע אופטימיזציה סופית: מיון גיאוגרפי (nearest-neighbor, Haversine בלבד),
 * חישוב זמני נסיעה מצטברים, ובדיקת תקציב/משך זמן. בלי קריאת Claude - זהו
 * חישוב דטרמיניסטי, לא שיפוט איכותי.
 */
export async function finalizeItinerary(
  supabase: SupabaseClient,
  sessionId: string,
  origin: LatLng,
  budgetBand: string,
  durationBand?: string,
  tripIntent?: TripIntent | null
): Promise<FinalItinerary> {
  const { data: session } = await supabase
    .from("trip_builder_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) throw new Error("ה-session לא נמצא");

const { data: stops } = await supabase
    .from("trip_builder_stops")
.select(
      "*, place:places(id,name,latitude,longitude,image_urls,price_level,rating,estimated_visit_minutes,opening_hours,short_description)"
    )
    .eq("session_id", sessionId)
    .eq("status", "liked");

  const likedStops = ((stops ?? []) as LikedStopWithPlace[]).filter(
    (stop) => stop.place && stop.place.latitude != null && stop.place.longitude != null
  );

  const ordered = orderByNearestNeighbor(likedStops, origin);

  let cursor = origin;
  let cumulativeMinutes = 0;
  let cumulativeCost = 0;
  const finalStops: FinalItineraryStop[] = [];

  for (const stop of ordered) {
    const placeLatLng: LatLng = { lat: stop.place!.latitude!, lng: stop.place!.longitude! };
    const distanceKm = haversineDistanceKm(cursor, placeLatLng);
    const etaMinutes = estimateTravelMinutes(distanceKm, "drive");
    cumulativeMinutes += etaMinutes;

finalStops.push({
      stopId: stop.id,
      placeId: stop.place!.id,
      name: stop.place!.name,
      category: stop.category,
      imageUrls: stop.place!.image_urls ?? [],
      etaMinutes,
      arrivalOffsetMinutes: cumulativeMinutes,
      estimatedVisitMinutes: stop.place!.estimated_visit_minutes,
      priceLevel: stop.place!.price_level,
      rating: stop.place!.rating,
      reason: stop.reason,
      shortDescription: stop.place!.short_description,
      latitude: placeLatLng.lat,
      longitude: placeLatLng.lng,
      openingHours: stop.place!.opening_hours,
    });

    cumulativeMinutes += stop.place!.estimated_visit_minutes ?? 60;
    cumulativeCost += estimateCostFromPriceLevel(stop.place!.price_level);
    cursor = placeLatLng;
  }

const warnings: string[] = [];
  const maxBudget = BUDGET_BAND_MAX_TOTAL[budgetBand];
  if (maxBudget != null && cumulativeCost > maxBudget) {
    warnings.push("העלות המשוערת של המסלול עשויה לחרוג מהתקציב שנבחר");
  }
  
// בקרת איכות אחרונה - רק למסלולים ארוכים יותר, שבהם הסיכון לחוסר איזון גבוה יותר.
  // זהו כלי ניטור פנימי בלבד - הבעיות נרשמות ביומן (Vercel logs) לצורך מעקב איכות,
  // ולא מוצגות למשתמש כאזהרה. משתמש שרואה "רשימת תלונות" על הטיול שלו זו חוויה גרועה.
  if ((durationBand === "half_day" || durationBand === "full_day") && finalStops.length > 0) {
    const issues = await reviewItinerary({ stops: finalStops, tripIntent });
    if (issues.length > 0) {
      console.warn("[Quality Check] נמצאו בעיות איכות במסלול", {
        sessionId,
        issues,
      });
    }
  }

const itinerary: FinalItinerary = {
    stops: finalStops,
    events: [],
    totalEtaMinutes: cumulativeMinutes,
    warnings,
  };

  await saveFinalItinerary(supabase, sessionId, itinerary);
  return itinerary;
}

function orderByNearestNeighbor(stops: LikedStopWithPlace[], origin: LatLng): LikedStopWithPlace[] {
  const remaining = [...stops];
  const ordered: LikedStopWithPlace[] = [];
  let cursor = origin;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    remaining.forEach((stop, index) => {
      const distance = haversineDistanceKm(cursor, {
        lat: stop.place!.latitude!,
        lng: stop.place!.longitude!,
      });
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    cursor = { lat: next.place!.latitude!, lng: next.place!.longitude! };
  }

  return ordered;
}

/**
 * אירועים ופסטיבלים אמיתיים בסביבה (Ticketmaster) - מוצגים כהמלצה משלימה
 * בסוף המסלול, לא כתחנה מוחלקת, כי הם תלויי-תאריך ולא מקום קבוע.
 */
async function fetchNearbyEvents(origin: LatLng): Promise<FinalItineraryEvent[]> {
  try {
    const events = await getUpcomingEvents(origin.lat, origin.lng);
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      venueName: event.venueName,
      imageUrl: event.imageUrl,
      url: event.url,
    }));
  } catch {
    return [];
  }
}

function estimateCostFromPriceLevel(priceLevel: number | null): number {
  if (priceLevel == null) return 80;
  return [40, 80, 150, 250, 400][Math.min(priceLevel, 4)] ?? 80;
}
