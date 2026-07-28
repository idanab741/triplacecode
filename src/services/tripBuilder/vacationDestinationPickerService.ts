import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "./geocodingService";

interface PickDestinationParams {
  vacationTypeLabels: string[];
  freeText: string;
  budgetLabel: string;
  travelStyle: string;
}

export interface ChosenDestination {
  city: string;
  country: string;
  coords: { lat: number; lng: number };
}

/**
 * כשהמשתמש בחר "תפתיעו אותי" - Claude בוחר יעד עולמי אמיתי אחד (עיר+מדינה),
 * לפני שמתחילים לבנות את המסלול היומי. זה רץ פעם אחת בלבד לכל session,
 * לא לכל תחנה - כל התחנות בהמשך נבנות סביב היעד הזה.
 */
export async function pickSurpriseDestination(
  params: PickDestinationParams
): Promise<ChosenDestination | null> {
  const prompt = `אתה מומחה טיולים עולמי. המשתמש ביקש שתפתיעו אותו/אותה ביעד לחופשה, לפי:
סוג חופשה: ${params.vacationTypeLabels.join(", ") || "כל סוג"}
תקציב: ${params.budgetLabel}
סגנון טיול: ${params.travelStyle}
בקשה נוספת: ${JSON.stringify(params.freeText || null)}

בחר **יעד אחד אמיתי וספציפי** (עיר ומדינה) שמתאים בול לבקשה - לא רשימה, יעד אחד בלבד.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"city": "שם העיר", "country": "שם המדינה"}`;

  const { text, error } = await callClaude(prompt, 300);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { city: string; country: string };
    if (!parsed.city) return null;

    const coords = await geocodePlaceName(`${parsed.city}, ${parsed.country}`);
    if (!coords) return null;

    return { city: parsed.city, country: parsed.country, coords };
  } catch (parseError) {
    logAiError("כשל בבחירת יעד הפתעה מ-Claude", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}