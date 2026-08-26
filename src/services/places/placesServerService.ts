import { createClient } from "@/services/supabase/server";

export const RESTAURANT_CATEGORY_KEYWORDS = [
  "restaurant",
  "dining",
  "cafe",
  "café",
  "bistro",
  "taverna",
  "cuisine",
  "seafood",
  "tapas",
  "bakery",
  "pastry",
  "dessert",
  "brunch",
  "steakhouse",
  "brewery",
  "brewpub",
  "gelato",
  "coffee",
  "culinary",
  "osteria",
  "enoteca",
];
export const ATTRACTION_CATEGORY_KEYWORDS = [
  "attraction",
  "museum",
  "landmark",
  "monument",
  "historic",
  "viewpoint",
  "square",
  "temple",
  "castle",
  "palace",
  "archaeolog",
  "cultural",
  "architecture",
  "theater",
  "church",
  "aquarium",
  "amusement",
];
// תיקון Product מפורש ("יש חלוקה מוגדרת: מסעדות/אטרקציות/חיי לילה/
// טבע/מלונות") - "טבע" הוא סקשן חמישי נפרד, לא חלק מ"אטרקציות". הוצאתי
// nature/garden/park/beach/forest/hiking/canyon/desert/spring מרשימת
// האטרקציות והפכתי אותם לרשימה עצמאית משלהם.
export const NATURE_CATEGORY_KEYWORDS = [
  "nature",
  "garden",
  "park",
  "beach",
  "forest",
  "hiking",
  "canyon",
  "desert",
  "spring",
  "trail",
  "waterfall",
  "reserve",
];
export const NIGHTLIFE_CATEGORY_KEYWORDS = ["nightlife", "bar", "club", "pub"];

export interface PlaceSummary {
  id: string;
  name: string;
  rating: number | null;
  image_urls: string[];
}

export interface PlaceDetail {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  image_urls: string[];
  opening_hours: string[] | null;
  tags: string[];
  trip_type_tags: string[];
  cuisine_tags: string[];
  latitude: number;
  longitude: number;
}

/** לשימוש ב-Server Components בלבד. */
export async function getPlaceById(id: string): Promise<PlaceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  return data;
}

/**
 * תיקון Product מפורש ("זה תל אביב לדוגמה - אין מלונות! למרות שהכנו
 * אתמול! האם עדיין כל האטרקציות... לא מופיעות?"): אותה מחלקת באג כמו
 * category למטה, הפעם על city. יש שתי רשומות destinations נפרדות -
 * "תל אביב" ו"תל אביב-יפו" - וכל הנתונים האמיתיים (כולל 4 המלונות
 * מאתמול) שמורים תחת "תל אביב-יפו". .eq("city", city) עם
 * destination.name="תל אביב" (בלי "-יפו") לא שווה בדיוק לאף city
 * אמיתי - החזיר ריק. תיקון בשתי הפונקציות למטה: .ilike במקום .eq -
 * "תל אביב" בתור תבנית מוצא "תל אביב-יפו" כי הוא מוכל בתוכו. נבדק
 * בפועל מול ה-DB: תל אביב 0→372 מקומות תואמים, ירושלים 86, חיפה 77,
 * אילת 95, מצפה רמון 13.
 * *** ידוע ועדיין לא פתור: יעדי-אזור מורכבים ("טבריה והכנרת", "הצפון
 * והגולן", "הנגב והערבה") - כיוון ההכלה הפוך שם (city="טבריה" קצר
 * מ"טבריה והכנרת" הארוך) - ILIKE %destinationName% לא תופס את זה,
 * דורש טיפול נפרד (למשל פיצול למילים).
 */
/**
 * תיקון Product מפורש ("יש המון מסעדות באילת - למה זה לא מסונכרן פה?
 * זה חייב להתאים בוודאות!! לכל העמודים!!"): בדקתי ב-DB - עמודת
 * places.category היא בפועל טקסט חופשי-כמעט (בין השאר "restaurants",
 * "restaurants_culinary", "wineries_dining", "traditional_restaurant",
 * "seafood_restaurant"... ~250 ערכים שונים בסה"כ), לא Enum סגור - כך
 * ש-.eq("category", "restaurants_culinary") תפס מקום *אחד* מתוך 22+
 * מסעדות אמיתיות באילת. גם trip_type_tags (המנגנון החזק יותר שמשמש
 * במקומות אחרים באפליקציה - discoveryService.ts) לא פותר את זה כאן -
 * ב-21 מתוך 22 השורות הרלוונטיות באילת הוא ריק לגמרי (מקומות ישנים,
 * לפני שהוזן להם תיוג). הפתרון: התאמת מילות-מפתח מטושטשת (ILIKE) על
 * טקסט הקטגוריה עצמו, במקום שוויון מדויק - "%restaurant%"/"%dining%"/
 * "%cafe%" וכו' תופסים את רוב הווריאציות בפועל בלי תלות בתיוג עדין
 * שלא תמיד קיים. זה חל על **כל** יעד (לא רק אילת) כי הבעיה עצמה היא
 * מבנית בעמודת category, לא ספציפית לעיר אחת.
 */
/**
 * תיקון Product מפורש ("מקומות כמו היער השחור, חבל לואר, כרתים - צריך
 * אפשרות של יעד בנוסף לעיר/מדינה, למקומות הרלוונטים בלבד"): לא כל
 * מקום שייך לעיר בודדת - הוספתי עמודת places.region (ריקה כברירת
 * מחדל, לא משפיעה על אף מקום קיים) לאזורי-על שמשתרעים על כמה ערים/כפרים
 * (למשל "היער השחור" בגרמניה). ההתאמה עכשיו היא city.ilike **OR**
 * region.ilike - אם ליעד יש region תואם למקום, הוא ייתפס גם אם ה-city
 * שלו שונה לגמרי מהיעד.
 */
function cityOrRegionOrFilter(city: string): string {
  return `city.ilike.%${city}%,region.ilike.%${city}%`;
}

/**
 * תיקון Product מפורש ("פארק גואל מופיע פעם אחת ב-admin, למה כל כך
 * הרבה פעמים בעמוד?? ביקשתי לאחד כפילויות! אך ורק מהמאגר של ADMIN
 * PLACES, לא מהמאגר שעבר לארכיון!"): בדקתי - זו טעות שלי, לא כפילות
 * אמיתית שצריך לאחד. יש 7 שורות ל"פארק גואל" ב-places, אבל **רק אחת**
 * היא is_legacy=false (עם google_place_id אמיתי) - שאר ה-6 הן
 * is_legacy=true (בלי google_place_id, "ארכיון"/גרסאות ישנות שהוחלפו).
 * discoveryService.ts (המנגנון שמשמש "טיול יומי"/"חופשה בארץ") כבר
 * מסנן .eq("is_legacy", false) בדיוק בגלל זה - החסרתי את הסינון הזה
 * מ-placesServerService.ts כשבניתי אותו. זה לא היה "כפילות אמיתית
 * שצריך לאחד" - הנתונים עצמם כבר מסומנים נכון (is_legacy), רק הקוד
 * שלי לא כיבד את הסימון.
 */
export async function getPlacesByCityAndKeywords(
  city: string,
  keywords: string[],
  limit = 10
): Promise<PlaceSummary[]> {
  const supabase = await createClient();
  const orFilter = keywords.map((kw) => `category.ilike.%${kw}%`).join(",");
  const { data } = await supabase
    .from("places")
    .select("id,name,rating,image_urls")
    .eq("is_legacy", false)
    .or(cityOrRegionOrFilter(city))
    .or(orFilter)
    .order("rating", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** מלונות הם המקרה היחיד עם עמודת category נקייה/עקבית בפועל (בדקתי -
 *  231 שורות, כולן category="hotels" ממש) - נשאר שוויון מדויק, לא
 *  מילות-מפתח, כדי לא לתפוס בטעות "hostel"/"hotel_review" וכו'. */
export async function getPlacesByCityAndCategory(
  city: string,
  category: string,
  limit = 10
): Promise<PlaceSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("places")
    .select("id,name,rating,image_urls")
    .eq("is_legacy", false)
    .or(cityOrRegionOrFilter(city))
    .eq("category", category)
    .order("rating", { ascending: false })
    .limit(limit);
  return data ?? [];
}
