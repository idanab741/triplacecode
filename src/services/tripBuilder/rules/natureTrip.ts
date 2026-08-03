import type { StopRole, TripBuilderStep } from "../types";
import { COMPANION_OPTIONS, CHILD_AGE_OPTIONS, TIMING_OPTIONS, DISTANCE_STEPS, BUDGET_STEPS } from "@/locales/he/tripBuilder";
import { NATURE_TYPE_OPTIONS, DIFFICULTY_OPTIONS, NATURE_DURATION_OPTIONS } from "@/locales/he/natureTrip";

export const NATURE_TRIP_QUESTIONS: TripBuilderStep[] = [
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
    key: "natureTypes",
    title: "איזה סוג טבע אתם מחפשים?",
    options: NATURE_TYPE_OPTIONS,
  },
  {
    type: "single",
    key: "difficulty",
    title: "מה רמת הקושי?",
    options: DIFFICULTY_OPTIONS,
  },
  {
    // מטופל כ-custom בעמוד השאלון: אם נבחר "custom" - נפתח שדה טקסט חופשי
    // (customDuration) לתיאור הזמן הרצוי, במקום להמשיך ישר לשאלה הבאה.
    type: "single",
    key: "durationBand",
    title: "כמה זמן הטיול?",
    options: NATURE_DURATION_OPTIONS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: "לדוגמה: חייבים מים לשחייה, רוצים מסלול מוצל, מחפשים פנינה נסתרת...",
  },
];

interface DurationRule {
  roles: StopRole[];
}

/**
 * חוקי בניית המסלול לפי משך הטיול, לפי המפרט המדויק:
 * שעה-שעתיים: מסלול טבע מרכזי אחד + נקודת עניין נוספת (אם אפשר) + קפה.
 * חצי יום: 2 אטרקציות טבע + מקום אוכל אחד + עצירת תצפית/מעיין אם אפשר.
 * יום שלם: 3-4 אטרקציות טבע + 2 מקומות אוכל + שילוב תצפיות/מעיינות.
 * custom (זמן מותאם אישית): ברירת מחדל סבירה - Claude מחליט לפי התיאור החופשי.
 * המערך כאן = ברירת מחדל לפולבאק הדטרמיניסטי בלבד; הטווח המלא מועבר ל-Claude.
 */
export const NATURE_TRIP_DURATION_RULES: Record<string, DurationRule> = {
  "1-2h": { roles: ["attraction", "coffee_dessert"] },
  half_day: { roles: ["attraction", "attraction", "food"] },
  full_day: { roles: ["attraction", "attraction", "attraction", "food", "food"] },
  custom: { roles: ["attraction", "attraction", "food", "coffee_dessert"] },
};

/** מרחק מקסימלי (ק"מ) בין תחנה לתחנה העוקבת לה - לא מהבית. */
export const NATURE_TRIP_MAX_STOP_DISTANCE_KM: Record<string, number> = {
  "1-2h": 3,
  half_day: 15,
  full_day: 30,
  custom: 15,
};

export const NATURE_TRIP_PLAN_PROMPT_RULES = `אתה מנוע תכנון הטיולים של TRIPLACE, מתמחה בטיולי טבע.

התפקיד שלך הוא לתכנן יום טבע שלם - מסלולי הליכה, מעיינות, נחלים, תצפיות, יערות,
שמורות טבע, חופים ואתרי טבע נוספים - שמרגיש כאילו מדריך טיולים מקצועי ומכיר
היטב את האזור בנה אותו באופן אישי, לא רשימת אתרים גנרית.

נתח את כל השיחה: המלל החופשי, התשובות הסגורות (כולל רמת הקושי שנבחרה!), פרופיל
המשתמש, הרכב המטיילים, גיל הילדים, בעלי חיים, ומזג האוויר/עונה.

רמת הקושי שנבחרה (קל/בינוני/מאתגר) קריטית: "קל" - בלי עליות/ירידות תלולות,
מסלולים קצרים ומישוריים, מתאים לעגלות אם יש ילדים קטנים; "מאתגר" - מסלולי הליכה
משמעותיים, טיפוסים, אתגר פיזי אמיתי. אל תתעלם מרמת הקושי לטובת "האתר הכי יפה" -
אתר מדהים שדורש טיפוס תלול לא מתאים למי שביקש "קל".

אם המלל החופשי מזכיר העדפות ספציפיות (מים לשחייה, פריחה, זריחה/שקיעה, פנינה
נסתרת, מסלול מעגלי, צל, שקט) - אלה משמעותיים ביותר, לא הערות נלוות.

משך הטיול קובע את מספר התחנות **כברירת מחדל בלבד**:
שעה-שעתיים – בדרך כלל מסלול טבע מרכזי אחד + נקודת עניין נוספת + קפה.
חצי יום – 2 אטרקציות טבע + מקום אוכל אחד.
יום שלם – 3-4 אטרקציות טבע + 2 מקומות אוכל.

*** חובה - חריגה מהברירת מחדל: אם המלל החופשי מפרט במפורש יותר שלבים/תחנות
נפרדים מהכמות המשוערת למשך שנבחר - יש לכבד את הבקשה המפורטת, לא לצמצם אותה
לכמות ברירת המחדל. המלל החופשי גובר. ***

אין להוסיף תחנות כדי למלא את היום - עדיף פחות תחנות ברמת קושי נכונה מאשר הרבה
תחנות שלא מתאימות לרמת הכושר/גיל המטיילים.

חובה - גיוון: אם המלל החופשי מתאר שני שלבים שונים במפורש - הקטגוריות שתבחר
להם חייבות להיות שונות באופיין, לא שתי קטגוריות זהות ברצף.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
[{"category": "...", "role": "attraction|food|coffee_dessert|viewpoint", "order": 0}, ...]`;

export const NATURE_TRIP_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי מידת ההתאמה שלו לטיול הטבע הספציפי הזה.

המלל החופשי הוא מרכז ההחלטה. רמת הקושי שנבחרה (קל/בינוני/מאתגר) חייבת להישמר
בקפדנות - אל תדרג גבוה מסלול שלא מתאים לרמת הקושי המבוקשת.

reason: משפט אחד בעברית שמסביר את ההתאמה. אסור לתת לכל המועמדים ציון דומה.`;
