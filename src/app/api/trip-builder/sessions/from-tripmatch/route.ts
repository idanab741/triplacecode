import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import type { CandidatePlace } from "@/services/tripBuilder/types";

/** "שמירת הטיול" ממסך התוצאות של TripMatch - יוצר שורת trip_builder_sessions
 *  חדשה (trip_type: "tripmatch") עם final_itinerary בנוי מתוך המקומות
 *  שאהבתם, מסומנת is_saved=true מייד - כדי שהטיול יופיע בעמוד "הטיולים
 *  שלי", בלשונית "שמורים", עם שם היעד ככותרת (בדיוק כמו טיולים אחרים -
 *  ראו getSavedTrips: destinationLabel נגזר מ-answers.destination). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const city: string | undefined = body?.city;
  const places: CandidatePlace[] | undefined = Array.isArray(body?.places) ? body.places : undefined;

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

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .insert({
      user_id: user.id,
      trip_type: "tripmatch",
      answers: { destination: city.trim() },
      origin_latitude: places[0].latitude,
      origin_longitude: places[0].longitude,
      category_plan: [],
      final_itinerary: finalItinerary,
      status: "completed",
      is_saved: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "שמירת הטיול נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: data.id });
}
