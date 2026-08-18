import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getVacationTypeLabel } from "@/locales/he/abroadVacation";
import type { DayBlueprint, VacationContext } from "./types";

/** בקשה מפורשת - 5 שניות: אם קריאת ה-AI ליום מסוים לא חוזרת בזמן הזה,
 *  נופלים לתבנית הקבועה הדטרמיניסטית (ר' fallbackBlueprint למטה) - לא
 *  תוקעים את הבנייה של כל שאר הטיול בשביל יום אחד. */
const BLUEPRINT_TIMEOUT_MS = 5000;

/**
 * קריאת ה-AI המרכזית (MASTER PROMPT סעיף 36) לכל יום "רגיל" - לא יום 1,
 * לא יום אחרון (אלה נשארים דטרמיניסטיים לגמרי, בלי שום קריאת AI). מחזירה
 * **רק אסטרטגיה ברמת-על** - כותרת, עוצמה (כמה אטרקציות, האם יש ארוחת
 * צהריים בנוסף לערב), ומיקוד קטגוריות. **לא** בוחרת מקום ספציפי - זה
 * נשאר אצל fetchCandidatePool/rankCandidatesFast, בדיוק כמו כל התחנות
 * האחרות היום. previousDayTitles מועבר כדי שהיום הזה לא יחזור על אותה
 * תמה מילולית כמו יום קודם - בכוונה בלי לפרט focusCategories של הימים
 * הקודמים (מיותר, ומסוכן: AI שרואה בדיוק מה "נוצל" עלול לברוח לקטגוריות
 * אקזוטיות רק כדי להיות שונה, במקום לבחור את המתאים ביותר).
 */
export async function generateDayBlueprint(
  context: VacationContext,
  dayNumber: number,
  previousDayTitles: string[]
): Promise<DayBlueprint> {
  const fallback = fallbackBlueprint(context);

  const prompt = buildPrompt(context, dayNumber, previousDayTitles);
  const { text, error } = await callClaude(prompt, 400, BLUEPRINT_TIMEOUT_MS);

  if (error || !text) {
    logAiError("קריאת Blueprint ליום נכשלה/עברה timeout - נופלים לתבנית הקבועה", {
      destination: context.trip.destination,
      dayNumber,
      error,
    });
    return fallback;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<DayBlueprint>;

    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      attractionsCount: clampAttractionsCount(parsed.attractionsCount),
      includeSecondFoodStop: typeof parsed.includeSecondFoodStop === "boolean" ? parsed.includeSecondFoodStop : fallback.includeSecondFoodStop,
      focusCategories:
        Array.isArray(parsed.focusCategories) && parsed.focusCategories.length > 0
          ? parsed.focusCategories.filter((c): c is string => typeof c === "string").slice(0, 2)
          : fallback.focusCategories,
    };
  } catch (parseError) {
    logAiError("כשל בפענוח Blueprint - נופלים לתבנית הקבועה", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      dayNumber,
    });
    return fallback;
  }
}

function clampAttractionsCount(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : 4;
  return Math.min(4, Math.max(2, n));
}

/** תבנית קבועה - זהה למה שהיה קיים לפני ה-Blueprint (קפה-אטרקציה-אטרקציה-
 *  מסעדה-אטרקציה-אטרקציה-מסעדה) - fallback בטוח שכבר עבד היטב. */
function fallbackBlueprint(context: VacationContext): DayBlueprint {
  return {
    title: `יום בילויים ב${context.trip.destination}`,
    attractionsCount: 4,
    includeSecondFoodStop: true,
    focusCategories: context.trip.vacationTypes.slice(0, 2),
  };
}

/** בקשה מפורשת ("ביקשתי במלל החופשי גם בטן גב - אז צריך חופים!!"):
 *  focusCategories היה מוגבל אך ורק לסוגי החופשה שסומנו בשאלון - Claude
 *  לא יכול היה להציע "חופים" בגלל מלל חופשי, גם אם זה בדיוק מה שהמשתמש
 *  ביקש שם, כי האפשרויות שהוא קיבל כלל לא כללו את זה. עכשיו: אם המלל
 *  החופשי מרמז במפורש על מנוחה/חוף/ים - "relax" (חוף/בריכה) נוסף
 *  לרשימת האפשרויות, גם אם לא סומן בשאלון. */
function detectImpliedVacationTypesFromFreeText(freeText: string): string[] {
  const relaxKeywords = ["בטן גב", "רגיעה", "להירגע", "לנוח", "מנוחה", "חוף", "חופים", "ים", "relax", "beach"];
  const implied: string[] = [];
  if (relaxKeywords.some((kw) => freeText.includes(kw))) implied.push("relax");
  return implied;
}

function buildPrompt(context: VacationContext, dayNumber: number, previousDayTitles: string[]): string {
  const impliedVacationTypes = detectImpliedVacationTypesFromFreeText(context.trip.freeText).filter(
    (t) => !context.trip.vacationTypes.includes(t)
  );
  const effectiveVacationTypes = [...context.trip.vacationTypes, ...impliedVacationTypes];
  const vacationTypeLabels = effectiveVacationTypes.map(getVacationTypeLabel).join(", ") || "כל סוג";
  // מפתחות גולמיים (לא תוויות בעברית!) - categoryPlanForDay ממפה
  // focusCategories חזרה לקטגוריה בפועל דרך VACATION_TYPE_TO_CATEGORY,
  // שמפתחותיו הם הערכים הגולמיים האלה (למשל "culture", לא "תרבות").
  const focusCategoryOptions =
    effectiveVacationTypes.length > 0
      ? effectiveVacationTypes.map((v) => `${v} (${getVacationTypeLabel(v)})`).join(", ")
      : "attractions (אטרקציות כלליות)";
  const previousTitlesText =
    previousDayTitles.length > 0 ? previousDayTitles.map((t, i) => `יום ${i + 1}: ${t}`).join("\n") : "(אין ימים קודמים)";

  return `אתה מתכנן חופשות מומחה. זהו יום ${dayNumber} מתוך חופשה בת ${context.trip.numDays} ימים ב-${context.trip.destination}.

הקשר הטיול:
- סוגי חופשה שנבחרו: ${vacationTypeLabels}
- קצב: ${context.trip.pace}
- מלווים: ${context.trip.hasChildren ? "עם ילדים" : "בלי ילדים"}
- בקשה חופשית מהמשתמש: ${JSON.stringify(context.trip.freeText || null)}

כותרות הימים הקודמים בטיול הזה (אל תחזור על אותה תמה מילולית):
${previousTitlesText}

המשימה שלך: קבע רק אסטרטגיה ברמת-על ליום הזה - **לא** שמות מקומות ספציפיים.
- title: כותרת קצרה וטבעית בעברית (2-4 מילים) שמתארת את אופי היום, שונה מהימים הקודמים.
- attractionsCount: כמה תחנות "אטרקציה" ביום הזה (מספר שלם בין 2 ל-4) - יום קליל/מנוחה יכול לקבל 2, יום עמוס/מלא 4.
- includeSecondFoodStop: true אם ליום הזה מגיעה גם ארוחת צהריים בנוסף לערב, false אם מספיקה ארוחה אחת (יום קליל יותר).
- focusCategories: מערך של מפתח אחד או שניים בדיוק כפי שמופיעים כאן (באנגלית, לא התרגום בסוגריים!) מתוך: ${focusCategoryOptions} - אלה שהיום הזה מתמקד בהם.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"title": "...", "attractionsCount": 3, "includeSecondFoodStop": true, "focusCategories": ["culture"]}`;
}
