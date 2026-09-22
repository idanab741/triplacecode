import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { searchCityPlace } from "@/services/places/googlePlacesService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** ממיר enum מחרוזת של Google ("PRICE_LEVEL_MODERATE" וכו') למספר 1-4
 *  שתואם לעמודת price_level הקיימת (מספר "$" שמוצג באפליקציה). */
function priceLevelFromGoogle(raw: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return raw ? (map[raw] ?? null) : null;
}

/**
 * "השלם עם Google" - ר' דרישה מפורשת: כפתור שממלא רק שדות שחסרים
 * בפועל (טלפון/אתר/שעות/נגישות/מחיר/תיאור), **לעולם לא דורס** מידע
 * שכבר קיים (גם אם המידע מ-Google שונה) - כי מי שערך ידנית כנראה ידע
 * משהו שגוגל לא יודע. משתמש בשירות ה-Google Places הקיים
 * (googlePlacesService.ts, אותו GOOGLE_MAPS_API_KEY) - לא אינטגרציה
 * חדשה.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: place, error } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  if (error || !place) return NextResponse.json({ error: "המקום לא נמצא" }, { status: 404 });

  let googlePlace;
  try {
    googlePlace = await searchCityPlace(`${place.name} ${place.city ?? place.address ?? ""}`);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בפנייה ל-Google Places" }, { status: 500 });
  }

  if (!googlePlace) {
    return NextResponse.json({ error: "לא נמצאה התאמה ב-Google Places עבור המקום הזה" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  const filledFields: string[] = [];

  if (!place.phone && googlePlace.nationalPhoneNumber) {
    patch.phone = googlePlace.nationalPhoneNumber;
    filledFields.push("טלפון");
  }
  if (!place.website && googlePlace.websiteUri) {
    patch.website = googlePlace.websiteUri;
    filledFields.push("אתר");
  }
  if ((!place.opening_hours || place.opening_hours.length === 0) && googlePlace.regularOpeningHours?.weekdayDescriptions?.length) {
    patch.opening_hours = googlePlace.regularOpeningHours.weekdayDescriptions;
    filledFields.push("שעות פעילות");
  }
  if (place.accessible === null && googlePlace.accessibilityOptions?.wheelchairAccessibleEntrance !== undefined) {
    patch.accessible = googlePlace.accessibilityOptions.wheelchairAccessibleEntrance;
    filledFields.push("נגישות");
  }
  if (!place.price_level) {
    const level = priceLevelFromGoogle(googlePlace.priceLevel);
    if (level !== null) {
      patch.price_level = level;
      filledFields.push("רמת מחיר");
    }
  }
  if (!place.short_description && googlePlace.editorialSummary?.text) {
    patch.short_description = googlePlace.editorialSummary.text;
    filledFields.push("תיאור קצר");
  }
  if (!place.google_maps_url && googlePlace.googleMapsUri) {
    patch.google_maps_url = googlePlace.googleMapsUri;
  }

  if (filledFields.length === 0) {
    return NextResponse.json({ place, filledFields: [], message: "לא נמצאו שדות חדשים למלא - Google לא סיפק מידע נוסף על מה שכבר יש." });
  }

  const { data: updated, error: updateError } = await supabase
    .from("places")
    .update({ ...patch, is_manually_edited: true })
    .eq("id", id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ place: updated, filledFields });
}
