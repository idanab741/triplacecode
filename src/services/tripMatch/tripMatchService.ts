import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { haversineDistanceKm, estimateTravelMinutes } from "@/services/tripBuilder/geo";
import type { CandidatePlace, LatLng } from "@/services/tripBuilder/types";

export interface TripMatchSession {
  id: string;
  user_id: string;
  city: string;
  interests: string[];
  liked_place_ids: string[];
  rejected_place_ids: string[];
}

export async function createTripMatchSession(
  supabase: SupabaseClient,
  userId: string,
  city: string,
  interests: string[]
): Promise<TripMatchSession> {
  const { data, error } = await supabase
    .from("tripmatch_sessions")
    .insert({ user_id: userId, city, interests })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "יצירת ה-session נכשלה");
  return data as TripMatchSession;
}

export async function getTripMatchSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<TripMatchSession | null> {
  const { data } = await supabase.from("tripmatch_sessions").select("*").eq("id", sessionId).maybeSingle();
  return data as TripMatchSession | null;
}

/** שולף מועמדים (אטרקציות) בעיר שנבחרה, בהתאם לקטגוריות המבוקשות - בלי קשר למרחק מהבית. */
export async function fetchTripMatchCandidates(
  supabase: SupabaseClient,
  session: TripMatchSession,
  limit = 20
): Promise<CandidatePlace[]> {
let query = supabase
    .from("places")
    .select(
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience"
    )
    .ilike("city", `%${session.city}%`);

  if (session.interests.length > 0) {
    query = query.overlaps("trip_type_tags", session.interests);
  }

  const excluded = [...session.liked_place_ids, ...session.rejected_place_ids];
  if (excluded.length > 0) {
    query = query.not("id", "in", `(${excluded.join(",")})`);
  }

  const { data, error } = await query.limit(limit);
  if (error || !data) return [];

  const cityCenter: LatLng = { lat: 0, lng: 0 }; // אין "בית" רלוונטי כאן - המרחק לא בשימוש בפועל

  return data
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      shortDescription: row.short_description,
      imageUrls: row.image_urls ?? [],
      rating: row.rating,
      ratingCount: row.rating_count,
      priceLevel: row.price_level,
      estimatedVisitMinutes: row.estimated_visit_minutes,
      latitude: row.latitude!,
      longitude: row.longitude!,
      distanceKm: 0,
      etaMinutes: 0,
      tripTypeTags: row.trip_type_tags ?? [],
      cuisineTags: row.cuisine_tags ?? [],
      kosher: row.kosher,
      accessible: row.accessible,
      suitableChildAges: row.suitable_child_ages ?? [],
      budgetTier: row.budget_tier,
      isAreaExperience: row.is_area_experience ?? false,
    }) satisfies CandidatePlace);
}

export async function recordTripMatchDecision(
  supabase: SupabaseClient,
  sessionId: string,
  placeId: string,
  liked: boolean
): Promise<void> {
  const session = await getTripMatchSession(supabase, sessionId);
  if (!session) return;

  const field = liked ? "liked_place_ids" : "rejected_place_ids";
  const current = liked ? session.liked_place_ids : session.rejected_place_ids;
  if (current.includes(placeId)) return;

  await supabase
    .from("tripmatch_sessions")
    .update({ [field]: [...current, placeId] })
    .eq("id", sessionId);
}