import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "./geocodingService";
import { findPlacePhotoReference } from "./placePhotoService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace, LatLng } from "./types";

interface SuggestRestaurantParams {
  city: string;
  cuisine: string[];
  freeText: string;
  budgetLabel: string;
}

interface ClaudeRestaurantSuggestion {
  name: string;
  description: string;
  reason: string;
}

/**
 * מבקש מ-Claude המלצה אמיתית על מסעדה/בית קפה ספציפיים לפי הידע הכללי שלו
 * (לא רק מתוך מה שכבר קיים ב-DB) - ה-AI מוביל, ה-DB הוא רק גיבוי. מאמת את
 * ההמלצה עם תמונה ומיקום אמיתיים מגוגל.
 */
export async function suggestRealRestaurant(params: SuggestRestaurantParams): Promise<CandidatePlace | null> {
  const suggestion = await askClaudeForRestaurant(params);
  if (!suggestion) return null;

  const coords = await geocodePlaceName(`${suggestion.name}, ${params.city}`);
  if (!coords) return null; // אם גוגל לא מזהה את המקום - כנראה שם לא מדויק, נופלים חזרה ל-DB

  const photoRef = await findPlacePhotoReference(`${suggestion.name} ${params.city}`);
  const imageUrls = photoRef ? [`/api/places/photo?ref=${encodeURIComponent(photoRef)}`] : [];

  return {
    id: `ai-${Date.now()}`,
    name: suggestion.name,
    category: "wineries_dining",
    subcategory: null,
    shortDescription: suggestion.description,
    imageUrls,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    estimatedVisitMinutes: 75,
    latitude: coords.lat,
    longitude: coords.lng,
    distanceKm: 0,
    etaMinutes: 0,
    tripTypeTags: [],
    cuisineTags: params.cuisine,
    kosher: null,
    accessible: null,
    suitableChildAges: [],
    budgetTier: null,
    isAreaExperience: false,
    reason: suggestion.reason,
  } as CandidatePlace;
}

async function askClaudeForRestaurant(params: SuggestRestaurantParams): Promise<ClaudeRestaurantSuggestion | null> {
  const cuisineLabels = params.cuisine.length > 0 ? params.cuisine.map(getCategoryLabel).join(", ") : "כל סוג אוכל";

  const prompt = `אתה מכיר היטב מסעדות ובתי קפה אמיתיים ב-${params.city}. המשתמש מחפש: ${cuisineLabels}.
בקשה נוספת מהמשתמש: ${JSON.stringify(params.freeText || null)}
תקציב: ${params.budgetLabel}

המלץ על מסעדה או בית קפה **אמיתיים וקיימים בפועל** ב-${params.city}, שמתאימים בדיוק לבקשה -
לא מקום מומצא. אם אתה לא בטוח שיש מקום אמיתי שמתאים היטב, השב עם name ריק.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"name": "השם המדויק של המקום או ריק אם לא בטוח", "description": "משפט קצר על המקום", "reason": "משפט קצר שמסביר למה זה מתאים לבקשה"}`;

  const { text, error } = await callClaude(prompt, 500);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeRestaurantSuggestion;
    if (!parsed.name || !parsed.name.trim()) return null;
    return parsed;
  } catch (parseError) {
    logAiError("כשל בהמלצת מסעדה מ-Claude", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}