import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import type { CategoryPlanItem, DayBlueprint, DayTripAnswers, RestaurantAnswers, StopRole, TripType } from "./types";
import { getTripTypeRules } from "./rules";
import type { TripIntent } from "./tripIntentService";
import { NIGHTLIFE_VENUE_TYPE_TO_CATEGORY } from "@/locales/he/nightlife";
import { getDifficultyLabel } from "@/locales/he/natureTrip";
import { VACATION_TYPE_TO_CATEGORY } from "@/locales/he/abroadVacation";

const ALL_CATEGORY_IDS = TRIP_TYPE_GROUPS.map((g) => g.id).join(", ");

interface DecideCategoryPlanParams {
  tripType: TripType;
  dna: TravelDna | null;
  answers: DayTripAnswers | RestaurantAnswers | import("./types").RomanticDateAnswers | import("./types").NightlifeAnswers;
  weatherSummary: string | null;
  tripIntent?: TripIntent | null;
}

/**
 * ממיר תשובות מכל סוג טיול לצורה אחידה (כמו DayTripAnswers) - כדי ש-tryClaudePlan
 * ו-buildFallbackPlan יוכלו להישאר בלי שינוי, לא משנה מאיזה שאלון הגיעו התשובות.
 */
export function normalizeAnswers(
  tripType: TripType,
  answers: DayTripAnswers | RestaurantAnswers | import("./types").RomanticDateAnswers | import("./types").NightlifeAnswers
): DayTripAnswers {
  if (tripType === "restaurants_cafes") {
    const restaurantAnswers = answers as RestaurantAnswers;
    return {
      ...restaurantAnswers,
      companions: ["couple"],
      hasPet: false,
      childAgeBands: [],
      interests: restaurantAnswers.cuisine,
      durationBand: "default" as DayTripAnswers["durationBand"],
    };
  }
if (tripType === "romantic_date") {
    const dateAnswers = answers as import("./types").RomanticDateAnswers;
    return {
      ...dateAnswers,
      companions: ["couple"],
      hasPet: false,
      childAgeBands: [],
      interests: dateAnswers.dateType,
      durationBand: "default" as DayTripAnswers["durationBand"],
    };
  }
if (tripType === "nightlife") {
    const nightlifeAnswers = answers as import("./types").NightlifeAnswers;
    const mappedCategories = Array.from(
      new Set(
        nightlifeAnswers.venueTypes.map(
          (v: string) => NIGHTLIFE_VENUE_TYPE_TO_CATEGORY[v] ?? "attractions_activities"
        )
      )
    ) as string[];
    return {
      companions: [nightlifeAnswers.companions === "group" || nightlifeAnswers.companions === "friends" ? "friends" : nightlifeAnswers.companions === "solo" ? "solo" : "couple"],
      hasPet: false,
      childAgeBands: [],
      timing: nightlifeAnswers.timing,
      otherDate: nightlifeAnswers.otherDate,
      distanceBand: nightlifeAnswers.distanceBand,
      budgetBand: nightlifeAnswers.budgetBand,
      interests: mappedCategories,
      durationBand: "default" as DayTripAnswers["durationBand"],
      freeText: nightlifeAnswers.freeText,
    };
  }
  if (tripType === "abroad_vacation") {
    const vacationAnswers = answers as unknown as import("./types").AbroadVacationAnswers;
    const mappedCategories = Array.from(
      new Set(
        vacationAnswers.vacationTypes.map(
          (v: string) => VACATION_TYPE_TO_CATEGORY[v] ?? "attractions_activities"
        )
      )
    ) as string[];
    const vacationHasPet = vacationAnswers.companions.includes("with_pet");
    return {
      companions: (vacationHasPet
        ? vacationAnswers.companions.filter((c) => c !== "with_pet")
        : vacationAnswers.companions) as DayTripAnswers["companions"],
      hasPet: vacationHasPet,
      childAgeBands: vacationAnswers.childAgeBands,
      timing: "other_date" as DayTripAnswers["timing"],
      otherDate: vacationAnswers.startDate || null,
      distanceBand: "5h" as DayTripAnswers["distanceBand"],
      budgetBand: "unlimited" as DayTripAnswers["budgetBand"],
      interests: mappedCategories.length > 0 ? mappedCategories : ["attractions_activities"],
      durationBand: "default" as DayTripAnswers["durationBand"],
      freeText: vacationAnswers.freeText,
    };
  }
  if (tripType === "weekend") {
    const weekendAnswers = answers as unknown as import("./types").WeekendAnswers;
    const mappedCategories = Array.from(
      new Set(
        weekendAnswers.weekendStyles.map(
          (v: string) => VACATION_TYPE_TO_CATEGORY[v] ?? "attractions_activities"
        )
      )
    ) as string[];
    const weekendHasPet = weekendAnswers.companions.includes("with_pet");
    return {
      companions: (weekendHasPet
        ? weekendAnswers.companions.filter((c) => c !== "with_pet")
        : weekendAnswers.companions) as DayTripAnswers["companions"],
      hasPet: weekendHasPet,
      childAgeBands: weekendAnswers.childAgeBands,
      timing: "other_date" as DayTripAnswers["timing"],
      otherDate: weekendAnswers.startDate || null,
      distanceBand: weekendAnswers.distanceBand,
      budgetBand: "unlimited" as DayTripAnswers["budgetBand"],
      interests: mappedCategories.length > 0 ? mappedCategories : ["attractions_activities"],
      durationBand: "default" as DayTripAnswers["durationBand"],
      freeText: weekendAnswers.freeText,
    };
  }
  if (tripType === "nature_trip") {
    const natureAnswers = answers as unknown as import("./types").NatureTripAnswers;
    // רמת הקושי לא קיימת ב-DayTripAnswers - משלבים אותה לתוך freeText כדי
    // ש-tryClaudePlan (שקורא רק את שדה freeText הכללי) עדיין "יראה" אותה.
    const difficultyNote = `רמת קושי מבוקשת: ${getDifficultyLabel(natureAnswers.difficulty)}.`;
    const combinedFreeText = natureAnswers.freeText
      ? `${difficultyNote} ${natureAnswers.freeText}`
      : difficultyNote;
    return {
      companions: natureAnswers.companions,
      hasPet: natureAnswers.hasPet,
      childAgeBands: natureAnswers.childAgeBands,
      timing: natureAnswers.timing,
      otherDate: natureAnswers.otherDate,
      distanceBand: natureAnswers.distanceBand,
      budgetBand: natureAnswers.budgetBand,
      interests: natureAnswers.natureTypes,
      durationBand:
        natureAnswers.durationBand === "custom"
          ? ("half_day" as DayTripAnswers["durationBand"])
          : (natureAnswers.durationBand as DayTripAnswers["durationBand"]),
      freeText: combinedFreeText,
    };
  }
  return answers as DayTripAnswers;
}

/**
 * סופרת כמה פעמים כל role מופיע במערך התפקידים של durationRules - אלה
 * המספרים ה"רשמיים" של הטיול (למשל 1-2 שעות בטיול יומי = בדיוק attraction
 * אחת + coffee_dessert אחד, לא שתיים). משמשות כתקרה קשיחה על תוכנית ה-AI.
 */
function roleCountsFromDurationRoles(roles: StopRole[]): Partial<Record<StopRole, number>> {
  const counts: Partial<Record<StopRole, number>> = {};
  for (const role of roles) {
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}

/**
 * אוכפת בקוד (לא רק בפרומפט) שתוכנית ה-AI לא תחרוג ממספר התחנות המותר לכל
 * role, לפי durationBand הנוכחי - אחרת Claude יכול "לסטות" ולהחזיר, למשל,
 * שתי תחנות coffee_dessert (שתי עגלות קפה) במקום attraction אחת + קפה אחד.
 * אם Claude הציע פחות מהמותר זה נשאר כפי שהוא (עדיף פחות תחנות איכותיות
 * מלמלא בכוח תחנה לא מתאימה).
 */
function capPlanByDurationRules(
  plan: CategoryPlanItem[],
  durationRules: Record<string, { roles: StopRole[] }>,
  durationBand: string
): CategoryPlanItem[] {
  const durationRoles = durationRules[durationBand]?.roles ?? durationRules.full_day?.roles ?? [];
  const maxByRole = roleCountsFromDurationRoles(durationRoles);

  let result = plan;
  for (const role of Object.keys(maxByRole) as StopRole[]) {
    result = capRoleCount(result, role, maxByRole[role]!);
  }
  return result;
}

/** קובע את רשימת הקטגוריות/תפקידים למסלול - קריאת Claude אחת, עם fallback דטרמיניסטי. */
export async function decideCategoryPlan(params: DecideCategoryPlanParams): Promise<CategoryPlanItem[]> {
  const rules = getTripTypeRules(params.tripType);
  const normalizedAnswers = normalizeAnswers(params.tripType, params.answers);
  const normalizedParams = { ...params, answers: normalizedAnswers };

  const aiPlan = await tryClaudePlan(normalizedParams, rules.planPromptRules);
  if (aiPlan && aiPlan.length > 0) {
    // אכיפה קשיחה בקוד (לא רק הנחיה בפרומפט): לכל היותר תחנת attraction אחת
    // בחיי לילה - כי Claude לפעמים "סוטה" מההנחיה הטקסטואלית בפרומפט.
    if (params.tripType === "nightlife") {
      return capRoleCount(aiPlan, "attraction", 1);
    }
    // כלל ברזל לטיול יומי ולטיול בטבע - תקרה על **כל** role (לא רק
    // attraction), לפי המספרים שכבר מוגדרים ב-durationRules. זה מונע מצב
    // שבו Claude מחזיר, למשל, שתי תחנות coffee_dessert (שתי עגלות קפה)
    // ברצף במקום attraction אחת + קפה אחד.
    if (params.tripType === "day_trip" || params.tripType === "nature_trip") {
      return capPlanByDurationRules(aiPlan, rules.durationRules, normalizedAnswers.durationBand);
    }
    return aiPlan;
  }

  return buildFallbackPlan(normalizedAnswers, rules.durationRules);
}

/** משאיר לכל היותר `max` תחנות מתפקיד נתון, לפי הסדר המקורי (order), ומסיר את השאר. */
function capRoleCount(plan: CategoryPlanItem[], role: StopRole, max: number): CategoryPlanItem[] {
  let count = 0;
  return plan
    .filter((item) => {
      if (item.role !== role) return true;
      count += 1;
      return count <= max;
    })
    .map((item, index) => ({ ...item, order: index }));
}

async function tryClaudePlan(
  params: Omit<DecideCategoryPlanParams, "answers"> & { answers: DayTripAnswers },
  planPromptRules: string
): Promise<CategoryPlanItem[] | null> {
const prompt = `${planPromptRules}

*** מסמך כוונת הטיול (Trip Intent) - זה כבר סיכם עבורך את הבנת המשתמש, השתמש בו כבסיס
העיקרי להחלטה, לא תתחיל לנתח מחדש: ***
${JSON.stringify(params.tripIntent ?? { note: "לא זמין - נתח את המלל החופשי ישירות" })}

Travel DNA:
${JSON.stringify(describeDna(params.dna))}

תשובות המשתמש בשאלון:
${JSON.stringify({
  companions: params.answers.companions,
  childAgeBands: params.answers.childAgeBands,
  timing: params.answers.timing,
  distanceBand: params.answers.distanceBand,
  budgetBand: params.answers.budgetBand,
  interests: params.answers.interests.map(getCategoryLabel),
  durationBand: params.answers.durationBand,
  freeText: params.answers.freeText || null,
})}

מזג אוויר: ${JSON.stringify(params.weatherSummary)}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף לפני או אחרי:
[{"category": "...", "role": "attraction|food|coffee_dessert|viewpoint|bar|spa", "order": 0, "note": "..."}, ...]
"category" חייב להיות אחד מתוך הרשימה המלאה: ${ALL_CATEGORY_IDS}.
"note" - **חובה מוחלטת** למלא בכל תחנה שהמלל החופשי נותן לה אפילו פרט אחד קטן
מעבר לקטגוריה הכללית (סוג מקום ספציפי, אווירה, למי זה מיועד, מה להימנע ממנו).
אל תשאיר note ריק "כברירת מחדל" - זו טעות נפוצה שגורמת לשלב הבא לאבד בדיוק את
הפרטים שהמשתמש טרח לפרט. תיאור קצר בעברית של **בדיוק** מה התחנה הזו אמורה
להיות, לפי המלל החופשי. דוגמה מלאה: אם המלל אומר "עגלת קפה בטבע, ואז רחוב
מסחרי ראשי לקניות" - 3 תחנות, כל אחת עם note משלה:
- תחנה 1 (coffee_dessert): note="עגלת קפה ממש (רוכלות/דוכן נייד), לא בית קפה
  יושב - חייבת להיות בתוך שטח ירוק/פארק/סביבה טבעית, לא ברחוב עירוני"
- תחנה 2 (attraction, category=shopping): note="רחוב מסחרי **ראשי** ומוכר
  בעיר עם הרבה חנויות/תנועה - לא שוק, לא קניון סגור, לא רחוב צדדי שקט"
- תחנה 3 (attraction, category=shopping): note="קניות בפועל - חנות/מרכז
  קניות אמיתי שאפשר לקנות בו דברים, לא סתם עוד רחוב לטייל בו"
רק אם ממש אין שום פרט מעבר לקטגוריה - מותר להשאיר note ריק.
תחומי העניין שסומנו בתיבות הסימון: ${
    params.answers.interests.filter((i) => i !== "events_festivals").join(", ") || "לא סומן כלום"
  } - אלה הבסיס לתכנון. סטייה מהם מותרת **רק** אם המלל החופשי מזכיר **במפורש
ובבירור** קטגוריה אחרת (למשל ממש כתוב "תצפית"/"ים"/"שוק" וכו') - לא מספיק
"קשר תמאטי" עמום או ניחוש שקטגוריה "מתאימה יפה" לשילוב. בלי אזכור מפורש
כזה - נשארים אך ורק בתוך הקטגוריות שסומנו, גם אם נראה שקטגוריה אחרת "הייתה
מתאימה". זה קריטי - הוספת קטגוריה לא-מבוקשת (כמו חוף ים בטיול שלא ביקש ים)
היא טעות, לא "העשרה".

*** חובה - סדר התחנות: אם המלל החופשי מתאר רצף כרונולוגי מפורש (למשל "קודם
קפה, אחר כך טיול קצר, ואז אטרקציה, ולבסוף קניון") - סדר ה-JSON חייב לשקף
בדיוק את אותו רצף (שדה order תואם לסדר שהמשתמש ביקש), לא סדר שרירותי. כל
תחנה בתפקיד (role) שמתאים באמת למה שהמשתמש ביקש באותו שלב - למשל "קפה בבוקר
בטבע" צריך role="coffee_dessert" עם category שמתאימה לסביבה טבעית/פארק, לא
בית קפה עירוני רגיל. "קניון/רחוב מרכזי בסוף" - role="attraction" עם
category="shopping", ממוקם אחרון ברשימה.

חובה - גיוון: אם המלל החופשי מתאר שני שלבים שונים במפורש (למשל "מסלול הליכה"
ובנפרד "אטרקציה") - הקטגוריות שתבחר להם חייבות להיות שונות באופיין, לא שתי
קטגוריות מאותו סוג ברצף (למשל nature_trails פעמיים) - זה יגרום לשתי תחנות
שמרגישות זהות במקום שני חלקים שונים ומשלימים של היום. ***`;

  const { text, error } = await callClaude(prompt);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as { category: string; role: string; order: number; note?: string }[];

    return parsed.map((item, index) => ({
      category: item.category,
      role: normalizeRole(item.role),
      order: item.order ?? index,
      note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined,
    }));
  } catch (parseError) {
    logAiError("כשל בפענוח תשובת JSON מ-Claude בתכנון קטגוריות", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return null;
  }
}

function normalizeRole(role: string): StopRole {
  if (role === "food" || role === "coffee_dessert" || role === "viewpoint" || role === "bar" || role === "spa") return role;
  return "attraction";
}

function describeDna(dna: TravelDna | null) {
  if (!dna) {
    return { note: "אין עדיין מידע על המשתמש" };
  }
  return {
    interests: dna.interests.map(getCategoryLabel),
    preferred_categories_from_behavior: dna.preferred_categories.map(getCategoryLabel),
    kosher: dna.kosher,
    accessibility: dna.accessibility,
  };
}

/** תוכנית גיבוי דטרמיניסטית, ללא AI - מרחיבה את חוקי משך הטיול לפי תחומי העניין שנבחרו. */
const FREE_TEXT_SMALL_HINTS = ["קטן", "קצר", "לא רחוק", "פשוט", "שקט", "רגוע", "לא הרבה"];
const FREE_TEXT_CATEGORY_HINTS: Record<string, string[]> = {
  nature_trails: ["טבע", "ירוק", "שביל", "יער", "הרים", "מעיין", "נחל"],
  beaches_pools: ["חוף", "ים", "בריכה"],
  coffee_carts_cafes: ["קפה", "בית קפה"],
};

function buildFallbackPlan(
  answers: DayTripAnswers,
  durationRules: Record<string, { roles: StopRole[] }>
): CategoryPlanItem[] {
  const freeText = (answers.freeText || "").toLowerCase();
  const wantsSmall = FREE_TEXT_SMALL_HINTS.some((hint) => freeText.includes(hint));

  let rule = durationRules[answers.durationBand] ?? durationRules["2-4h"];
  // מלל חופשי שמרמז על טיול קטן/שקט - מצמצם את מספר התחנות בפועל,
  // גם אם נבחר משך זמן ארוך יותר, כדי לכבד את מה שהמשתמש כתב במפורש
  if (wantsSmall && rule.roles.length > 3) {
    rule = { roles: rule.roles.slice(0, 3) };
  }

  // אירועים/פסטיבלים תלויי-תאריך מוצגים כהמלצה משלימה בסוף, לא כתחנה מוחלקת
  const attractionInterests = answers.interests.filter((i) => i !== "events_festivals");
  let interests = attractionInterests.length > 0 ? attractionInterests : ["attractions_activities"];

  // אם המלל החופשי מזכיר קטגוריה ספציפית מתוך מה שכבר נבחר - מקדמים אותה
  // לראש התור, כדי שהיא תופיע קודם בתחנות האטרקציה
  for (const [category, hints] of Object.entries(FREE_TEXT_CATEGORY_HINTS)) {
    if (interests.includes(category) && hints.some((hint) => freeText.includes(hint))) {
      interests = [category, ...interests.filter((i) => i !== category)];
      break;
    }
  }

  const foodCategory = "wineries_dining";
const coffeeCategory = "coffee_carts_cafes";

let attractionCursor = 0;
  return rule.roles.map((role, order) => {
    if (role === "food") return { category: foodCategory, role, order };
    if (role === "coffee_dessert") return { category: coffeeCategory, role, order };
    if (role === "bar") return { category: "wineries_dining", role, order };
    if (role === "spa") return { category: "spa_relaxation", role, order };
    const category = interests[attractionCursor % interests.length];
    attractionCursor += 1;
    return { category, role, order };
  });
}

export interface DecideNextStopParams {
  dna: TravelDna | null;
  answers: DayTripAnswers;
  usedCategories: string[];
}

/** קובעת קטגוריה+תפקיד לתחנה בודדת נוספת, בזמן ריצה (זרימת החלקות דינמית). */
export async function decideNextStop(params: DecideNextStopParams): Promise<{ category: string; role: StopRole }> {
  const prompt = `אתה מנוע ה-AI של TRIPLACE. המשתמש כבר אישר כמה תחנות בטיול, וביקש להוסיף עוד תחנה אחת.

מלל חופשי מהמשתמש: ${JSON.stringify(params.answers.freeText || null)}
תחומי עניין שסומנו: ${params.answers.interests.filter((i) => i !== "events_festivals").join(", ") || "לא סומן"}
קטגוריות שכבר נכנסו למסלול (אסור לחזור עליהן!): ${params.usedCategories.join(", ") || "אין"}

*** חוק חובה: אסור בהחלט להציע קטגוריה שכבר מופיעה ברשימת "קטגוריות שכבר נכנסו למסלול" למעלה,
גם אם היא הכי מתאימה למלל החופשי. חובה לבחור קטגוריה שונה, גם אם היא פחות מושלמת.
היוצא מן הכלל היחיד: אם ממש כל הקטגוריות הרלוונטיות כבר נוצלו, רק אז מותר לחזור.

קבע קטגוריה אחת נוספת שתתאים הכי טוב מבין אלה שעדיין לא נוצלו. אם יש מלל חופשי משמעותי -
התבסס עליו בעיקר (כ-90% מההחלטה) כדי לבחור **מבין הקטגוריות הפנויות**.
אם אין מלל חופשי משמעותי, בחר מתוך תחומי העניין שסומנו שעדיין לא נוצלו. ***

השב אך ורק במבנה JSON: {"category": "...", "role": "attraction|food|coffee_dessert|viewpoint"}`;

  const { text, error } = await callClaude(prompt);
  if (!error && text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { category: string; role: string };
        return { category: parsed.category, role: normalizeRole(parsed.role) };
      }
    } catch (parseError) {
      logAiError("כשל בפענוח תשובת JSON מ-Claude בתחנה דינמית", {
        message: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }
  }

  // פולבאק: תחום עניין שעוד לא נוצל, אחרת הראשון ברשימה
  const interests = params.answers.interests.filter((i) => i !== "events_festivals");
  const pool = interests.length > 0 ? interests : ["attractions_activities"];
  const notUsed = pool.find((c) => !params.usedCategories.includes(c));
  return { category: notUsed ?? pool[0], role: "attraction" };
}

/**
 * מחשב כמה ימים יש בין שני תאריכים (כולל שני הקצוות).
 *
 * תיקון: מאז שנוספה האפשרות "אין לי עוד תאריך" בשאלון, startDate/endDate
 * יכולים להגיע כמחרוזת ריקה (או תאריך לא תקין). `new Date("")` מחזיר
 * Invalid Date, וכל החישוב (Math.round על NaN, +1) היה מחזיר NaN בשקט -
 * ואז `for (day=1; day<=NaN; ...)` פשוט לא רץ אף פעם אחת, כך שהתוכנית
 * יצאה ריקה לגמרי (0 slots) בלי שום הודעת שגיאה, עד שהמסלול נכשל
 * בוולידציה עם "המסלול שנבנה ריק". כשאין תאריך בכלל, נופלים לברירת מחדל
 * סבירה לחופשה (5 ימים) במקום להשאיר את המשתמש בלי מסלול.
 */
export function countDays(startDate: string, endDate: string): number {
  const DEFAULT_TRIP_DAYS = 5;
  if (!startDate || !endDate) return DEFAULT_TRIP_DAYS;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return DEFAULT_TRIP_DAYS;

  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  if (Number.isNaN(days)) return DEFAULT_TRIP_DAYS;
  return Math.max(1, days);
}

/**
 * בונה תוכנית קטגוריות מרובת-ימים לחופשה בחו"ל - דטרמיניסטי (בלי AI).
 * בקשה מפורשת: תבנית קבועה לכל יום "רגיל" (לא תלויה בקצב שנבחר יותר) -
 * ר' ההערה בלולאה למטה. יום ראשון הוא מקרה קבוע ונפרד לגמרי; יום אחרון
 * (אם הוא לא גם הראשון) הוא בדיוק ארוחת בוקר + אטרקציה אחת, לא נוסחה
 * יחסית לקצב.
 */
export function buildMultiDayVacationPlan(answers: {
  startDate: string;
  endDate: string;
  pace: string;
  vacationTypes: string[];
  /** ברירת מחדל "abroad_vacation" - סופ"ש ממשיך עם הדפוס הישן ליום 1
   *  (attraction+food), כי אין לו כרטיס שכונה מרכזית/שדה תעופה בעמוד
   *  התוצאה שלו. נשאר אופציונלי כדי לא לשבור קריאות קיימות. */
  tripType?: "abroad_vacation" | "weekend";
}): CategoryPlanItem[] {
  const numDays = countDays(answers.startDate, answers.endDate);

  const categoryPool =
    answers.vacationTypes.length > 0
      ? answers.vacationTypes.map((t) => VACATION_TYPE_TO_CATEGORY[t] ?? "attractions_activities")
      : ["attractions_activities"];

  const plan: CategoryPlanItem[] = [];
  let order = 0;
  let categoryCursor = 0;

  function nextCategory(): string {
    const category = categoryPool[categoryCursor % categoryPool.length];
    categoryCursor += 1;
    return category;
  }

  for (let day = 1; day <= numDays; day++) {
    const isLastDay = day === numDays;

    if (day === 1 && answers.tripType !== "weekend") {
      // יום הגעה בחופשה בחו"ל - בקשה מפורשת: בלי attraction מהמאגר בכלל.
      // "השכונה המרכזית" היא כרטיס תצוגה מלאכותי (findCentralNeighborhood +
      // injectLogisticsStops בעמוד התוצאה), לא תחנת place - בדיוק כמו
      // שדה התעופה ושורת המלון. נשארת רק ארוחת ערב אחת, שבהמשך
      // (auto-build/route.ts) תחפש ברדיוס עד 1 ק"מ מהשכונה המרכזית -
      // לא מהמלון ולא ממרכז היעד הכללי.
      //
      // בקשה מפורשת (סעיף 34 במסמך, "Nightlife אינו חייב להיות בכל
      // ערב"): בלי חיי לילה ביום ההגעה בכלל, גם אם סומן - אחרי טיסה
      // ויום נחיתה, לא בונים ערב יציאה. חיי לילה מופיע בימים ה"רגילים"
      // שבין ההגעה לעזיבה, לא בקצוות.
      plan.push({ category: "wineries_dining", role: "food", order: order++, day });
      continue;
    }

    if (day === 1) {
      // סופ"ש - דפוס ישן ללא שינוי (יש לו attraction אמיתי מהמאגר ביום 1).
      // גם כאן בלי חיי לילה ביום ההגעה, מאותה סיבה בדיוק.
      plan.push({ category: nextCategory(), role: "attraction", order: order++, day });
      plan.push({ category: "wineries_dining", role: "food", order: order++, day });
      continue;
    }

    if (isLastDay) {
      // יום עזיבה - בקשה מפורשת ומדויקת ("לא להתפזר" + "אטרקציה קלילה
      // ולא מורכבת מידי, כמו סיבוב בשדרה המרכזית"): בדיוק ארוחת בוקר
      // (בית קפה) + אטרקציה אחת קלילה - לא מהקטגוריות הרגילות שנבחרו
      // בשאלון (nextCategory) שיכולות להחזיר מוזיאון גדול/פארק אתגר.
      // parks_gardens/viewpoints/shopping הן קטגוריות "קלות" מטבען -
      // הליכה, לא מסלול מאומץ. אחרי זה - רק צ'ק-אאוט מהמלון וטיסת חזרה
      // (כרטיסי תצוגה מלאכותיים, לא תחנות place - ר' injectLogisticsStops).
      plan.push({ category: "coffee_carts_cafes", role: "coffee_dessert", order: order++, day });
      plan.push({ category: "parks_gardens", role: "attraction", order: order++, day });
      continue;
    }

    // בקשה מפורשת (Context Engine + Vacation Blueprint) - ימים "רגילים"
    // (לא 1, לא אחרון) לא נבנים כאן בכלל יותר. הם נבנים דינמית בתוך
    // auto-build/route.ts: קריאת generateDayBlueprint (AI, אסטרטגיה
    // ברמת-על בלבד) ואז categoryPlanForDay (למטה, קוד דטרמיניסטי) הופכת
    // אותה לרשימת slots בפועל, ליום הזה בלבד, ברגע שמגיעים אליו - לא
    // מראש לכל הטיול. כך יש שמירה הדרגתית אמיתית יום-אחרי-יום, לא רק
    // "יום 1 ואז הכל".
  }

  return plan;
}

/**
 * הופכת DayBlueprint (אסטרטגיה ברמת-על מ-generateDayBlueprint - כותרת,
 * עוצמה, קטגוריות מיקוד) לרשימת slots בפועל ליום "רגיל" אחד. הסדר עצמו
 * נשאר קוד דטרמיניסטי לגמרי (קפה תמיד ראשון, מסעדות במקום הנכון, חיי
 * לילה תמיד אחרון) - רק ה*תוכן* (כמה אטרקציות, אילו קטגוריות, אם יש
 * ארוחת צהריים) מגיע מה-Blueprint. בדיוק לפי ההחלטה: AI קובע אסטרטגיה,
 * לא בוחר מקומות (זה עדיין fetchCandidatePool/rankCandidatesFast).
 */
export function categoryPlanForDay(
  blueprint: DayBlueprint,
  day: number,
  startOrder: number,
  includesNightlife: boolean
): CategoryPlanItem[] {
  const plan: CategoryPlanItem[] = [];
  let order = startOrder;

  const focusCategoryPool =
    blueprint.focusCategories.length > 0
      ? blueprint.focusCategories.map((t) => VACATION_TYPE_TO_CATEGORY[t] ?? "attractions_activities")
      : ["attractions_activities"];
  let focusCursor = 0;
  function nextFocusCategory(): string {
    const category = focusCategoryPool[focusCursor % focusCategoryPool.length];
    focusCursor += 1;
    return category;
  }

  // בוקר - קפה תמיד ראשון, בלי קשר לעוצמה שה-Blueprint בחר (בקשה
  // מפורשת קודמת, לא תלויה ביום "קליל"/"עמוס").
  plan.push({ category: "coffee_carts_cafes", role: "coffee_dessert", order: order++, day });

  const attractionsCount = Math.max(1, blueprint.attractionsCount);
  if (blueprint.includeSecondFoodStop) {
    // ארוחת צהריים באמצע - חצי מהאטרקציות לפניה, חצי אחריה, עד לערב.
    const beforeLunch = Math.ceil(attractionsCount / 2);
    const afterLunch = attractionsCount - beforeLunch;
    for (let i = 0; i < beforeLunch; i++) {
      plan.push({ category: nextFocusCategory(), role: "attraction", order: order++, day });
    }
    plan.push({ category: "wineries_dining", role: "food", order: order++, day });
    for (let i = 0; i < afterLunch; i++) {
      plan.push({ category: nextFocusCategory(), role: "attraction", order: order++, day });
    }
    plan.push({ category: "wineries_dining", role: "food", order: order++, day });
  } else {
    // יום קליל יותר - כל האטרקציות לפני ארוחת ערב אחת יחידה.
    for (let i = 0; i < attractionsCount; i++) {
      plan.push({ category: nextFocusCategory(), role: "attraction", order: order++, day });
    }
    plan.push({ category: "wineries_dining", role: "food", order: order++, day });
  }

  if (includesNightlife) {
    plan.push({ category: "nightlife", role: "nightlife", order: order++, day });
  }

  return plan;
}