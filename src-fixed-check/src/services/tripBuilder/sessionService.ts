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
  // עבור חופשה בחו"ל (ובעתיד סופ"ש) - שדות מרובי-ימים נשמרים בעמודות ייעודיות,
  // בנוסף ל-answers הגולמי, כדי שהשרת יוכל לשלוף אותם בלי לפרסר JSON בכל שאילתה
  const multiDayFields: Record<string, unknown> = {};
  if (tripType === "abroad_vacation") {
    const a = answers as {
      flights?: unknown;
      hotels?: unknown;
      lodgingType?: string | null;
      startDate?: string;
      endDate?: string;
      pace?: string;
    };
    multiDayFields.flights = a.flights ?? [];
    multiDayFields.hotels = a.hotels ?? [];
    multiDayFields.lodging_type = a.lodgingType ?? null;
    multiDayFields.start_date = a.startDate || null;
    multiDayFields.end_date = a.endDate || null;
    multiDayFields.pace = a.pace ?? "balanced";
  }

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .insert({
      user_id: userId,
      trip_type: tripType,
      answers,
      origin_latitude: origin.lat,
      origin_longitude: origin.lng,
      ...multiDayFields,
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
    day_index: item.day ?? null,
    note: item.note ?? null,
    requirements: item.requirements ?? null,
  }));

  const { data, error } = await supabase.from("trip_builder_stops").insert(rows).select("*");

  if (error || !data) {
    throw new Error(error?.message ?? "יצירת תחנות הטיול נכשלה");
  }
  return (data as TripBuilderStop[]).sort((a, b) => a.slot_index - b.slot_index);
}

/**
 * בקשה מפורשת (Vacation Blueprint - ר' dayBlueprintService.ts) - מוסיפה
 * שורות trip_builder_stops ליום אחד שנבנה **דינמית תוך כדי auto-build**
 * (לא בשלב יצירת ה-session), בלי לדרוס את category_plan/status על
 * ה-session (בניגוד ל-saveCategoryPlan הרגיל) - כי זה כבר נעשה פעם אחת
 * ביצירת ה-session ליום 1/יום אחרון, ואין צורך לשכתב אותו לכל יום.
 */
export async function appendDayStops(
  supabase: SupabaseClient,
  sessionId: string,
  dayPlan: CategoryPlanItem[]
): Promise<TripBuilderStop[]> {
  const rows = dayPlan.map((item) => ({
    session_id: sessionId,
    category: item.category,
    role: item.role,
    slot_index: item.order,
    day_index: item.day ?? null,
    note: item.note ?? null,
    requirements: item.requirements ?? null,
  }));

  const { data, error } = await supabase.from("trip_builder_stops").insert(rows).select("*");

  if (error || !data) {
    throw new Error(error?.message ?? "יצירת תחנות היום נכשלה");
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

/** שומר את "מסמך הכוונה" (Trip Intent) שנוצר פעם אחת בתחילת התהליך. */
export async function saveTripIntent(
  supabase: SupabaseClient,
  sessionId: string,
  tripIntent: import("./tripIntentService").TripIntent
): Promise<void> {
  await supabase.from("trip_builder_sessions").update({ trip_intent: tripIntent }).eq("id", sessionId);
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

/**
 * שמירה חלקית (למשל: יום 1 בלבד מוכן, שאר הימים עדיין בבנייה באותה
 * קריאת auto-build) - בכוונה **לא** נוגעת ב-status: הוא נשאר "building"
 * עד לקריאה הסופית (saveFinalItinerary, בסוף הבנייה כולה). זה בדיוק מה
 * שמאפשר לעמוד התוצאה להבחין בין "יש כבר טיול חלקי להציג, עם סקלטון
 * לימים שעוד לא הגיעו" לבין "המסלול המלא סופי, אפשר להפסיק לתשאל".
 */
export async function savePartialItinerary(
  supabase: SupabaseClient,
  sessionId: string,
  itinerary: FinalItinerary
): Promise<void> {
  await supabase
    .from("trip_builder_sessions")
    .update({ final_itinerary: itinerary })
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
