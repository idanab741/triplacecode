import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getVacationTypeLabel, VACATION_PACE_DAILY_COUNTS } from "@/locales/he/abroadVacation";
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

    // תיקון באג אמיתי (בקשה מפורשת - "יותר מידי מסעדות ביחס לכמות
    // אטרקציות! צריך 2 מסעדות ביום! האטרקציות צריכות להיות מסודרות לפי
    // אופי הטיול (רגוע/מאוזן/מתוכנן), למה זה לא מאופיין פה??"):
    // VACATION_PACE_DAILY_COUNTS כבר קיים בקוד בדיוק בשביל זה (מוגדר
    // עם attractions/food לכל pace) - אבל מעולם לא יובא/נעשה בו שימוש
    // בשום מקום בקוד (בדקתי - רק הערות שמפנות אליו). Claude קיבל את ה-
    // pace רק כמשפט הקשר בפרומפט, בלי שום אכיפה אמיתית - attractionsCount
    // ו-includeSecondFoodStop יצאו בפועל כמעט אקראיים, לא תלויים בקצב
    // שנבחר. עכשיו האכיפה דטרמיניסטית ולא תלויה בניחוש של Claude:
    // attractionsCount נגזר ישירות מה-pace, ו-includeSecondFoodStop=true
    // אך ורק אם ה-pace מבקש 2+ ארוחות (food:2 ל-relaxed/balanced -
    // בדיוק "2 מסעדות ביום" שביקשת; אין עדיין תמיכה בשלישית ל-packed,
    // so זה עדיין מוגבל ל-1/2, לא 3).
    const paceCounts = VACATION_PACE_DAILY_COUNTS[context.trip.pace as keyof typeof VACATION_PACE_DAILY_COUNTS] ?? VACATION_PACE_DAILY_COUNTS.balanced;

    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      attractionsCount: clampAttractionsCount(paceCounts.attractions),
      includeSecondFoodStop: paceCounts.food >= 2,
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

/** תבנית קבועה - fallback בטוח כשקריאת Claude נכשלת/עוברת timeout.
 *  attractionsCount/includeSecondFoodStop נגזרים מ-pace (ר' ההערה
 *  למעלה על VACATION_PACE_DAILY_COUNTS) - לא קבועים, גם כאן. */
function fallbackBlueprint(context: VacationContext): DayBlueprint {
  const paceCounts = VACATION_PACE_DAILY_COUNTS[context.trip.pace as keyof typeof VACATION_PACE_DAILY_COUNTS] ?? VACATION_PACE_DAILY_COUNTS.balanced;
  return {
    title: `יום בילויים ב${context.trip.destination}`,
    attractionsCount: clampAttractionsCount(paceCounts.attractions),
    includeSecondFoodStop: paceCounts.food >= 2,
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

  return `אתה מדריך טיולים מקומי מומחה ב-${context.trip.destination}, לא רק "ממלא תבנית". זהו יום ${dayNumber} מתוך חופשה בת ${context.trip.numDays} ימים.

הקשר הטיול:
- סוגי חופשה שנבחרו: ${vacationTypeLabels}
- קצב: ${context.trip.pace}
- מלווים: ${context.trip.companionsLabel}${context.trip.hasChildren ? " (עם ילדים)" : ""}
- בקשה חופשית מהמשתמש (המקור החשוב ביותר לאופי הטיול - קרא אותה בעיון!): ${JSON.stringify(context.trip.freeText || null)}

בקשה מפורשת - הבקשה החופשית חייבת לעצב את היום הזה בפועל, לא רק להישמר
כרקע. תחשוב כמו מדריך טיולים מקומי אמיתי שמכיר את ${context.trip.destination}
ומקבל בקשה כזו ממטייל: מה היית ממליץ לו לעשות ביום הזה, בהתחשב בדיוק
במה שהוא ביקש? דוגמאות קונקרטיות (לא רשימה סגורה - תרגם כל הקשר דומה
לפי אותו היגיון):
- "חופשה רומנטית עם בן/בת הזוג" -> העדף חוויות זוגיות אינטימיות: נקודות
  תצפית לשקיעה, מסעדות עם אווירה, הליכות רומנטיות - לא אתרים המוניים/רועשים.
- "מסיבת רווקים/רווקות לחבר/ה" -> העדף חיי לילה, ברים, אנרגיה חברתית -
  לא מוזיאונים שקטים או אתרים תרבותיים כבדים.
- "טיול עם ילדים קטנים" -> העדף פארקים, אתרים אינטראקטיביים, קרוב ומהיר -
  לא מוזיאונים ארוכים או הליכות מתישות.
- "בטן גב"/"לנוח"/"בלי לרוץ" -> יום קליל בהרבה, פחות תחנות, יותר זמן
  חופשי בין דבר לדבר - לא יום עמוס ומתוכנן לדקה.
אם הבקשה החופשית לא נותנת רמז ברור לאופי היום - פשוט המשך לפי הקטגוריות
שנבחרו כרגיל, בלי לאלץ פרשנות.

כותרות הימים הקודמים בטיול הזה (אל תחזור על אותה תמה מילולית):
${previousTitlesText}

המשימה שלך: קבע רק אסטרטגיה ברמת-על ליום הזה - **לא** שמות מקומות ספציפיים.
- title: כותרת קצרה וטבעית בעברית (2-4 מילים) שמתארת את אופי היום, שונה מהימים הקודמים, ומשקפת את הבקשה החופשית אם היא רלוונטית.
- attractionsCount: כמה תחנות "אטרקציה" ביום הזה (מספר שלם בין 2 ל-4) - יום קליל/מנוחה יכול לקבל 2, יום עמוס/מלא 4.
- includeSecondFoodStop: true אם ליום הזה מגיעה גם ארוחת צהריים בנוסף לערב, false אם מספיקה ארוחה אחת (יום קליל יותר).
- focusCategories: מערך של מפתח אחד או שניים בדיוק כפי שמופיעים כאן (באנגלית, לא התרגום בסוגריים!) מתוך: ${focusCategoryOptions} - אלה שהיום הזה מתמקד בהם, בהתאם לאופי שנקבע למעלה.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"title": "...", "attractionsCount": 3, "includeSecondFoodStop": true, "focusCategories": ["culture"]}`;
}
