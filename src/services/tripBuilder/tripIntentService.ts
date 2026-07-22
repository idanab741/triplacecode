import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { DayTripAnswers } from "./types";

export interface TripIntent {
  summary: string;
  pace: "relaxed" | "moderate" | "fast";
  priorities: string[];
  avoid: string[];
  accessibilityNotes: string[];
  requestedArea: string | null;
}

const TRIP_INTENT_PROMPT_RULES = `אתה מתכנן טיולים מקצועי ב-TRIPLACE. המשתמש אינו ממלא טופס - הוא
משתף אותך במה שהוא מחפש. המשימה שלך כרגע היא לא לבחור מקומות, אלא להבין את המשתמש
ולסכם זאת במסמך "כוונת טיול" קצר וברור, שישמש את כל שאר תהליך התכנון.

היררכיית מקורות המידע:
- מלל חופשי: כ-60-70% מהמשקל - זהו מרכז ההבנה, לא הערה נלווית.
- תשובות השאלון: כ-20-30% - מחדדות, לא קובעות.
- פרופיל/העדפות קודמות: כ-10%, משלים כשאין מידע מפורש.

הסק גם את מה שלא נאמר במפורש. לדוגמה:
- "ילדה בת שנתיים" -> עגלה, שירותים, צל, הליכה קצרה, עצירות מנוחה.
- "יום רגוע" -> פחות תחנות, פחות נסיעות, פחות לחץ.
- "יש לנו רק X שעות" -> מספר תחנות מצומצם, מרחקים קצרים.
- "בא לנו לראות נופים" -> תצפיות/טבע, להקטין משקל מסעדות.
- "יום של אוכל" -> כל המסלול סביב חוויה קולינרית.

אם המלל החופשי מזכיר שם מקום ספציפי (עיר, שכונה, אתר, רחוב) שבו המשתמש רוצה שהטיול יתקיים
(למשל "יום ביפו", "רוצים לבלות בנווה צדק", "טיול בזכרון יעקב") - חלץ את השם המדויק לשדה
requestedArea. אם לא הוזכר מקום ספציפי, החזר null.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף לפני או אחרי:
{
  "summary": "משפט או שניים בעברית שמתארים את הטיול הרצוי, כאילו מתארים אותו לחבר שיתכנן אותו",
  "pace": "relaxed" | "moderate" | "fast",
  "priorities": ["...", "..."],
  "avoid": ["...", "..."],
  "accessibilityNotes": ["...", "..."],
  "requestedArea": "שם המקום או null"
}`;

interface GenerateTripIntentParams {
  dna: TravelDna | null;
  answers: DayTripAnswers;
  weatherSummary: string | null;
}

/**
 * יוצר "מסמך כוונה" (Trip Intent) - קריאת Claude אחת, בתחילת התהליך,
 * שמסכמת את הבנת המשתמש. המסמך הזה נשמר ומוזן לכל הקריאות הבאות
 * (בחירת קטגוריות, דירוג מועמדים), כדי שההבנה תהיה עקבית לאורך כל התהליך
 * במקום "להתחיל מאפס" בכל קריאה בנפרד.
 */
export async function generateTripIntent(params: GenerateTripIntentParams): Promise<TripIntent | null> {
  const prompt = `${TRIP_INTENT_PROMPT_RULES}

מלל חופשי מהמשתמש:
${JSON.stringify(params.answers.freeText || null)}

תשובות השאלון:
${JSON.stringify({
    companions: params.answers.companions,
    hasPet: params.answers.hasPet,
    childAgeBands: params.answers.childAgeBands,
    timing: params.answers.timing,
    distanceBand: params.answers.distanceBand,
    budgetBand: params.answers.budgetBand,
    interests: params.answers.interests.map(getCategoryLabel),
    durationBand: params.answers.durationBand,
  })}

Travel DNA:
${JSON.stringify(
    params.dna
      ? {
          interests: params.dna.interests.map(getCategoryLabel),
          preferred_categories_from_behavior: params.dna.preferred_categories.map(getCategoryLabel),
          kosher: params.dna.kosher,
          accessibility: params.dna.accessibility,
        }
      : { note: "אין עדיין מידע על המשתמש" }
  )}

מזג אוויר: ${JSON.stringify(params.weatherSummary)}`;

  const { text, error } = await callClaude(prompt, 512);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as Partial<TripIntent>;

return {
      summary: parsed.summary ?? "",
      pace: parsed.pace === "relaxed" || parsed.pace === "fast" ? parsed.pace : "moderate",
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid : [],
      accessibilityNotes: Array.isArray(parsed.accessibilityNotes) ? parsed.accessibilityNotes : [],
      requestedArea: typeof parsed.requestedArea === "string" && parsed.requestedArea.trim() ? parsed.requestedArea : null,
    };
  } catch (parseError) {
    logAiError("כשל בפענוח Trip Intent", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return null;
  }
}