import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * *** בקשה מפורשת ("מלא נעצים על המסך?? אני מבקש שכל הדאטה הקודם
 * יעלם! רק דאטה חדש שנזין כאן עכשיו דרך tripadd" + "כרגע תעשה
 * שיופיע ישר על המפה... בהמשך נעשה סינון דרך ADMIN"): המקור היחיד
 * למרקרים על מפת הבית מעכשיו הוא tripadd_submissions - **לא**
 * places/destinations הישנים, ולא מסונן ע"י status (pending/approved)
 * כרגע - כל שורה עם קואורדינטות תוצג ישירות. שער ה-Admin (לפי סטטוס)
 * יתווסף כפרומפט נפרד, לא כרגע.
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tripadd_submissions")
    .select("id, name, category, subcategory, rating, latitude, longitude, address, google_photo_url, price_level")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pins: data ?? [] });
}
