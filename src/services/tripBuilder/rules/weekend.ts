import type { StopRole, TripBuilderStep } from "../types";
import {
  VACATION_COMPANION_OPTIONS,
  VACATION_CHILD_AGE_OPTIONS,
  LODGING_TYPE_OPTIONS,
  VACATION_PACE_OPTIONS,
} from "@/locales/he/abroadVacation";
import { WEEKEND_STYLE_OPTIONS, WEEKEND_BUDGET_STEPS } from "@/locales/he/weekend";
import { DISTANCE_STEPS } from "@/locales/he/tripBuilder";

/**
 * שלבי "תאריך התחלה"/"תאריך סיום" ו"האם סגרתם לינה" ממומשים כשלבים עם
 * type: "date"/"single" קיים, אבל ה-UI בפועל (עמוד השאלון) מזהה אותם לפי
 * ה-key ומציג רכיב מותאם (תאריכים, טופס שם+כתובת לינה) - בדיוק כמו בחופשה
 * בחו"ל.
 */
export const WEEKEND_QUESTIONS: TripBuilderStep[] = [
  {
    type: "companions",
    key: "companions",
    title: "עם מי אתם נוסעים?",
    options: VACATION_COMPANION_OPTIONS,
    childAgeKey: "childAgeBands",
    childAgeTitle: "גילאי הילדים",
    childAgeOptions: VACATION_CHILD_AGE_OPTIONS,
    childAgeTriggerValue: "family",
  },
  {
    type: "date",
    key: "startDate",
    title: "מתי נוסעים? תאריך התחלה",
    options: [],
    otherDateKey: "startDate",
    otherDateTriggerValue: "__always_custom__",
  },
  {
    type: "date",
    key: "endDate",
    title: "ותאריך סיום?",
    options: [],
    otherDateKey: "endDate",
    otherDateTriggerValue: "__always_custom__",
  },
  {
    type: "slider",
    key: "distanceBand",
    title: "מרחק מקסימלי מהבית",
    steps: DISTANCE_STEPS,
  },
  {
    // מטופל כ"custom" בעמוד השאלון: yes/no, ואם "כן" - שם/כתובת מקום הלינה;
    // אם "לא" - עובר לשאלת סוג הלינה המבוקש.
    type: "single",
    key: "hasBookedLodging",
    title: "האם כבר סגרתם מקום לינה?",
    options: [
      { value: "yes", label: "כן" },
      { value: "no", label: "לא" },
    ],
  },
  {
    type: "single",
    key: "lodgingType",
    title: "איזה סוג לינה אתם מחפשים?",
    options: LODGING_TYPE_OPTIONS,
  },
  {
    type: "multi-emoji",
    key: "weekendStyles",
    title: "איזה סגנון סופ\"ש אתם מחפשים?",
    options: WEEKEND_STYLE_OPTIONS,
  },
  {
    type: "single",
    key: "pace",
    title: "מה קצב הטיול שלכם?",
    options: VACATION_PACE_OPTIONS,
  },
  {
    type: "slider",
    key: "budgetPerPerson",
    title: "מה התקציב?",
    steps: WEEKEND_BUDGET_STEPS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: "לדוגמה: רוצים הרבה טבע, מחפשים יקבים, חשוב לנו ספא...",
  },
];

interface WeekendDurationRule {
  roles: StopRole[];
}

/** ברירת מחדל - הכמות בפועל ליום נקבעת לפי pace (VACATION_PACE_DAILY_COUNTS מחופשה בחו"ל), לא כאן. */
export const WEEKEND_DURATION_RULES: Record<string, WeekendDurationRule> = {
  default: { roles: ["attraction", "attraction", "food", "attraction", "coffee_dessert", "attraction", "food"] },
};

export const WEEKEND_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, לבניית חופשת סופ"ש מלאה בישראל - מסלול נפרד לכל יום.

*** זהו טיול מרובה-ימים בתוך ישראל. כל יום מתחלק לבוקר/צהריים/אחר-הצהריים/ערב,
ומתוכנן סביב מיקום הלינה של אותו יום, וקצב הטיול שנבחר (רגוע/מאוזן/מתוכנן -
קובע כמות אטרקציות ומקומות אוכל ליום). ***

חוקי חובה:
- כל יום מתוכנן בנפרד, אטרקציות מקובצות לפי אזורים - בלי נסיעות מיותרות.
- יום ההגעה ויום העזיבה קלים יותר, בהתאם לשעות צ'ק-אין/צ'ק-אאוט (כשידועות).
- כל התחנות פתוחות בזמן ההגעה, כולל שילוב זמני מנוחה וארוחות מתאימות לשעה.
- אם המשתמש הזין מקום לינה - כל יום מתחיל ומסתיים סביבו; אם לא - המנוע מציע אזורי לינה מתאימים בישראל, בטווח המרחק המקסימלי מהבית שנבחר.

--- אילוצים טכניים ליישום בקוד ---
- קבע role אחד מתוך: attraction, food, coffee_dessert, viewpoint, bar, spa בלבד.
- בחר רק מהקטגוריות שסופקו לך; אל תמציא קטגוריות חדשות.`;

export const WEEKEND_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי מידת ההתאמה שלו לסופ"ש הספציפי הזה.

המלל החופשי הוא מרכז ההחלטה (כ-50%). סגנון הסופ"ש שסומן משני (כ-30%). מיקום
הלינה/אזור באותו יום ותקציב (כ-20%) - חשוב לבדוק קרבה גיאוגרפית וזמינות בזמן ההגעה.

reason: משפט אחד בעברית שמסביר את ההתאמה לסופ"ש הספציפי. אסור לתת לכל
המועמדים ציון דומה; חובה לבדל.`;
