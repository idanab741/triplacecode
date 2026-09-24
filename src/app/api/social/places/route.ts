import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createPlaceFromUser, isUserPlaceCategory } from "@/services/places/placeEnrichmentService";

/** "הוסיפו מקום" (זרימת "מקום" ב-place's): יוצר Place אמיתי ב-places מיד, כדי שאפשר יהיה
 *  להמשיך ישר לכתיבת ביקורת. אם אותו google_place_id כבר קיים - מחזיר אותו (existed: true). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || !isUserPlaceCategory(body?.category)) {
    return NextResponse.json({ error: "חסר שם או קטגוריה לא תקינה" }, { status: 422 });
  }

  try {
    const place = await createPlaceFromUser({
      name,
      createdBy: user.id,
      category: body.category,
      googlePlaceId: typeof body.googlePlaceId === "string" ? body.googlePlaceId : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
      latitude: typeof body.latitude === "number" ? body.latitude : undefined,
      longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      website: typeof body.website === "string" && body.website.trim() ? body.website.trim() : undefined,
    });
    return NextResponse.json(place, { status: place.existed ? 200 : 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
