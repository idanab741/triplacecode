import { createClient } from "@/services/supabase/client";

export interface FeaturedDestination {
  id: string;
  name: string;
  country: string;
  image_url: string | null;
}

export async function getFeaturedDestinations(limit = 20): Promise<FeaturedDestination[]> {
  const supabase = createClient();
  // רק יעדים "חמים/מותאמים" אמיתיים - לא כל הערים שנוספו לרשימת
  // בחירת המיקום/TripMatch (is_hot_destination=false). שני אוספים שונים
  // לגמרי, גם אם הם חיים באותה טבלה.
  const { data } = await supabase
    .from("destinations")
    .select("*")
    .eq("is_hot_destination", true)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}

/**
 * תיקון ארכיטקטוני (Audit מול "חופשה בארץ" - "🔥 היעדים החמים"): אותה
 * טבלה בדיוק (`destinations`, `is_hot_destination=true`) - לא נוצר
 * מקור נתונים/Schema מקביל - רק מסונן ל-country="ישראל" (כבר ברירת
 * המחדל הקיימת באפליקציה, ר' collectionService.ts/profile-setup),
 * כי "חופשה בארץ" עוסקת ביעדים בארץ בלבד (אילת/ים המלח/כנרת/גליל
 * וכו'), לא ביעדים בינלאומיים שגם הם חיים באותה טבלה.
 */
export async function getIsraelHotDestinations(limit = 12): Promise<FeaturedDestination[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("destinations")
    .select("*")
    .eq("is_hot_destination", true)
    .eq("country", "ישראל")
    .order("created_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}
