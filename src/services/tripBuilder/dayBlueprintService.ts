import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getVacationTypeLabel } from "@/locales/he/abroadVacation";
import { hasInfantAgeBand } from "./types";
import type { DayBlueprint, VacationContext } from "./types";
import type { TripStrategy } from "./tripStrategyService";

/** בקשה מפורשת - 5 שניות: אם קריאת ה-AI ליום מסוים לא חוזרת בזמן הזה,
 *  נופלים לתבנית הקבועה הדטרמיניסטית (ר' fallbackBlueprint למטה) - לא
 *  תוקעים את הבנייה של כל שאר הטיול בשביל יום אחד. */
const BLUEPRINT_TIMEOUT_MS = 5000;

/**
 * תיקון ארכיטקטוני (Audit מול "בחן מחדש את כל מנגנון בניית המסלול" -
 * "14. לבנות Day Missions"): זהו ה-Day Mission של הפייפ��ין - קריאת ה-AI
 * המרכזית לכל יום "רגיל" (לא יום 1, לא יום אחרון - אלה דטרמיניסטיים
 * לגמרי, בלי AI). "כמות" (attractionsCount/restaurantStopsCount) **אינה
 * מחושבת כאן יותר** - היא מגיעה מוכנה מ-TripStrategy (tripStrategyService.ts,
 * מחושב פעם אחת לכל הטיול, לא בכל יום מחדש). הפונקציה הזו קובעת **רק**
 * את אופי/נושא היום (title, focusCategories) - Day Mission טהור, בלי
 * שום חישוב קיבולת בתוכה. זה ההבדל בין "עוד תיקון לניקוד" לבין שינוי
 * סדר אמיתי: המספרים כבר קבועים לפני שהיום הזה בכלל מתוכנן.
 */
export async function generateDayBlueprint(
  context: VacationContext,
  strategy: TripStrategy,
  dayNumber: number,
  previousDayTitles: string[]
): Promise<DayBlueprint> {
  const fallback = fallbackBlueprint(context, strategy);

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

    // ה-AI קובע כאן אך ורק title/focusCategories (אופי היום) - הכמות
    // (attractionsCount/restaurantStopsCount) מגיעה במלואה מ-TripStrategy,
    // שכבר חושבה פעם אחת לכל הטיול (לא מנוחשת מחדש, ולא ניתנת לשינוי
    // ע"י Claude פר-יום - זה בדיוק מה שמנע עקביות בין ימים לפני התיקון).
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      attractionsCount: strategy.activityDensity,
      restaurantStopsCount: strategy.maxFoodStopsPerDay,
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

/** תבנית קבועה - fallback בטוח כשקריאת Claude נכשלת/עוברת timeout.
 *  attractionsCount/restaurantStopsCount מגיעים במלואם מ-TripStrategy -
 *  אותם מספרים בדיוק שהיו מתקבלים גם אם ה-AI כן היה עונה בזמן, כי
 *  ה-AI לא קובע אותם יותר (ר' generateDayBlueprint למעלה). */
function fallbackBlueprint(context: VacationContext, strategy: TripStrategy): DayBlueprint {
  return {
    title: `יום בילויים ב${context.trip.destination}`,
    attractionsCount: strategy.activityDensity,
    restaurantStopsCount: strategy.maxFoodStopsPerDay,
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
      : hasInfantAgeBand(context.trip.childAgeBands)
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
