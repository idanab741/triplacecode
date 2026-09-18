import type { SupabaseClient } from "@supabase/supabase-js";
import { UNSAVED_CONTENT_RETENTION_DAYS } from "@/constants/contentRetention";

export interface SavedTripSummary {
  sessionId: string;
  tripType: string;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  // *** תוספת (בקשה מפורשת - "עמוד הבחירות שלי - שינויים"): עד עכשיו
  // השדה הזה לא הוחזר ללקוח בכלל - כל צרכן ידע רק "שמורים" מול "לא"
  // דרך *איזה endpoint/פרמטר* נקרא (savedOnly), לא דרך שדה בשורה
  // עצמה. כדי שהעמוד "הבחירות שלי" יוכל להציג לכל פריט (גם בלשונית
  // "כל הבחירות", שמכילה גם שמורים וגם זמניים יחד) האם הוא זמני
  // ולחשב כמה ימים נשארו לו (ר' getDaysRemainingBeforeRemoval) - צריך
  // את הערך הזה בכל שורה.
  isSaved: boolean;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

export function tripResultPath(tripType: string, sessionId: string): string {
  const routeSegment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${sessionId}`;
}

export async function getSavedTrips(
  supabase: SupabaseClient,
  userId: string,
  options?: { savedOnly?: boolean; limit?: number }
): Promise<SavedTripSummary[]> {
  const savedOnly = options?.savedOnly ?? true;

  let query = supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,created_at,is_saved")
    .eq("user_id", userId)
    .not("final_itinerary", "is", null)
    .order("created_at", { ascending: false });

  if (savedOnly) {
    query = query.eq("is_saved", true);
  } else {
    // *** תיקון (בקשה מפורשת - "לוודא שתקופת השמירה היא 14 יום"): היה
    // 7 ימים (שבוע) - לא תואם למנגנון השמירה הזמנית שהוצג למשתמש
    // (ר' UnsavedContentRetentionModal.tsx + contentRetention.ts).
    // עכשיו אותו קבוע משותף בדיוק כמו trippy_ai_results, כדי ששני סוגי
    // ה"בחירות" יתנהגו באותו אופן.
    const cutoffIso = new Date(Date.now() - UNSAVED_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`is_saved.eq.true,created_at.gte.${cutoffIso}`);
  }
  if (options?.limit) query = query.limit(options.limit);

  const { data: sessions } = await query;

  if (!sessions || sessions.length === 0) return [];

  // *** תיקון: לפני זה כל טיול בעמוד "הטיולים שלי" ביצע קריאה חדשה
  // ל-Google Places (findPlaceStatusAndPhoto) רק כדי לשלוף תמונת תצוגה
  // מקדימה - שימוש ב-Google בלי אישור מפורש, וגם מיותר: לתחנה הראשונה
  // של הטיול כבר יש תמונה שמורה (imageUrls) מהרגע שהיא נוספה למסלול.
  // עכשיו פשוט משתמשים בתמונה הקיימת הזו - בלי שום קריאת רשת נוספת
  // ל-Google. אם אין תמונה שמורה, פשוט אין תמונה (לא נופלים בחזרה
  // לחיפוש Google).
  const summaries = sessions.map((session) => {
    const answers = session.answers as { destination?: string; requestedArea?: string } | null;
    const itinerary = session.final_itinerary as { stops?: { name?: string; imageUrls?: string[] }[] } | null;
    const firstStop = itinerary?.stops?.[0];

    const destinationLabel = answers?.destination ?? answers?.requestedArea ?? firstStop?.name ?? "הטיול שלי";
    const imageUrl = firstStop?.imageUrls?.[0] ?? null;
    const stopCount = itinerary?.stops?.length ?? 0;

    return {
      sessionId: session.id as string,
      tripType: session.trip_type as string,
      destinationLabel,
      imageUrl,
      stopCount,
      createdAt: session.created_at as string,
      isSaved: session.is_saved === true,
    } satisfies SavedTripSummary;
  });

  return summaries;
}
