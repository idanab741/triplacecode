import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { FinalItineraryStop } from "./types";
import type { TripIntent } from "./tripIntentService";

const QUALITY_CHECK_PROMPT_RULES = `אתה עורך בקרת איכות אחרונה על מסלול טיול שכבר נבנה במלואו,
לפני שהוא מוצג למשתמש. זהו הבדיקה העצמית הסופית - עכשיו אתה רואה את המסלול המלא,
כולל סדר אמיתי, שעות הגעה, ומרחקי נסיעה בפועל.

בדוק:
- האם יש יותר מדי תחנות מאותו סוג (למשל שלושה בתי קפה, שתי מסעדות)?
- האם יש חזרה לאחור גיאוגרפית או קפיצה בין אזורים רחוקים?
- האם שעות הארוחות הגיוניות (לא ארוחת צהריים ב-16:00, לא ארוחת ערב ב-11:00)?
- האם יש מספיק זמן בכל תחנה, או שהיום דחוס מדי?
- האם המסלול בכללותו מרגיש כמו יום טבעי וזורם, לא אוסף תחנות אקראי?

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף לפני או אחרי:
{"issues": ["...", "..."]}

אם אין שום בעיה אמיתית - החזר מערך ריק: {"issues": []}
אל תמציא בעיות קטנוניות; רק בעיות שבאמת ישפיעו על חוויית המשתמש.
כל בעיה - משפט קצר וברור בעברית, מכוון למשתמש (לא ז'רגון טכני).`;

interface ReviewItineraryParams {
  stops: FinalItineraryStop[];
  tripIntent?: TripIntent | null;
}

/**
 * בקרת איכות אחרונה על המסלול המורכב במלואו - קריאת Claude נוספת, רק
 * למסלולים ארוכים יותר (half_day/full_day) שבהם הסיכון לחוסר איזון גבוה יותר.
 * לא מתקן אוטומטית - רק מזהה בעיות ומחזיר אותן כאזהרות למשתמש.
 */
export async function reviewItinerary(params: ReviewItineraryParams): Promise<string[]> {
  const stopsPayload = params.stops.map((stop, index) => ({
    order: index + 1,
    name: stop.name,
    category: stop.category,
    arrival_offset_minutes: stop.arrivalOffsetMinutes,
    estimated_visit_minutes: stop.estimatedVisitMinutes,
    eta_minutes_from_previous: stop.etaMinutes,
  }));

  const prompt = `${QUALITY_CHECK_PROMPT_RULES}

Trip Intent:
${JSON.stringify(params.tripIntent ?? { note: "לא זמין" })}

המסלול המלא:
${JSON.stringify(stopsPayload)}`;

  const { text, error } = await callClaude(prompt, 512);
  if (error || !text) return [];

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { issues?: string[] };
    return Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch (parseError) {
    logAiError("כשל בפענוח בדיקת איכות המסלול", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return [];
  }
}