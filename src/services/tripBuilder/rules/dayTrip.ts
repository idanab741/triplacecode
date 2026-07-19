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

/**
 * חוקי בניית המסלול לפי משך הטיול - לפי המפרט המדויק:
 * 1-2 שעות: אטרקציה אחת (או אטרקציה + קפה). ללא מסעדה.
 * 2-4 שעות: 1-2 אטרקציות + עצירת קפה/אוכל קליל אחת.
 * 4-6 שעות: 2-3 אטרקציות + מקום אוכל אחד בלבד + קפה/קינוח/תצפית.
 * יום שלם: 3-4 אטרקציות + 1-2 מקומות אוכל + קפה + תצפית/סיום.
 * המערך כאן = אמצע הטווח (משמש את הפולבאק הדטרמיניסטי בלבד);
 * הטווח המלא מועבר ל-Claude בפרומפט והוא מחליט בתוכו לפי ההעדפות.
 */
export const DAY_TRIP_DURATION_RULES: Record<DurationBand, DurationRule> = {
  "1-2h": { roles: ["attraction", "coffee_dessert"] },
  "2-4h": { roles: ["attraction", "attraction", "coffee_dessert"] },
  "4-6h": { roles: ["attraction", "attraction", "food", "attraction", "coffee_dessert"] },
  full_day: {
    roles: ["attraction", "attraction", "food", "attraction", "coffee_dessert", "attraction", "coffee_dessert"],
  },
  custom: { roles: ["attraction", "attraction", "food", "coffee_dessert"] },
};

export const DAY_TRIP_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, בונה "טיול יומי" (Day Trip).
המטרה אינה רשימת מקומות, אלא יום שלם, זורם ומותאם אישית.

חוקי הרכב לפי משך (חובה, אסור לחרוג):
- 1-2 שעות: אטרקציה אחת בלבד, או אטרקציה + עצירת קפה. ללא מסעדה.
- 2-4 שעות: 1-2 אטרקציות + עצירת קפה או אוכל קליל אחת. לא יותר.
- 4-6 שעות: 2-3 אטרקציות + מקום אוכל אחד בלבד + עצירת קפה/קינוח/תצפית אחת.
- יום שלם: 3-4 אטרקציות + 1-2 מקומות אוכל + עצירת קפה + תצפית/נקודת סיום.

חוקי סדר יום:
- ארוחה כבדה (food) רק בשעות הגיוניות (צהריים/ערב) ביחס לשעת היציאה - לא בתחילת בוקר.
- קפה (coffee_dessert) בתחילת יום או אחרי ארוחה; קינוח/תצפית לקראת הסוף.
- הימנע משתי תחנות זהות ברצף, אלא אם המשתמש ביקש זאת במפורש.

חוקי התאמה למשתמש:
- תחומי העניין שנבחרו קובעים את סוגי האטרקציות; גוון ביניהם ואל תחזור על אותו סוג פעמיים, אלא אם נבחר תחום אחד בלבד.
- משפחה עם ילדים: התאם לגילאים (0-3 נגיש ורגוע; 3-7 אינטראקטיבי; 7-12 פעיל; 12-18 מאתגר). ללא חיי לילה/יקבים.
- כבד את התקציב שנבחר; אל תחרוג ממנו.
- המלל החופשי של המשתמש גובר על כל ברירת מחדל.

אילוצים:
- קבע את התפקיד (role) של כל תחנה: attraction / food / coffee_dessert.
- אל תיצור תחנה מקטגוריה "events_festivals" - אירועים ופסטיבלים תלויי-תאריך ומוצגים בנפרד כהמלצה משלימה בסוף המסלול, לא כתחנה מוחלקת.
- בחר רק מהקטגוריות שסופקו; אל תמציא.`;

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

export const DAY_TRIP_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי התאמה אישית אמיתית למשתמש הזה:
- התאמה לתחומי העניין שבחר: המשקל הגדול ביותר.
- התאמה להרכב המטיילים (זוג/משפחה+גילאים/חברים/לבד/בעל חיים): משקל גבוה. עם ילדים או בעל חיים - העדף מקומות שהתיאור/תגיות מרמזים שמתאימים (אין נתון מובנה).
- מרחק מהנקודה הנוכחית: קרוב עדיף, אך התאמה חזקה מנצחת מרחק.
- מחיר מול התקציב שנותר: חריגה = ציון נמוך.
- דירוג גוגל וכמות ביקורות: משקל משני.
- התאמה למלל החופשי: אם רלוונטי, גובר על הכל.
- reason: משפט אחד בעברית, ספציפי למקום ולמשתמש - לא נימוק גנרי.
אסור לתת לכל המועמדים ציון דומה; חובה לבדל בין מקומות לפי ההעדפות.`;