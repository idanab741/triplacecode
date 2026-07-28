import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import type { CategoryPlanItem, DayTripAnswers, RestaurantAnswers, StopRole, TripType } from "./types";
import { getTripTypeRules } from "./rules";
import type { TripIntent } from "./tripIntentService";
import { NIGHTLIFE_VENUE_TYPE_TO_CATEGORY } from "@/locales/he/nightlife";

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
      companions: "couple",
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
      companions: "couple",
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
      companions: nightlifeAnswers.companions === "group" || nightlifeAnswers.companions === "friends" ? "friends" : nightlifeAnswers.companions === "solo" ? "solo" : "couple",
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
    const vacationAnswers = answers as import("./types").AbroadVacationAnswers;
    const { VACATION_TYPE_TO_CATEGORY } = require("@/locales/he/abroadVacation");
    const mappedCategories = Array.from(
      new Set(
        vacationAnswers.vacationTypes.map(
          (v: string) => VACATION_TYPE_TO_CATEGORY[v] ?? "attractions_activities"
        )
      )
    ) as string[];
    return {
      companions:
        vacationAnswers.companions === "with_pet"
          ? "solo"
          : (vacationAnswers.companions as DayTripAnswers["companions"]),
      hasPet: vacationAnswers.companions === "with_pet",
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
  return answers as DayTripAnswers;
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
[{"category": "...", "role": "attraction|food|coffee_dessert|viewpoint|bar|spa", "order": 0}, ...]
"category" חייב להיות אחד מתוך הרשימה המלאה: ${ALL_CATEGORY_IDS}.
תחומי העניין שסומנו בתיבות הסימון: ${
    params.answers.interests.filter((i) => i !== "events_festivals").join(", ") || "לא סומן כלום"
  } - אלה עדיפות ראשונית, אך אם המלל החופשי מצביע על קטגוריה אחרת (למשל מזכיר "תצפית" והיא לא סומנה) - תשתמש בקטגוריה שהמלל מבקש, גם אם היא לא ברשימת הסימון.`;

  const { text, error } = await callClaude(prompt);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as { category: string; role: string; order: number }[];

    return parsed.map((item, index) => ({
      category: item.category,
      role: normalizeRole(item.role),
      order: item.order ?? index,
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
import { VACATION_TYPE_TO_CATEGORY, VACATION_PACE_DAILY_COUNTS } from "@/locales/he/abroadVacation";

/** מחשב כמה ימים יש בין שני תאריכים (כולל שני הקצוות). */
function countDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

/**
 * בונה תוכנית קטגוריות מרובת-ימים לחופשה בחו"ל - דטרמיניסטי (בלי AI), לפי
 * קצב הטיול (VACATION_PACE_DAILY_COUNTS) וסוגי החופשה שנבחרו. יום ראשון
 * ואחרון (הגעה/עזיבה) מקבלים כמות מופחתת, בהתאם למסמך האפיון.
 */
export function buildMultiDayVacationPlan(answers: {
  startDate: string;
  endDate: string;
  pace: string;
  vacationTypes: string[];
}): CategoryPlanItem[] {
  const numDays = countDays(answers.startDate, answers.endDate);
  const counts =
    VACATION_PACE_DAILY_COUNTS[answers.pace as keyof typeof VACATION_PACE_DAILY_COUNTS] ??
    VACATION_PACE_DAILY_COUNTS.balanced;

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
    const isEdgeDay = day === 1 || day === numDays;
    // יום הגעה/עזיבה - מחצית מהכמות הרגילה, לפחות תחנה אחת מכל סוג
    const attractionsCount = isEdgeDay ? Math.max(1, Math.floor(counts.attractions / 2)) : counts.attractions;
    const foodCount = isEdgeDay ? Math.max(1, Math.floor(counts.food / 2)) : counts.food;

    for (let i = 0; i < attractionsCount; i++) {
      plan.push({ category: nextCategory(), role: "attraction", order: order++, day });
    }
    for (let i = 0; i < foodCount; i++) {
      plan.push({ category: "wineries_dining", role: "food", order: order++, day });
    }
  }

  return plan;
}