import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

const PROXIMITY_DEGREES = 0.0015; // ~150 מטר

interface MatchRow {
  id: string;
  name: string;
  imageUrl: string | null;
  /** place_reviews.place_id מצביע רק ל-places, לא ל-destinations - צריך
   *  לדעת מאיזו טבלה ההתאמה הגיעה כדי לדעת אם אפשר להציע "כתוב ביקורת". */
  type: "place" | "destination";
}

function normalizePlace(row: { id: string; name: string; image_urls?: string[] | null } | null): MatchRow | null {
  if (!row) return null;
  return { id: row.id, name: row.name, imageUrl: row.image_urls?.[0] ?? null, type: "place" };
}

function normalizeDestination(row: { id: string; name: string; image_url?: string | null } | null): MatchRow | null {
  if (!row) return null;
  return { id: row.id, name: row.name, imageUrl: row.image_url ?? null, type: "destination" };
}

/** בודק אם מקום כבר קיים ב-places או ב-destinations (סעיף 35), ומחזיר
 *  גם תמונה אמיתית שלו - כדי שכרטיס ההתראה יהיה איכותי ולא רק טקסט.
 *  שכבה 1: google_place_id מדויק. שכבה 2 (fallback): שם דומה + קרבה
 *  גיאוגרפית - תופס רשומות ישנות/ידניות שאין להן google_place_id. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  const name = searchParams.get("name");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!placeId) return NextResponse.json({ error: "יש לספק placeId" }, { status: 422 });

  const supabase = await createClient();

  const [placesById, destinationsById] = await Promise.all([
    supabase.from("places").select("id, name, image_urls").eq("google_place_id", placeId).maybeSingle(),
    supabase.from("destinations").select("id, name, image_url").eq("google_place_id", placeId).maybeSingle(),
  ]);
  const exactMatch = normalizePlace(placesById.data) ?? normalizeDestination(destinationsById.data);
  if (exactMatch) return NextResponse.json({ exists: true, place: exactMatch });

  if (name && lat && lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const namePattern = `%${name.trim()}%`;

    const [placesByName, destinationsByName] = await Promise.all([
      supabase
        .from("places")
        .select("id, name, image_urls")
        .ilike("name", namePattern)
        .gte("latitude", latNum - PROXIMITY_DEGREES)
        .lte("latitude", latNum + PROXIMITY_DEGREES)
        .gte("longitude", lngNum - PROXIMITY_DEGREES)
        .lte("longitude", lngNum + PROXIMITY_DEGREES)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("destinations")
        .select("id, name, image_url")
        .ilike("name", namePattern)
        .gte("latitude", latNum - PROXIMITY_DEGREES)
        .lte("latitude", latNum + PROXIMITY_DEGREES)
        .gte("longitude", lngNum - PROXIMITY_DEGREES)
        .lte("longitude", lngNum + PROXIMITY_DEGREES)
        .limit(1)
        .maybeSingle(),
    ]);
    const fallbackMatch = normalizePlace(placesByName.data) ?? normalizeDestination(destinationsByName.data);
    if (fallbackMatch) return NextResponse.json({ exists: true, place: fallbackMatch });
  }

  return NextResponse.json({ exists: false, place: null });
}
