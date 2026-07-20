import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CategoryPlanItem,
  FinalItinerary,
  SessionStatus,
  TripBuilderSession,
  TripBuilderStop,
  TripType,
} from "./types";

export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  tripType: TripType,
  answers: Record<string, unknown>,
  origin: { lat: number; lng: number }
): Promise<TripBuilderSession> {
  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .insert({
      user_id: userId,
      trip_type: tripType,
      answers,
      origin_latitude: origin.lat,
      origin_longitude: origin.lng,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "יצירת ה-session נכשלה");
  }
  return data as TripBuilderSession;
}

export async function getSessionWithStops(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ session: TripBuilderSession; stops: TripBuilderStop[] } | null> {
  const { data: session } = await supabase
    .from("trip_builder_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return null;

  const { data: stops } = await supabase
    .from("trip_builder_stops")
    .select("*")
    .eq("session_id", sessionId)
    .order("slot_index", { ascending: true });

  return { session: session as TripBuilderSession, stops: (stops ?? []) as TripBuilderStop[] };
}

/** שומר את תוכנית הקטגוריות שקבע ה-AI, ויוצר שורת stop לכל פריט בתוכנית. */
export async function saveCategoryPlan(
  supabase: SupabaseClient,
  sessionId: string,
  plan: CategoryPlanItem[]
): Promise<TripBuilderStop[]> {
  await supabase
    .from("trip_builder_sessions")
    .update({ category_plan: plan, status: "building" })
    .eq("id", sessionId);

  const rows = plan.map((item) => ({
    session_id: sessionId,
    category: item.category,
    role: item.role,
    slot_index: item.order,
  }));

  const { data, error } = await supabase.from("trip_builder_stops").insert(rows).select("*");

  if (error || !data) {
    throw new Error(error?.message ?? "יצירת תחנות הטיול נכשלה");
  }
  return (data as TripBuilderStop[]).sort((a, b) => a.slot_index - b.slot_index);
}

export async function updateSessionStatus(
  supabase: SupabaseClient,
  sessionId: string,
  status: SessionStatus
): Promise<void> {
  await supabase.from("trip_builder_sessions").update({ status }).eq("id", sessionId);
}

export async function saveFinalItinerary(
  supabase: SupabaseClient,
  sessionId: string,
  itinerary: FinalItinerary
): Promise<void> {
  await supabase
    .from("trip_builder_sessions")
    .update({ final_itinerary: itinerary, status: "completed" })
    .eq("id", sessionId);
}

/** מוסיפה תחנה בודדת נוספת ל-session קיים, בזמן ריצה (זרימת החלקות דינמית). */
export async function addDynamicStop(
  supabase: SupabaseClient,
  sessionId: string,
  category: string,
  role: TripBuilderStop["role"]
): Promise<TripBuilderStop> {
  const { data: existingStops } = await supabase
    .from("trip_builder_stops")
    .select("slot_index")
    .eq("session_id", sessionId)
    .order("slot_index", { ascending: false })
    .limit(1);

  const nextSlotIndex = (existingStops?.[0]?.slot_index ?? -1) + 1;

  const { data, error } = await supabase
    .from("trip_builder_stops")
    .insert({
      session_id: sessionId,
      category,
      role,
      slot_index: nextSlotIndex,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "הוספת תחנה דינמית נכשלה");
  }
  return data as TripBuilderStop;
}
