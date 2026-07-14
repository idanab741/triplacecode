import type { TripBuilderStep, DurationBand, StopRole } from "../types";
import {
  COMPANION_OPTIONS,
  CHILD_AGE_OPTIONS,
  TIMING_OPTIONS,
  DISTANCE_STEPS,
  BUDGET_STEPS,
  DAY_TRIP_INTEREST_OPTIONS,
  DURATION_OPTIONS,
} from "@/locales/he/tripBuilder";

export const DAY_TRIP_QUESTIONS: TripBuilderStep[] = [
  {
    type: "companions",
    key: "companions",
    title: "עם מי אתם נוסעים?",
    options: COMPANION_OPTIONS,
    childAgeKey: "childAgeBands",
    childAgeTitle: "גילאי הילדים",
    childAgeOptions: CHILD_AGE_OPTIONS,
    childAgeTriggerValue: "family",
  },
  {
    type: "date",
    key: "timing",
    title: "מתי יוצאים?",
    options: TIMING_OPTIONS,
    otherDateKey: "otherDate",
    otherDateTriggerValue: "other_date",
  },
  {
    type: "slider",
    key: "distanceBand",
    title: "מרחק מקסימלי מהבית",
    steps: DISTANCE_STEPS,
  },
  {
    type: "slider",
    key: "budgetBand",
    title: "תקציב",
    steps: BUDGET_STEPS,
  },
  {
    type: "multi-emoji",
    key: "interests",
    title: "מה בא לכם לעשות?",
    options: DAY_TRIP_INTEREST_OPTIONS,
  },
  {
    type: "single",
    key: "durationBand",
    title: "כמה זמן הטיול?",
    options: DURATION_OPTIONS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: 'לדוגמה: לא אוהבים ללכת הרבה, רוצים לראות שקיעה...',
  },
];

interface DurationRule {
  roles: StopRole[];
}

/** חוקי בניית המסלול לפי משך הטיול (שלב 3 במסמך האפיון). */
export const DAY_TRIP_DURATION_RULES: Record<DurationBand, DurationRule> = {
  "1-2h": { roles: ["attraction", "food"] },
  "2-4h": { roles: ["attraction", "attraction", "food"] },
  "4-6h": { roles: ["attraction", "attraction", "food", "coffee_dessert"] },
  full_day: { roles: ["coffee_dessert", "attraction", "attraction", "food", "attraction", "coffee_dessert"] },
  custom: { roles: ["attraction", "attraction", "food"] },
};

export const DAY_TRIP_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, בונה "טיול יומי" (Day Trip).
המטרה אינה רשימת מקומות, אלא בניית יום שלם, זורם ומותאם אישית.

קבע את סדר הקטגוריות (לא קבוע - תלוי במה שהמשתמש ביקש) ואת התפקיד (role) של כל תחנה: attraction (אטרקציה מרכזית), food (ארוחה), coffee_dessert (קפה/קינוח/תצפית).
התחשב במשך הטיול, בשעת היציאה, בתקציב, בתחומי העניין, בהרכב המטיילים ובמלל החופשי.
הימנע ממספר תחנות זהות ברצף אלא אם המשתמש ביקש זאת.`;

const BUDGET_BAND_MAX_PRICE_LEVEL: Record<string, number | null> = {
  "0-100": 1,
  "100-300": 2,
  "300-600": 3,
  "600-1000": 4,
  unlimited: null,
};

/** ממיר בחירת תקציב ל-price_level מקסימלי (סקאלת גוגל 0-4), ל-null אם "ללא הגבלה". */
export function dayTripBudgetToMaxPriceLevel(budgetBand: string): number | null {
  return BUDGET_BAND_MAX_PRICE_LEVEL[budgetBand] ?? null;
}

export const DAY_TRIP_RANKING_PROMPT_RULES = `דרג את המועמדים הבאים לתחנה הנוכחית בטיול יומי.
התבסס על: התאמה לפרופיל/תחומי העניין של המשתמש, מרחק מהנקודה הנוכחית, מחיר מול התקציב שנותר, דירוג/פופולריות, והתאמה למלל החופשי.
אם המשתמש מטייל עם ילדים או בעל חיים, העדף מקומות שהתיאור שלהם מרמז שהם מתאימים (מהתיאור/תגיות בלבד - אין נתון מובנה לכך).
כתוב נימוק קצר (משפט אחד בעברית) לכל מועמד.`;
