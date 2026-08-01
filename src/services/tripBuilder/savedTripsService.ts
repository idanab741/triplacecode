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
 * מחזיר את טיולי המשתמש - כברירת מחדל רק "שמורים" (is_saved=true), או את
 * **כל** הטיולים שנבנו בפועל (יש להם final_itinerary) אם savedOnly=false.
 * limit אופציונלי - לתצוגת "תצוגה מקדימה" קצרה (למשל בעמוד הבית).
 */
export async function getSavedTrips(
  supabase: SupabaseClient,
  userId: string,
  options?: { savedOnly?: boolean; limit?: number }
): Promise<SavedTripSummary[]> {
  const savedOnly = options?.savedOnly ?? true;

  let query = supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,created_at")
    .eq("user_id", userId)
    .not("final_itinerary", "is", null)
    .order("created_at", { ascending: false });

  if (savedOnly) query = query.eq("is_saved", true);
  if (options?.limit) query = query.limit(options.limit);

  const { data: sessions } = await query;

  if (!sessions || sessions.length === 0) return [];

  const summaries = await Promise.all(
    sessions.map(async (session) => {
      const answers = session.answers as { destination?: string; requestedArea?: string } | null;
      const itinerary = session.final_itinerary as { stops?: { name?: string }[] } | null;
      const firstStopName = itinerary?.stops?.[0]?.name;

      // תווית לתצוגה - אם אין יעד/אזור מפורש (יום כיף וכו') נשתמש בברירת
      // מחדל קבועה. **חשוב**: לחיפוש התמונה לא משתמשים בברירת המחדל הזו
      // בשום מקרה - חיפוש "הטיול שלי" בגוגל מחזיר תוצאה אקראית לא קשורה
      // (זו הייתה בדיוק הסיבה לתמונות השגויות/לא רלוונטיות).
      const destinationLabel = answers?.destination ?? answers?.requestedArea ?? "הטיול שלי";
      const photoQuery = answers?.destination ?? answers?.requestedArea ?? firstStopName ?? null;

      const photoResult = photoQuery ? await findPlaceStatusAndPhoto(photoQuery) : null;
      const imageUrl = photoResult?.photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoResult.photoRef)}` : null;

      const stopCount = itinerary?.stops?.length ?? 0;

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
