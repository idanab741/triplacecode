import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import type { CandidatePlace } from "@/services/tripBuilder/types";

/** יוצר/מעדכן שורת trip_builder_sessions (trip_type: "tripmatch") מתוך
 *  המקומות שאהבתם ב-TripMatch - נקרא אוטומטית ברגע שמגיעים למסך התוצאות
 *  (is_saved=false כברירת מחדל, כדי שהטיול יופיע תחת "כל הטיולים" ויחולו
 *  עליו אותם כללים כמו כל טיול אחר - כולל היעלמות מהרשימה אחרי שבוע אם
 *  לא נשמר, לפי getSavedTrips הקיים). "שמירת הטיול" בפועל (הפיכה
 *  ל-is_saved=true) קורית בנפרד דרך /api/trip-builder/sessions/[id]/save
 *  (אותו endpoint ששאר סוגי הטיולים כבר משתמשים בו - SaveTripIconButton).
 *  אם body כולל sessionId קיים - מעדכנים את אותה שורה (המקומות מצטברים/
 *  משתנים תוך כדי סריקה, ולא רוצים ליצור שורה חדשה בכל שינוי). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const city: string | undefined = body?.city;
  // *** ערך העיר הגולמי (למשל "דובאי", בלי המדינה) - זה מה שבאמת שמור
  // ב-places.city ומשמש לחיפוש. שונה מ-city (התווית לתצוגה, "דובאי,
  // איחוד האמירויות") - בלי ההפרדה הזו, חיפוש עתידי (resume) עם התווית
  // המלאה כ"עיר" לא מוצא כלום, כי אף עמודה ב-DB לא שווה למחרוזת המשולבת.
  const cityValue: string | undefined = typeof body?.cityValue === "string" && body.cityValue.trim() ? body.cityValue : city;
  const places: CandidatePlace[] | undefined = Array.isArray(body?.places) ? body.places : undefined;
  const existingSessionId: string | undefined = body?.sessionId;
  // *** קטגוריות (מתוך nightlife/restaurants/attractions) שכבר נסרקו
  // ליעד הזה - נשמר על answers.completedCategories, כדי שגם עמוד הצפייה
  // בטיול שמור (לא רק מסך התוצאות החי) ידע אם יש "המשך לקטגוריה הבאה".
  const completedCategories: string[] = Array.isArray(body?.completedCategories) ? body.completedCategories : [];

  if (!city || !city.trim()) {
    return NextResponse.json({ error: "יש לספק יעד" }, { status: 400 });
  }
  if (!places || places.length === 0) {
    return NextResponse.json({ error: "אין מקומות לשמור" }, { status: 400 });
  }

  const stops = places.map((place, index) => ({
    stopId: place.id,
    placeId: place.id,
    name: place.name,
    category: place.category,
    imageUrls: place.imageUrls ?? [],
    etaMinutes: place.etaMinutes ?? 0,
    arrivalOffsetMinutes: index * 60,
    estimatedVisitMinutes: place.estimatedVisitMinutes ?? null,
    priceLevel: place.priceLevel ?? null,
    rating: place.rating ?? null,
    reason: place.reason ?? null,
    shortDescription: place.shortDescription ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    openingHours: null,
    dayIndex: null,
  }));

  const finalItinerary = {
    stops,
    events: [],
    totalEtaMinutes: 0,
    warnings: [],
  };

  const answers = { destination: city.trim(), cityValue: cityValue?.trim() ?? city.trim(), completedCategories };

  if (existingSessionId) {
    const { data, error } = await supabase
      .from("trip_builder_sessions")
      .update({ final_itinerary: finalItinerary, answers })
      .eq("id", existingSessionId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data) return NextResponse.json({ sessionId: data.id });
    // השורה לא נמצאה (למשל נמחקה) - ניפול ליצירת שורה חדשה במקום לכשול.
  }

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .insert({
      user_id: user.id,
      trip_type: "tripmatch",
      answers,
      origin_latitude: places[0].latitude,
      origin_longitude: places[0].longitude,
      category_plan: [],
      final_itinerary: finalItinerary,
      status: "completed",
      is_saved: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "שמירת הטיול נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: data.id });
}
