import { createClient } from "@/services/supabase/server";

export interface Destination {
  id: string;
  name: string;
  country: string;
  description: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** לשימוש ב-Server Components בלבד. */
export async function getDestinationById(id: string): Promise<Destination | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("destinations").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface DestinationCandidate {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** כמה מקומות/אטרקציות אמיתיים קיימים ביעד הזה ב-DB - ר' הערה למטה. */
  placeCount: number;
  /** תיקון פער אמיתי (Audit מול MASTER SPEC סעיפים 62/67): רמת-מחיר
   *  ממוצעת (0-4, סקאלת Google) של המקומות שכבר קיימים ב-DB באזור הזה -
   *  נתון **אמיתי**, לא מומצא (אין לנו מחיר לינה אמיתי לאף יעד, והמפרט
   *  אוסר להמציא אחד) - אבל כן אפשר להשתמש בעלות הממוצעת של מקומות
   *  אמיתיים באזור כאיתות הקשר גס לרמת היוקרה/עלות הכללית שלו, כדי
   *  שתקציב יוכל בכלל להשפיע על בחירת יעד. null אם אין מספיק נתוני מחיר.
   */
  avgPriceLevel: number | null;
}

/** מתחת לסף הזה, "יעד" לא נחשב מספיק מוכן כדי להפתיע אליו משתמש.
 *  תיקון (בקשה מפורשת - "יש הכל אצלי באדמין"): הסף הוגדל משמעותית
 *  (מ-3 ל-20) - לא רק "יש כמה מקומות", אלא מספיק כדי שטיול חו"ל שלם
 *  (בדרך כלל 15-40 תחנות לאורך כמה ימים) יתמלא **כולו** מהמאגר הפנימי,
 *  בלי בכלל להגיע לגיבוי ה-AI האיטי (generateVacationItinerary, שממציא
 *  מקומות ומאמת אותם מול Google - שניות ארוכות לכל תהליך). ככל שהסף
 *  גבוה יותר, "תפתיעו אותי" בוחר רק יעדים שכבר מכוסים היטב באדמין. */
const MIN_PLACES_PER_DESTINATION = 20;

/**
 * תיקון (audit): במקור הפונקציה הזו שאבה מטבלת `destinations` (רשימת
 * 221 שמות ערים "יבשה", בלי שום קשר לשאלה האם יש להן בפועל תוכן מוכן -
 * ר' migration 0021/0023). זה *לא* מה שהתבקש: מקור האמת הנכון הוא
 * טבלת `places` - בדיוק מה שעמוד האדמין "ניהול יעדים ואטרקציות"
 * (`/admin/content-dashboard`, ר' navConfig.ts) מציג בפועל (הוא קורא
 * מ-`/api/admin/places`, שמחזיר את טבלת `places`). לכל שורה שם יש עמודת
 * `city`+`country` - אלה ה"יעדים" האמיתיים שיש להם כבר אטרקציות/מקומות
 * מוכנים בפועל, לא רק שם עיר ברשימה.
 *
 * מקבצים לפי city+country (מנורמל - trim+lowercase להשוואה, אבל השם
 * המוצג הוא הכתיב המקורי הראשון שנמצא), עם קואורדינטת "מרכז" ממוצעת של
 * כל המקומות בעיר (כדי שתהיה נקודת התחלה סבירה לחיפוש/מרחקים בהמשך).
 * יעד עם פחות מ-MIN_PLACES_PER_DESTINATION מקומות בפועל לא נכלל - "יעד"
 * עם אטרקציה בודדת לא מספיק מוכן כדי להפתיע אליו משתמש.
 */
/**
 * הליבה המשותפת - שולפת ומקבצת את כל היעדים מטבלת `places` (בלי סינון
 * MIN_PLACES_PER_DESTINATION), כדי ששני הצרכנים למטה (getDestinationCandidates
 * ל"תפתיעו אותי", ו-findAdminDestinationByName ליעד מפורש) יעבדו על אותו
 * מקור נתונים בדיוק בלי לשכפל את קריאת ה-DB/הקיבוץ.
 */
async function computeAllDestinationCandidates(): Promise<DestinationCandidate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("places")
    .select("city, country, latitude, longitude, price_level")
    .eq("is_legacy", false)
    .not("city", "is", null)
    .not("country", "is", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    // תיקון: בלי range מפורש, ה-client מגביל בשקט ל-1000 שורות ברירת
    // מחדל - על טבלת places גדולה זה חותך מועמדים שרירותית בלי אזהרה.
    // אותו טווח בדיוק כמו /api/admin/places (GET) - "כל המקומות" בפועל.
    .range(0, 4999);

  interface Accumulator {
    name: string;
    country: string;
    latSum: number;
    lngSum: number;
    count: number;
    priceLevelSum: number;
    priceLevelCount: number;
  }
  const grouped = new Map<string, Accumulator>();

  for (const row of data ?? []) {
    const city = (row.city as string).trim();
    const country = (row.country as string).trim();
    if (!city || !country) continue;
    const key = `${city.toLowerCase()}__${country.toLowerCase()}`;
    const priceLevel = row.price_level as number | null;
    const existing = grouped.get(key);
    if (existing) {
      existing.latSum += row.latitude as number;
      existing.lngSum += row.longitude as number;
      existing.count += 1;
      if (priceLevel != null) {
        existing.priceLevelSum += priceLevel;
        existing.priceLevelCount += 1;
      }
    } else {
      grouped.set(key, {
        name: city,
        country,
        latSum: row.latitude as number,
        lngSum: row.longitude as number,
        count: 1,
        priceLevelSum: priceLevel ?? 0,
        priceLevelCount: priceLevel != null ? 1 : 0,
      });
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    name: g.name,
    country: g.country,
    latitude: g.latSum / g.count,
    longitude: g.lngSum / g.count,
    placeCount: g.count,
    avgPriceLevel: g.priceLevelCount > 0 ? g.priceLevelSum / g.priceLevelCount : null,
  }));
}

export async function getDestinationCandidates(): Promise<DestinationCandidate[]> {
  const all = await computeAllDestinationCandidates();
  return all.filter((g) => g.placeCount >= MIN_PLACES_PER_DESTINATION);
}

/**
 * תיקון (בקשה מפורשת - "רק דרך תיקיית ה-ADMIN שלנו, אף פעם לא גוגל"):
 * כשהמשתמש כבר ציין יעד מפורש (בין אם בחר אותו מהאוטוקומפליט, ובין אם
 * הוא חולץ מהמלל החופשי ב"בואו נבנה יחד") - מוצאים את הקואורדינטות שלו
 * **אך ורק** מתוך טבלת `places` שלנו (בדיוק אותו מקור נתונים כמו "תפתיעו
 * אותי"), ולעולם לא דרך Google Geocoding. אם קריאה ל-Google נכשלת (למשל
 * בגלל קוואטה) התהליך הישן היה ממשיך "בשקט" עם מיקום שגוי/ברירת מחדל,
 * וזה מה שגרם ל"לא נבחרו מספיק תחנות" - הפונקציה הזו מסירה את התלות
 * הזו לגמרי מהזרימה הזו.
 *
 * בשונה מ-getDestinationCandidates (שמוגבל ל-MIN_PLACES_PER_DESTINATION,
 * כי שם מציעים יעד *אקראי* וצריך ערובת איכות) - כאן אין סף מינימום: אם
 * המשתמש ביקש יעד ספציפי וכתוב אצלנו, גם עם מעט מקומות, נשתמש בו.
 */
export async function findAdminDestinationByName(query: string): Promise<DestinationCandidate | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // "רומא, איטליה" -> משתמשים רק בחלק העיר (לפני הפסיק הראשון) להתאמה,
  // כי זה מה שבפועל שמור ב-places.city.
  const cityPart = trimmed.split(",")[0].trim();
  const normalize = (v: string) => v.trim().toLowerCase();
  const target = normalize(cityPart);
  if (!target) return null;

  const candidates = await computeAllDestinationCandidates();

  const exact = candidates.find((c) => normalize(c.name) === target);
  if (exact) return exact;

  const partial = candidates.find(
    (c) => normalize(c.name).includes(target) || target.includes(normalize(c.name))
  );
  return partial ?? null;
}
