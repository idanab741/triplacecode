import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { findPlacePhotoReference } from "@/services/tripBuilder/placePhotoService";
import { TRIPMATCH_INTEREST_OPTIONS, TRIPMATCH_CATEGORY_BUCKETS } from "@/locales/he/tripBuilder";

interface GeneratedAttraction {
  name: string;
  description: string;
  interest: string;
}

function labelForInterest(id: string): string {
  return TRIPMATCH_INTEREST_OPTIONS.find((o) => o.value === id)?.label ?? id;
}

function labelForCategory(category: string): string {
  return TRIPMATCH_CATEGORY_BUCKETS.find((b) => b.value === category)?.label ?? category;
}

/**
 * מייצר רשימת אטרקציות אמיתיות ליעד (עיר) שאין לו עדיין מועמדים ב-DB - למשל
 * "פריז", "רומא" וכו'. Claude יוצר את הרשימה מהידע הכללי שלו, כל אטרקציה
 * מקבלת תמונה אמיתית מ-Google (פעם אחת), והתוצאה נשמרת ב-DB כך שהיא זמינה
 * לכל משתמש עתידי שיבחר את אותו יעד, בלי לייצר מחדש.
 *
 * *** תיקון: לפני זה, `category` (השדה הראשי, שאמור להיות אחד מ-5
 * הקטגוריות בלבד - ראו src/constants/placeCategories.ts) נשמר בטעות
 * כתת-הקטגוריה העדינה שClaude החזיר (attraction.interest, למשל
 * "coffee_carts_cafes") - בדיוק אותו באג שכבר תוקן ב-smart-search
 * (Discovery). זו הסיבה שיעדים בינלאומיים חדשים לא היו מוצאים תוצאות
 * אחרי שהוספנו את הפילטר `.eq("category", session.category)` - הם
 * נשמרו עם קטגוריה שלא תואמת אף אחת מ-5 האפשרויות. עכשיו category
 * נשמר תמיד כ"דלי" הנכון (מסעדות/חיי לילה/טבע/אטרקציות), ותת-הסוג
 * העדין עובר ל-subcategory + trip_type_tags בלבד.
 */
export async function generateAndSaveDestinationAttractions(
  supabase: SupabaseClient,
  city: string,
  category: string,
  interests: string[]
): Promise<void> {
  const generated = await generateAttractionsWithClaude(city, category, interests);
  if (generated.length === 0) return;

  const cityCoords = await geocodePlaceName(city);

  for (const attraction of generated) {
    const photoRef = await findPlacePhotoReference(`${attraction.name} ${city}`);
    const imageUrls = photoRef ? [`/api/places/photo?ref=${encodeURIComponent(photoRef)}`] : [];

    await supabase.from("places").insert({
      name: attraction.name,
      short_description: attraction.description,
      city,
      latitude: cityCoords?.lat ?? null,
      longitude: cityCoords?.lng ?? null,
      category,
      subcategory: attraction.interest,
      trip_type_tags: [attraction.interest],
      image_urls: imageUrls,
      is_legacy: false,
    });
  }
}

async function generateAttractionsWithClaude(
  city: string,
  category: string,
  interests: string[]
): Promise<GeneratedAttraction[]> {
  // ברירת מחדל: אם לא נבחרו תתי-קטגוריות ספציפיות (המצב הרגיל עכשיו -
  // הבחירה הראשונית היא רק ברמת הדלי), נותנים ל-Claude לבחור בעצמו
  // מתוך תתי-הקטגוריות ששייכות לדלי הזה.
  const effectiveInterests =
    interests.length > 0 ? interests : TRIPMATCH_CATEGORY_BUCKETS.find((b) => b.value === category)?.subTagValues ?? [];
  const interestLabels = effectiveInterests.length > 0 ? effectiveInterests.map(labelForInterest) : [labelForCategory(category)];

  const prompt = `אתה מכיר היטב יעדי טיולים ברחבי העולם. עבור היעד "${city}", צור רשימה של 10-12
אטרקציות אמיתיות ומוכרות, מתוך הקטגוריה "${labelForCategory(category)}" בלבד, שמתאימות לתחומי
העניין הבאים: ${interestLabels.join(", ")}.

חשוב: כל האטרקציות חייבות להשתייך לקטגוריה "${labelForCategory(category)}" - אל תכלול
מקומות מקטגוריות אחרות (למשל אם הקטגוריה היא "מסעדות וקולינריה", אל תכלול אתרי טבע
או אטרקציות תיירותיות כלליות שאינן קשורות לאוכל).

לכל אטרקציה צור: שם אמיתי ומדויק, תיאור קצר (משפט אחד, עד 20 מילים), והתאמה לאחד
מתחומי העניין שסופקו.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
[{"name": "...", "description": "...", "interest": "אחד מהערכים: ${effectiveInterests.join(", ")}"}]`;

  const { text, error } = await callClaude(prompt, 2048);
  if (error || !text) return [];

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as GeneratedAttraction[];
    // *** תיקון: Claude לא תמיד מקפיד להחזיר interest מתוך הרשימה הסגורה
    // שסופקה - לפעמים ממציא ערך משלו באנגלית (למשל "ancient_monument"
    // או "historic_neighborhood") שלא קיים ב-TRIPMATCH_INTEREST_OPTIONS.
    // זו הסיבה שהפילטר בעמוד TripMatch הציג תגיות לא-מתורגמות באנגלית
    // גולמית - getCategoryLabel לא מכיר אותן. עכשיו כל ערך interest
    // שלא ברשימה הסגורה נדרס לערך הראשון מהרשימה, כדי שהתוצאה תמיד
    // תהיה אחת מתתי-הקטגוריות המוכרות שלנו (עם תרגום עברי תקין).
    const validInterests = new Set(effectiveInterests);
    const fallbackInterest = effectiveInterests[0] ?? "attractions_activities";
    return parsed
      .filter((a) => a.name && a.description)
      .map((a) => ({ ...a, interest: validInterests.has(a.interest) ? a.interest : fallbackInterest }));
  } catch (parseError) {
    logAiError("כשל ביצירת אטרקציות ליעד", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      city,
    });
    return [];
  }
}
