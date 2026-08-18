import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { haversineDistanceKm } from "./geo";
import type { CandidatePlace, LatLng } from "./types";

interface MustSeeParams {
  destination: string;
  vacationTypeLabels: string[];
  freeText: string;
}

/**
 * בקשה מפורשת: "לא הגיוני שבטיול רומנטי לפריז אין התייחסות למגדל אייפל
 * ושייט בנהר הסיין" - Claude (בלי שום קריאת Google API) מציע רשימה
 * קצרה של האתרים/החוויות ה"מובהקים" ביותר של היעד, עם עדיפות לאתרים
 * שמתאימים לאופי הטיול הספציפי (רומנטי/משפחתי/וכו') כשזה רלוונטי.
 * הרשימה הזו היא רק *הצעות שמות* - findMustSeePlaces (למטה) הוא זה
 * שבודק בפועל מה מהם קיים אצלנו במאגר, ורק אלה נכנסים למסלול בוודאות.
 */
export async function suggestMustSeeLandmarks(params: MustSeeParams): Promise<string[]> {
  const prompt = `אתה מומחה טיולים עולמי. עבור היעד "${params.destination}", תן רשימה קצרה
(3 עד 6) של האתרים/החוויות ה"מובהקים" ביותר - הסמלים המוכרים והמפורסמים ביותר
של היעד הזה, שכל מבקר ראשון-פעם צריך לשקול לכלול בטיול (למשל בפריז: מגדל
אייפל, שייט בנהר הסיין; ברומא: הקולוסאום, מזרקת טרווי).

חשוב - התאמה לאופי הטיול הספציפי: אם ההקשר הבא מרמז על אופי מסוים, תן עדיפות
לאתרים/חוויות שמתאימים לו במיוחד, לא רק לרשימת "חובה" גנרית. לדוגמה: אם ההקשר
רומנטי (בן/בת זוג, ירח דבש, המילה "רומנטי") - העדף חוויות רומנטיות מובהקות
(שייט זוגי, נקודת תצפית לשקיעה) על פני אתרים כלליים גדולים (מוזיאון ענק,
קניון). אם ההקשר משפחתי עם ילדים קטנים - העדף אתרים שמתאימים לגיל.

סוג חופשה: ${params.vacationTypeLabels.join(", ") || "כל סוג"}
בקשה חופשית מהמשתמש: ${JSON.stringify(params.freeText || null)}

השב אך ורק במבנה JSON הבא - מערך שמות בלבד, בלי תיאור, בלי שום טקסט נוסף:
["שם אתר/חוויה 1", "שם אתר/חוויה 2", ...]`;

  const { text, error } = await callClaude(prompt, 500);
  if (error || !text) {
    logAiError("הצעת אתרי חובה נכשלה - ממשיכים בלי אתרי חובה", { destination: params.destination, error });
    return [];
  }

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
  } catch (parseError) {
    logAiError("כשל בפענוח אתרי חובה", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      destination: params.destination,
    });
    return [];
  }
}

/**
 * תיקון קריטי: קודם הפונקציה הזו סיננה לפי `.ilike("city", "%"+city+"%")`,
 * כש-city היה destinationName. הבעיה: כשהיעד הגיע מ-pickSurpriseDestination
 * (זרימת "אמשיך לבד"), destinationName נשמר בפורמט "עיר, מדינה" (למשל
 * "רומא, איטליה") - אבל עמודת places.city היא בדרך כלל רק שם העיר לבד
 * ("רומא"), בלי המדינה. "רומא" לא *מכיל* את המחרוזת "רומא, איטליה"
 * כתת-מחרוזת - כך שההתאמה נכשלה תמיד בדיוק בזרימה שהכי משנה (זו
 * שהוספתי!), וכל אתרי החובה נשמטו בשקט בלי שום שם נמצא.
 *
 * התיקון: לא מסתמכים על התאמת מחרוזת ל-city בכלל - מסננים לפי **מרחק
 * גיאוגרפי אמיתי** ממרכז היעד (origin/maxDistanceKm, בדיוק כמו
 * fetchCandidatePool), חסין לגמרי לפורמט/ניסוח/שפה של עמודת city.
 */
export async function findMustSeePlaces(
  supabase: SupabaseClient,
  rawNames: string[],
  origin: LatLng,
  maxDistanceKm: number
): Promise<CandidatePlace[]> {
  const results: CandidatePlace[] = [];
  const usedIds = new Set<string>();

  for (const name of rawNames) {
    const normalizedName = name.trim();
    if (!normalizedName) continue;

    // לא מסננים לפי city בשאילתה עצמה (חסין לפורמט "עיר"/"עיר, מדינה"/
    // שפה) - שולפים כמה התאמות שם ומסננים לפי מרחק אמיתי מהיעד ב-JS,
    // בדיוק כמו שאר קוד בניית הטיול עובד עם מרחקים (לא שמות ערים).
    const { data } = await supabase
      .from("places")
      .select(
        "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience"
      )
      .eq("is_legacy", false)
      .ilike("name", `%${normalizedName}%`)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(10);

    const withinRange = (data ?? []).find((row) => {
      if (usedIds.has(row.id as string)) return false;
      const distanceKm = haversineDistanceKm(origin, { lat: row.latitude as number, lng: row.longitude as number });
      return distanceKm <= maxDistanceKm;
    });

    if (!withinRange) continue;
    usedIds.add(withinRange.id as string);

    results.push({
      id: withinRange.id,
      name: withinRange.name,
      category: withinRange.category,
      subcategory: withinRange.subcategory,
      shortDescription: withinRange.short_description,
      imageUrls: withinRange.image_urls ?? [],
      rating: withinRange.rating,
      ratingCount: withinRange.rating_count,
      priceLevel: withinRange.price_level,
      estimatedVisitMinutes: withinRange.estimated_visit_minutes,
      latitude: withinRange.latitude,
      longitude: withinRange.longitude,
      distanceKm: haversineDistanceKm(origin, { lat: withinRange.latitude, lng: withinRange.longitude }),
      etaMinutes: 0,
      tripTypeTags: withinRange.trip_type_tags ?? [],
      cuisineTags: withinRange.cuisine_tags ?? [],
      kosher: withinRange.kosher,
      accessible: withinRange.accessible,
      suitableChildAges: withinRange.suitable_child_ages ?? [],
      budgetTier: withinRange.budget_tier,
      isAreaExperience: withinRange.is_area_experience ?? false,
      reason: "אתר חובה מובהק ביעד",
      source: "fallback",
    });
  }
  return results;
}
