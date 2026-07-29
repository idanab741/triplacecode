import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlaceStatusAndPhoto } from "./placePhotoService";

export interface SavedTripSummary {
  sessionId: string;
  tripType: string;
  /** שם היעד לתצוגה - "פריז", "אזור מרכז" וכו', תלוי בסוג הטיול */
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

/** ממיר trip_type לנתיב התוצאה המתאים - כל סוג טיול עם עמוד תוצאות משלו. */
export function tripResultPath(tripType: string, sessionId: string): string {
  const routeSegment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${sessionId}`;
}

/**
 * מחזיר את כל הטיולים ה"שמורים" (is_saved=true) של המשתמש, עם תמונת יעד
 * כללית (לא תמונת מקום ספציפי) לכל אחד - לתצוגה בטאב "טיולים שמורים".
 */
export async function getSavedTrips(supabase: SupabaseClient, userId: string): Promise<SavedTripSummary[]> {
  const { data: sessions } = await supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,created_at")
    .eq("user_id", userId)
    .eq("is_saved", true)
    .order("created_at", { ascending: false });

  if (!sessions || sessions.length === 0) return [];

  const summaries = await Promise.all(
    sessions.map(async (session) => {
      const answers = session.answers as { destination?: string; requestedArea?: string } | null;
      const destinationLabel = answers?.destination ?? answers?.requestedArea ?? "הטיול שלי";

      const photoResult = await findPlaceStatusAndPhoto(destinationLabel);
      const imageUrl = photoResult.photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoResult.photoRef)}` : null;

      const stopCount = (session.final_itinerary as { stops?: unknown[] } | null)?.stops?.length ?? 0;

      return {
        sessionId: session.id as string,
        tripType: session.trip_type as string,
        destinationLabel,
        imageUrl,
        stopCount,
        createdAt: session.created_at as string,
      } satisfies SavedTripSummary;
    })
  );

  return summaries;
}
