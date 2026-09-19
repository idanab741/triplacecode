import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * *** חדש (בקשה מפורשת - "כל מה שחם: תמצא אטרקציות אהובות"): האטרקציות
 * ה"חמות" בעמוד הבית = אלה שהכי הרבה משתמשים אהבו/שמרו ב-30 הימים
 * האחרונים (favorites עם status liked/saved - גם מ-TripMatch וגם מ-TripAdd).
 * כשאין מספיק פעילות (אפליקציה חדשה/יעד שקט) משלימים ממקומות עם
 * הדירוג והכמות-דירוגים הגבוהים ביותר, כדי שהקטע לא יישאר ריק.
 *
 * favorites מוגבל ל-RLS של המשתמש, ולכן הספירה הקהילתית רצה עם admin
 * client - מחזירים ללקוח רק סכומים ופרטי מקום ציבוריים, לעולם לא מי אהב.
 */

const RESULT_LIMIT = 12;
const WINDOW_DAYS = 30;

interface HotItem {
  id: string;
  name: string;
  imageUrl: string;
  city: string | null;
  rating: number | null;
  ratingCount: number | null;
  likes: number;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1) ספירת אהבו/שמרו לפי מקום.
  const { data: favoriteRows } = await admin
    .from("favorites")
    .select("place_id, place_type")
    .in("status", ["liked", "saved"])
    .in("place_type", ["place", "tripadd"])
    .gte("created_at", since)
    .limit(5000);

  const counts = new Map<string, { id: string; type: "place" | "tripadd"; likes: number }>();
  for (const row of favoriteRows ?? []) {
    const type = row.place_type as "place" | "tripadd";
    const key = `${type}:${row.place_id}`;
    const entry = counts.get(key);
    if (entry) entry.likes += 1;
    else counts.set(key, { id: row.place_id as string, type, likes: 1 });
  }
  const ranked = [...counts.values()].sort((a, b) => b.likes - a.likes).slice(0, 60);
  const placeIds = ranked.filter((r) => r.type === "place").map((r) => r.id);
  const tripAddIds = ranked.filter((r) => r.type === "tripadd").map((r) => r.id);
  const likesById = new Map(ranked.map((r) => [r.id, r.likes]));

  // 2) פרטי המקומות - רק אטרקציות, ורק עם תמונה.
  const [placesRes, tripAddRes, fallbackRes] = await Promise.all([
    placeIds.length > 0
      ? admin
          .from("places")
          .select("id, name, image_urls, rating, rating_count, city")
          .in("id", placeIds)
          .eq("category", "attractions")
          .eq("is_legacy", false)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    tripAddIds.length > 0
      ? admin
          .from("tripadd_submissions")
          .select("id, name, city, google_rating, google_rating_count, tripadd_submission_media(sort_order, media_assets(url))")
          .in("id", tripAddIds)
          .eq("category", "attraction")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    // מקורות ההשלמה: הכי מדורגים, למקרה שאין מספיק אהבות.
    admin
      .from("places")
      .select("id, name, image_urls, rating, rating_count, city")
      .eq("category", "attractions")
      .eq("is_legacy", false)
      .gte("rating", 4.3)
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(40),
  ]);

  function firstImage(urls: unknown): string | null {
    return Array.isArray(urls) && typeof urls[0] === "string" && urls[0] ? (urls[0] as string) : null;
  }

  const items = new Map<string, HotItem>();

  for (const row of (placesRes.data ?? []) as Record<string, unknown>[]) {
    const imageUrl = firstImage(row.image_urls);
    if (!imageUrl) continue;
    items.set(row.id as string, {
      id: row.id as string,
      name: row.name as string,
      imageUrl,
      city: (row.city as string | null) ?? null,
      rating: (row.rating as number | null) ?? null,
      ratingCount: (row.rating_count as number | null) ?? null,
      likes: likesById.get(row.id as string) ?? 0,
    });
  }

  for (const row of (tripAddRes.data ?? []) as Record<string, unknown>[]) {
    const media = (row.tripadd_submission_media as { sort_order: number; media_assets: { url: string } | null }[] | null)
      ?.filter((m) => m.media_assets?.url)
      .sort((a, b) => a.sort_order - b.sort_order);
    const imageUrl = media?.[0]?.media_assets?.url;
    if (!imageUrl) continue;
    items.set(row.id as string, {
      id: row.id as string,
      name: row.name as string,
      imageUrl,
      city: (row.city as string | null) ?? null,
      rating: (row.google_rating as number | null) ?? null,
      ratingCount: (row.google_rating_count as number | null) ?? null,
      likes: likesById.get(row.id as string) ?? 0,
    });
  }

  // מיון: הכי הרבה אהבות קודם, ובשוויון - הדירוג הגבוה יותר.
  const hot = [...items.values()].sort((a, b) => b.likes - a.likes || (b.rating ?? 0) - (a.rating ?? 0));

  // 3) השלמה עד RESULT_LIMIT ממקומות עם הדירוג הכי גבוה.
  if (hot.length < RESULT_LIMIT) {
    for (const row of (fallbackRes.data ?? []) as Record<string, unknown>[]) {
      if (hot.length >= RESULT_LIMIT) break;
      const id = row.id as string;
      if (items.has(id)) continue;
      const imageUrl = firstImage(row.image_urls);
      if (!imageUrl) continue;
      hot.push({
        id,
        name: row.name as string,
        imageUrl,
        city: (row.city as string | null) ?? null,
        rating: (row.rating as number | null) ?? null,
        ratingCount: (row.rating_count as number | null) ?? null,
        likes: 0,
      });
    }
  }

  return NextResponse.json(
    { items: hot.slice(0, RESULT_LIMIT) },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
