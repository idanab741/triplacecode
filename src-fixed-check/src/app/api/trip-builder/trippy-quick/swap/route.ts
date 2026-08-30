import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import {
  type TrippyQuickStop,
  toStop,
  fetchAttractionPlaces,
  fetchRestaurantPlaces,
  fetchNightlifePlaces,
  fetchPlacesByNameKeyword,
} from "@/services/tripBuilder/trippyQuickShared";

/**
 * *** תכונה חדשה (בקשה מפורשת - "כפתור בצד שמאל למטה... trippy AI -
 * שמשנה את האטרקציה... האטרקציה מתחלפת לאותו דבר ואותו סוג מאותה
 * קטגוריה בלבד!"): לא קורא ל-Claude שוב - משתמש ב-searchTags שכבר
 * נשמרו *על התחנה עצמה* (ר' trippyQuickShared.ts - TrippyQuickStop.
 * searchTags) - לא ב-state נפרד בעמוד, כדי שלא יהיה תלוי בטיימינג/
 * race condition. עם excludeIds כדי לא להחזיר את אותו מקום/מקום
 * שכבר מוצג בתחנות אחרות. מהיר (בלי קריאת AI), וזול.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const category = body?.category as TrippyQuickStop["category"] | undefined;
  const searchTags: string[] = Array.isArray(body?.searchTags) ? body.searchTags.filter((t: unknown) => typeof t === "string") : [];
  const nameKeyword: string | null = typeof body?.nameKeyword === "string" && body.nameKeyword.trim() ? body.nameKeyword.trim() : null;
  const city = typeof body?.city === "string" ? body.city : null;
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;
  const excludeIds: string[] = Array.isArray(body?.excludeIds) ? body.excludeIds.filter((id: unknown) => typeof id === "string") : [];

  if (category !== "attraction" && category !== "restaurant" && category !== "nightlife") {
    return NextResponse.json({ error: "category לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();
  const location = { lat, lng, city };
  const hasExplicitCity = city != null;

  const places =
    category === "attraction"
      ? await fetchAttractionPlaces({ supabase, location, hasExplicitCity, limit: 1, excludeIds, attractionCategoryIds: searchTags })
      : category === "restaurant"
        ? nameKeyword
          ? await fetchPlacesByNameKeyword({ supabase, location, limit: 1, excludeIds, keyword: nameKeyword })
          : await fetchRestaurantPlaces({ supabase, location, hasExplicitCity, limit: 1, excludeIds, cuisineIds: searchTags })
        : await fetchNightlifePlaces({ supabase, location, hasExplicitCity, limit: 1, excludeIds, nightlifeTagIds: searchTags });

  const stop = places.length > 0 ? toStop(places[0], category, searchTags, nameKeyword) : null;
  return NextResponse.json({ stop });
}
