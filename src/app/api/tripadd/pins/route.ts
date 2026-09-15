import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * *** תיקון (בקשה מפורשת - "ביקשתי רק מהתמונות שלי! לא מגוגל! מה
 * שהמשתמשים מעלים"): התמונה בפופאפ עכשיו מגיעה אך ורק מהתמונות
 * שהמשתמש עצמו העלה בטופס (tripadd_submission_media -> media_assets),
 * לא google_photo_url. אם המשתמש לא העלה תמונה - פשוט אין תמונה
 * בפופאפ (לא נופלים בחזרה לתמונת גוגל).
 *
 * *** בקשה מפורשת ("כל הדאטה הקודם יעלם! רק דאטה חדש דרך tripadd" +
 * "תעשה שיופיע ישר על המפה, בהמשך נעשה סינון דרך ADMIN"): המקור
 * היחיד למרקרים מעכשיו הוא tripadd_submissions - **לא** places/
 * destinations הישנים, ולא מסונן ע"י status (pending/approved) כרגע.
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tripadd_submissions")
    .select(
      "id, name, category, subcategory, rating, google_rating, google_rating_count, accessible, latitude, longitude, address, price_level, opening_hours, tripadd_submission_media(sort_order, media_assets(url))"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pins = (data ?? []).map((row) => {
    const media = (
      row.tripadd_submission_media as unknown as { sort_order: number; media_assets: { url: string } | null }[] | null
    )
      ?.filter((m) => m.media_assets?.url)
      .sort((a, b) => a.sort_order - b.sort_order);
    const photoUrl = media?.[0]?.media_assets?.url ?? null;

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      rating: row.rating,
      google_rating: row.google_rating,
      google_rating_count: row.google_rating_count,
      accessible: row.accessible,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      price_level: row.price_level,
      opening_hours: row.opening_hours,
      photo_url: photoUrl,
    };
  });

  return NextResponse.json({ pins });
}
