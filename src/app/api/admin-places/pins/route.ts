import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * *** תוספת (בקשה מפורשת - "המקומות שלנו ב-Admin Places, על המפה,
 * בלי תמונה, ושלא יעלה שקל ב-Google Cloud"): קריאה בלבד מהטבלה
 * הישנה `places` (שכבר מכילה latitude/longitude ששמורים אצלנו
 * מפעם ה"איסוף" המקורית שלהם) - **אין כאן שום קריאה ל-Google API**,
 * לא collectSinglePlaceByName ולא שום דבר דומה. admin client כי זה
 * תוכן אדמין מאושר שמיועד להצגה ציבורית על המפה (כמו tripadd pins),
 * לא מוגבל ל-RLS של המשתמש הצופה.
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("places")
    .select("id, name, category, latitude, longitude")
    .eq("is_legacy", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pins = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
  }));

  return NextResponse.json({ pins });
}
