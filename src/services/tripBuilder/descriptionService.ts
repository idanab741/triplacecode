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

  const prompt = `אתה מכיר היטב מקומות בישראל. עבור כל תחנה במסלול הטיול הבא, כתוב תיאור קצר
ואישי (משפט אחד, עד 20 מילים) - השתמש בידע הכללי שלך על המקום (אווירה, מה מיוחד בו, למה
כדאי לבקר), לא רק בתיאור הגנרי שמופיע ב-DB (אם בכלל יש). חבר את התיאור לבקשה של המשתמש
כשרלוונטי.

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

  const { text, error } = await callClaude(prompt, 1024);
  if (error || !text) return new Map();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return new Map();
    const parsed = JSON.parse(jsonMatch[0]) as { stopId: string; description: string }[];
    return new Map(parsed.map((item) => [item.stopId, item.description]));
  } catch (parseError) {
    logAiError("כשל בייצור תיאורים אישיים למסלול", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return new Map();
  }
}