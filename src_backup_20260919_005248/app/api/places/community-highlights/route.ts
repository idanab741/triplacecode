import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * "👥 ה-Match-ים של הקהילה" בעמוד הבית (Audit - "מאיפה הנתונים על
 * האנשים שלחצו והכמויות?" - בצדק: הגרסה הקודמת הציגה מספרים לדוגמה).
 * זהו endpoint חדש שמחזיר דירוג אמיתי של מקומות לפי כמות favorites
 * אמיתית (טבלת favorites הקיימת - status='liked'/'saved', בדיוק אותה
 * טבלה ש-toggleFavorite/favoritesService.ts כבר כותבים אליה בכל
 * האפליקציה) - לא נתונים מומצאים.
 *
 * הערה: אין עדיין "מספר אנשים שיצאו השבוע" אמיתי (אין טבלת check-in/
 * ביקור בפועל) - לכן מוצג כאן רק מספר השומרים/הלייקים (favoriteCount),
 * שזה כן נתון אמיתי, ולא מוצג "X יצאו השבוע" בכלל.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "6");

  const supabase = await createClient();

  const { data: favoriteRows, error: favError } = await supabase
    .from("favorites")
    .select("place_id")
    .in("status", ["liked", "saved"])
    .eq("place_type", "place");

  if (favError || !favoriteRows) {
    return NextResponse.json({ highlights: [] });
  }

  const countByPlaceId = new Map<string, number>();
  for (const row of favoriteRows) {
    const id = row.place_id as string;
    countByPlaceId.set(id, (countByPlaceId.get(id) ?? 0) + 1);
  }

  const topPlaceIds = Array.from(countByPlaceId.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topPlaceIds.length === 0) {
    return NextResponse.json({ highlights: [] });
  }

  const { data: places, error: placesError } = await supabase
    .from("places")
    .select("id,name,city,image_urls")
    .in("id", topPlaceIds);

  if (placesError || !places) {
    return NextResponse.json({ highlights: [] });
  }

  const highlights = topPlaceIds
    .map((id) => {
      const place = places.find((p) => p.id === id);
      if (!place) return null;
      const imageUrl = Array.isArray(place.image_urls) && place.image_urls.length > 0 ? place.image_urls[0] : null;
      return {
        id: place.id as string,
        name: place.name as string,
        city: (place.city as string | null) ?? null,
        imageUrl: imageUrl as string | null,
        favoriteCount: countByPlaceId.get(id) ?? 0,
      };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null);

  return NextResponse.json({ highlights });
}
