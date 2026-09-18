import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { resolveCityFromCoordinates } from "@/services/tripBuilder/placePhotoService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * מקומות שנוצרו **לפני** התיקון ל-smart-search נשארו עם city=null גם אם
 * יש להם lat/lng תקינים (שכן הם כן נשמרו תמיד, ללא קשר לעיר) - ה-reverse
 * geocoding שמתווסף עכשיו רץ רק על מקומות *חדשים*. זה endpoint חד-פעמי
 * (באצוות, עם cursor) שמריץ את אותה השלמת עיר על כל הרשומות הישנות
 * שחסרות עיר אבל יש להן קואורדינטות.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const afterId: string | null = body?.afterId ?? null;

  const BATCH_SIZE = 20;
  const supabase = createAdminClient();

  let query = supabase
    .from("places")
    .select("id, latitude, longitude", { count: "exact" })
    .is("city", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("id", { ascending: true });

  if (afterId) {
    query = query.gt("id", afterId);
  }

  const { data: places, error, count } = await query.limit(BATCH_SIZE);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filled = 0;
  let notFound = 0;

  for (const place of places ?? []) {
    if (place.latitude == null || place.longitude == null) continue;
    const city = await resolveCityFromCoordinates(place.latitude, place.longitude);
    if (city) {
      await supabase.from("places").update({ city }).eq("id", place.id);
      filled++;
    } else {
      notFound++;
    }
  }

  const lastId = places && places.length > 0 ? places[places.length - 1].id : afterId;

  return NextResponse.json({
    processedNow: (places ?? []).length,
    filled,
    notFound,
    remaining: Math.max(0, (count ?? 0) - (places ?? []).length),
    lastId,
  });
}
