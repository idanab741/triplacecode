import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { FinalItineraryStop } from "./types";
import type { TripIntent } from "./tripIntentService";

/**
 * מייצר תיאור קצר ואישי לכל תחנה במסלול הסופי - קריאת Claude אחת לכל המסלול.
 * לא מסתמך רק על short_description שקיים ב-DB (שיכול להיות ריק/גנרי) - Claude
 * משתמש בידע הכללי שלו על המקום, ומחבר את התיאור לבקשה הספציפית של המשתמש.
 * ה-DB הוא רק רמז אופציונלי, לא המקור העיקרי.
 */
export async function generatePersonalizedDescriptions(
  stops: FinalItineraryStop[],
  freeText: string,
  tripIntent?: TripIntent | null
): Promise<Map<string, string>> {
  if (stops.length === 0) return new Map();

  const prompt = `אתה מדריך טיולים עם ידע עמוק במקומות ברחבי העולם. עבור כל תחנה במסלול הטיול
הבא, כתוב תיאור קצר ואישי (משפט אחד, עד 20 מילים) - השתמש בידע הכללי שלך על המקום (אווירה, מה
מיוחד בו, למה כדאי לבקר), לא רק בתיאור הגנרי שמופיע ב-DB (אם בכלל יש). חבר את התיאור לבקשה של
המשתמש כשרלוונטי.

בקשת המשתמש (מלל חופשי): ${JSON.stringify(freeText || null)}
כוונת הטיול: ${JSON.stringify(tripIntent?.summary ?? null)}

התחנות:
${JSON.stringify(
    stops.map((s) => ({
      stopId: s.stopId,
      name: s.name,
      category: s.category,
      existing_description_hint: s.shortDescription,
    }))
  )}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
[{"stopId": "...", "description": "..."}, ...]`;

  // maxTokens/timeout קבועים (1024/12 שניות) הספיקו לטיול יום אחד, אבל לא
  // לחופשה בחו"ל עם 30-50+ תחנות - הקריאה נכשלת/נקטעת, ומחזירה Map ריק
  // לגמרי, כך שאף תחנה לא מקבלת תיאור. גדלים לפי כמות התחנות בפועל.
  const maxTokens = Math.min(8000, 300 + stops.length * 60);
  const timeoutMs = Math.min(40000, 12000 + stops.length * 400);
  const { text, error } = await callClaude(prompt, maxTokens, timeoutMs);
  if (error || !text) return new Map();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return new Map();
    const parsed = JSON.parse(jsonMatch[0]) as { stopId: string; description: string }[];
    return new Map(parsed.map((item) => [item.stopId, item.description]));
  } catch (parseError) {
    // תשובה חלקית (נקטעה) - עדיף להציל את מה שכן פוענח בהצלחה (רוב
    // התחנות) על פני לוותר על הכל ולהשאיר את כולן בלי תיאור.
    const recovered = tryRecoverPartialDescriptions(text);
    if (recovered.size > 0) return recovered;

    logAiError("כשל בייצור תיאורים אישיים למסלול", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return new Map();
  }
}

function tryRecoverPartialDescriptions(text: string): Map<string, string> {
  const startIndex = text.indexOf("[");
  if (startIndex === -1) return new Map();

  const lastGoodClose = text.lastIndexOf("},");
  if (lastGoodClose === -1 || lastGoodClose < startIndex) return new Map();

  const truncated = text.slice(startIndex, lastGoodClose + 1) + "]";
  try {
    const parsed = JSON.parse(truncated) as { stopId: string; description: string }[];
    return new Map(parsed.map((item) => [item.stopId, item.description]));
  } catch {
    return new Map();
  }
}