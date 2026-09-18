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
/**
 * *** תיקון (בקשה מפורשת - "למה זה לא לפי הסוגים החדשים?! זה אמור
 * להיות מסונכרן"): places.category הישן (5 ערכים: restaurants,
 * nightlife, attractions, nature, hotels - ר' constants/placeCategories.ts)
 * הוא מערכת שונה לגמרי מ-HomeQuickCategoryId החדש (attraction, food,
 * shopping, nature, nightlife, sleep) - הצבעים בפין היו נופלים
 * ל-ברירת-מחדל כי המחרוזות פשוט לא תאמו. מיפוי מפורש, לא ניחוש.
 * "shopping" בכוונה בלי ערך מקביל - אין קטגוריית קניות במערכת הישנה.
 */
const OLD_CATEGORY_TO_NEW: Record<string, string> = {
  restaurants: "food",
  nightlife: "nightlife",
  attractions: "attraction",
  nature: "nature",
  hotels: "sleep",
};

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
    category: OLD_CATEGORY_TO_NEW[row.category] ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
  }));

  return NextResponse.json({ pins });
}
