import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CategoryPlanItem, DayTripAnswers, StopRole, TripType } from "./types";
import { getTripTypeRules } from "./rules";

interface DecideCategoryPlanParams {
  tripType: TripType;
  dna: TravelDna | null;
  answers: DayTripAnswers;
  weatherSummary: string | null;
}

/** קובע את רשימת הקטגוריות/תפקידים למסלול - קריאת Claude אחת, עם fallback דטרמיניסטי. */
export async function decideCategoryPlan(params: DecideCategoryPlanParams): Promise<CategoryPlanItem[]> {
  const rules = getTripTypeRules(params.tripType);

  const aiPlan = await tryClaudePlan(params, rules.planPromptRules);
  if (aiPlan && aiPlan.length > 0) return aiPlan;

  return buildFallbackPlan(params.answers, rules.durationRules);
}

async function tryClaudePlan(
  params: DecideCategoryPlanParams,
  planPromptRules: string
): Promise<CategoryPlanItem[] | null> {
  const prompt = `${planPromptRules}

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
[{"category": "...", "role": "attraction|food|coffee_dessert|viewpoint", "order": 0}, ...]
כאשר "category" הוא אחד מהערכים: ${
    params.answers.interests.filter((i) => i !== "events_festivals").join(", ") ||
    "nature_trails, wineries_dining"
  }.`;

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
  if (role === "food" || role === "coffee_dessert" || role === "viewpoint") return role;
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
    const category = interests[attractionCursor % interests.length];
    attractionCursor += 1;
    return { category, role, order };
  });
}
