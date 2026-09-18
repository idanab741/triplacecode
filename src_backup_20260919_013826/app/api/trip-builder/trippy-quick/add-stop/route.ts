import { NextRequest, NextResponse } from "next/server";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { TRIP_TYPE_GROUPS, CUISINE_TAGS } from "@/services/places/tripTaxonomy";
import { createClient } from "@/services/supabase/server";
import {
  type TrippyQuickStop,
  NIGHTLIFE_TAG_IDS,
  toStop,
  fetchAttractionPlaces,
  fetchRestaurantPlaces,
  fetchNightlifePlaces,
} from "@/services/tripBuilder/trippyQuickShared";

/**
 * *** תכונה חדשה (בקשה מפורשת - "אפשר להוסיף עוד איזה עצירה אחרי
 * המסלול, תהיה יצירתי!! ומדויק"): "יצירתי" = Claude מציע *מה* מתאים
 * להוסיף בהתחשב בשאר המסלול (למשל מסלול טבע -> הצעה למקום אוכל
 * קרוב, לא עוד אטרקציה זהה). "מדויק" = בדיוק כמו כל שאר הזרימה -
 * ההצעה עצמה רק קובעת קטגוריה/תגים, והחיפוש בפועל תמיד מול ה-DB
 * הפנימי שלנו (fetchDiscoveryPlaces) - לעולם לא Google, ולעולם לא
 * שם מקום מומצא.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const existingNames: string[] = Array.isArray(body?.existingNames) ? body.existingNames : [];
  const freeText = typeof body?.freeText === "string" ? body.freeText : "";
  const city = typeof body?.city === "string" ? body.city : null;
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;
  const excludeIds: string[] = Array.isArray(body?.excludeIds) ? body.excludeIds : [];

  const attractionIds = TRIP_TYPE_GROUPS.map((g) => g.id).join(", ");
  const cuisineIds = CUISINE_TAGS.map((t) => t.id).join(", ");
  const nightlifeIds = NIGHTLIFE_TAG_IDS.join(", ");

  const prompt = `אתה מומחה טיולים. המשתמש כבר בנה מסלול-יום עם התחנות
הבאות: ${JSON.stringify(existingNames)} (הבקשה המקורית הייתה:
${JSON.stringify(freeText)}). הוא רוצה עצירה **נוספת אחת** שמשלימה את
המסלול הקיים בצורה הגיונית - לא עוד אותו דבר, ולא משהו שלא קשור.
לדוגמה: אם המסלול הוא טיול טבע, הצע מקום אוכל/קפה קרוב לסיום היום;
אם הוא כבר כולל מסעדה, הצע אטרקציה במקום עוד מסעדה.

חלץ קטגוריה אחת בלבד - attraction, restaurant, או nightlife - ואת
התגים המתאימים לה:
- אם attraction: category="attraction", tags = מערך מתוך: ${attractionIds}
- אם restaurant: category="restaurant", tags = מערך מתוך: ${cuisineIds} (אפשר ריק = כל מטבח)
- אם nightlife: category="nightlife", tags = מערך מתוך: ${nightlifeIds}

השב אך ורק במבנה JSON: {"category": "attraction"|"restaurant"|"nightlife", "tags": ["..."]}`;

  const { text, error } = await callClaude(prompt, 300);
  if (error || !text) {
    logAiError("trippy-quick/add-stop: הצעה מ-Claude נכשלה", { error });
    return NextResponse.json({ stop: null });
  }

  let category: TrippyQuickStop["category"] | null = null;
  let tags: string[] = [];
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.category === "attraction" || parsed.category === "restaurant" || parsed.category === "nightlife") {
        category = parsed.category;
      }
      tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === "string") : [];
    }
  } catch {
    return NextResponse.json({ stop: null });
  }
  if (!category) return NextResponse.json({ stop: null });

  const supabase = await createClient();
  const location = { lat, lng, city };
  const hasExplicitCity = city != null || lat != null;

  const places =
    category === "attraction"
      ? await fetchAttractionPlaces({ supabase, location, hasExplicitCity, limit: 1, excludeIds, attractionCategoryIds: tags })
      : category === "restaurant"
        ? await fetchRestaurantPlaces({ supabase, location, hasExplicitCity, limit: 1, excludeIds, cuisineIds: tags })
        : await fetchNightlifePlaces({ supabase, location, hasExplicitCity, limit: 1, excludeIds, nightlifeTagIds: tags });

  const stop = places.length > 0 ? toStop(places[0], category, tags) : null;
  return NextResponse.json({ stop });
}
