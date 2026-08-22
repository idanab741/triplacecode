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
    // תיקון פער אמיתי קריטי (Audit מול MASTER SPEC סעיפים 3-4, בקשה
    // מפורשת - "מסלול הוצף במסעדות בלי בקשה קולינרית"): הבאג האמיתי -
    // VACATION_PACE_DAILY_COUNTS נותן food:2 בכל שלושת ה-pace (relaxed,
    // balanced) ו-food:3 (packed) - כלומר `paceCounts.food >= 2` יצא
    // **true בכל מקרה**, ללא שום קשר לכוונה קולינרית. כל יום, בכל pace,
    // תמיד קיבל 2 ארוחות מתוכננות. עכשיו: ארוחה שנייה (מעבר ל-dinner
    // הבסיסי) רק אם culinary נבחר במפורש כסגנון (Explicit Intent אמיתי -
    // לא ניחוש מטקסט חופשי, שעלול לטעות).
    const isCulinaryFocused = context.trip.vacationTypes.includes("culinary");
    const paceCounts = VACATION_PACE_DAILY_COUNTS[context.trip.pace as keyof typeof VACATION_PACE_DAILY_COUNTS] ?? VACATION_PACE_DAILY_COUNTS.balanced;

    // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 3/9 - "Companion Fit
    // צריך להשפיע בפועל על Pace/Activities, לא רק להיות המלצה ל-AI"):
    // ילד 0-3 = פחות מעברים/עצירות הוא Hard Constraint לפי המפרט, לא
    // המלצה רכה - אוכף אותו בקוד (תקרה של 3 אטרקציות ביום, גם אם ה-pace
    // שנבחר "packed"/"balanced" היה נותן יותר), לא רק מבקש בנימוס מ-AI.
    const attractionsCap = context.trip.childAgeBands.includes("0-3") ? 3 : Infinity;

    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      attractionsCount: Math.min(clampAttractionsCount(paceCounts.attractions), attractionsCap),
      includeSecondFoodStop: isCulinaryFocused && paceCounts.food >= 2,
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
 *  attractionsCount/includeSecondFoodStop נגזרים מ-pace+culinary-intent
 *  (ר' ההערה למעלה על VACATION_PACE_DAILY_COUNTS) - לא קבועים, גם כאן. */
function fallbackBlueprint(context: VacationContext): DayBlueprint {
  const isCulinaryFocused = context.trip.vacationTypes.includes("culinary");
  const paceCounts = VACATION_PACE_DAILY_COUNTS[context.trip.pace as keyof typeof VACATION_PACE_DAILY_COUNTS] ?? VACATION_PACE_DAILY_COUNTS.balanced;
  const attractionsCap = context.trip.childAgeBands.includes("0-3") ? 3 : Infinity;
  return {
    title: `יום בילויים ב${context.trip.destination}`,
    attractionsCount: Math.min(clampAttractionsCount(paceCounts.attractions), attractionsCap),
    includeSecondFoodStop: isCulinaryFocused && paceCounts.food >= 2,
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

  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 3/8 - "Companion Fit
  // צריך להשפיע על Day Blueprint/Pace, לא רק לדעת ש'יש ילדים'"): גיל
  // ילדים ספציפי משנה לגמרי מה מתאים - 0-3 (עגלה, הליכות קצרות, פחות
  // מעברים) שונה בתכלית מ-12-18 (כמעט הכל מתאים, כולל אקסטרים קל).
  const childGuidance =
    context.trip.childAgeBands.length === 0
      ? ""
      : context.trip.childAgeBands.includes("0-3")
        ? "\n- חשוב: יש ילד/ה בגיל 0-3 - העדף הליכות קצרות, מקומות נגישים לעגלה, פחות מעברים בין תחנות, ולא פעילות אקסטרים/הליכה מתישה."
        : context.trip.childAgeBands.includes("3-7")
          ? "\n- יש ילד/ה בגיל 3-7 - מתאים: פארקים, חיות, פעילויות אינטראקטיביות, טבע קצר - לא הליכות ארוכות/מוזיאונים כבדים."
          : "";

  return `אתה מדריך טיולים מקומי מומחה ב-${context.trip.destination}, לא רק "ממלא תבנית". זהו יום ${dayNumber} מתוך חופשה בת ${context.trip.numDays} ימים.

הקשר הטיול:
- סוגי חופשה שנבחרו: ${vacationTypeLabels}
- קצב: ${context.trip.pace}
- מלווים: ${context.trip.companionsLabel}${context.trip.hasChildren ? " (עם ילדים)" : ""}${childGuidance}
${context.live.weatherSummary ? `- מזג אוויר צפוי: ${context.live.weatherSummary} - אם יש גשם/חום קיצוני, העדף focusCategories מתאימות (indoor/culture/food בגשם; טבע בבוקר ומקומות מוצלים/עם מים בחום) - בלי לשנות את אופי הטיול שהמשתמש ביקש, רק את הבחירה בתוכו.\n` : ""}- בקשה חופשית מהמשתמש (המקור החשוב ביותר לאופי הטיול - קרא אותה בעיון!): ${JSON.stringify(context.trip.freeText || null)}

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

חשוב - בקשה מפורשת גוברת תמיד על העדפה כללית: אם המשתמש כתב במפורש
שהוא לא רוצה משהו (למשל "בלי חיי לילה"), אל תכלול אותו ב-focusCategories
גם אם זה נבחר כ-style כללי בשאלון - הבקשה הנקודתית של הטיול הזה גוברת.

כותרות הימים הקודמים בטיול הזה (אל תחזור על אותה תמה מילולית):
${previousTitlesText}

המשימה שלך: קבע רק את אופי/אסטרטגיית היום - **לא** שמות מקומות ספציפיים
ולא מספרים (כמות תחנות/ארוחות כבר נקבעת בקוד לפי הקצב שנבחר, לא כאן).
- title: כותרת קצרה וטבעית בעברית (2-4 מילים) שמתארת את אופי היום, שונה מהימים הקודמים, ומשקפת את הבקשה החופשית אם היא רלוונטית.
- focusCategories: מערך של מפתח אחד או שניים בדיוק כפי שמופיעים כאן (באנגלית, לא התרגום בסוגריים!) מתוך: ${focusCategoryOptions} - אלה שהיום הזה מתמקד בהם, בהתאם לאופי שנקבע למעלה.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"title": "...", "focusCategories": ["culture"]}`;
}
