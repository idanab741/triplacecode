import type { StopRole, TripBuilderStep } from "../types";
import {
  VACATION_COMPANION_OPTIONS,
  VACATION_CHILD_AGE_OPTIONS,
  LODGING_TYPE_OPTIONS,
  VACATION_BUDGET_STEPS,
  VACATION_TYPE_OPTIONS,
  VACATION_PACE_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
} from "@/locales/he/abroadVacation";

/**
 * שלבי "תאריך יציאה"/"תאריך חזרה", "האם הוזמן טיסה ומלון", "איפה החופשה
 * הבאה שלכם" - ממומשים כשלבים עם type: "single"/"date" קיים, אבל ה-UI
 * בפועל (עמוד השאלון) יזהה אותם לפי ה-key ויציג רכיב מותאם (תאריכים,
 * טופס טיסה+מלון חוזר, autocomplete יעדים) - לא נדרש להרחיב את מערכת
 * ה-TripBuilderStep הכללית ולסכן שבירה של שאר השאלונים.
 */
export const ABROAD_VACATION_QUESTIONS: TripBuilderStep[] = [
  {
    type: "date",
    key: "startDate",
    title: "מתי יוצאים? תאריך יציאה",
    options: [],
    otherDateKey: "startDate",
    otherDateTriggerValue: "__always_custom__",
  },
  {
    type: "date",
    key: "endDate",
    title: "ותאריך חזרה?",
    options: [],
    otherDateKey: "endDate",
    otherDateTriggerValue: "__always_custom__",
  },
  {
    type: "single",
    key: "travelStyle",
    title: "איך תרצו לטייל?",
    options: TRAVEL_STYLE_OPTIONS,
  },
  {
    // מטופל כ-custom בעמוד השאלון: אם travelStyle הוא single_destination -
    // autocomplete יעד יחיד מתוך טבלת destinations + כפתור "תפתיעו אותי"
    // (surpriseMe: true, destination: null). אחרת - רשימת יעדים דינמית
    // (destinations: string[]) עם כפתור "הוסיפו יעד" בלי הגבלה.
    type: "text",
    key: "destination",
    title: "איפה החופשה הבאה שלכם?",
    placeholder: "לדוגמה: ברצלונה, איטליה, יעד לא מוכר...",
  },
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
    // מטופל כ"custom" בעמוד השאלון: yes/no, ואם "כן" - טופס טיסה+מלון
    // חוזר (אפשר להוסיף עוד טיסה/מלון); אם "לא" - עובר לשאלת "עד כמה
    // תתפשרו על הטיסה" (תוספת מכוונת, לא קיימת במסמך המקורי) ואז לינה.
    type: "single",
    key: "hasBookedFlightAndHotel",
    title: "האם כבר הזמנתם טיסה ומלון?",
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
    type: "slider",
    key: "budgetPerPerson",
    title: "תקציב ליחיד",
    steps: VACATION_BUDGET_STEPS,
  },
  {
    type: "multi-emoji",
    key: "vacationTypes",
    title: "איזה סוג חופשה אתם מחפשים?",
    options: VACATION_TYPE_OPTIONS,
  },
  {
    type: "single",
    key: "pace",
    title: "מה קצב הטיול שלכם?",
    options: VACATION_PACE_OPTIONS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: "לדוגמה: ירח דבש, חשוב לנו ים, יעד פחות תיירותי...",
  },
];

interface VacationDurationRule {
  roles: StopRole[];
}

/** ברירת מחדל - הכמות בפועל ליום נקבעת לפי pace (ר' VACATION_PACE_DAILY_COUNTS), לא כאן. */
export const ABROAD_VACATION_DURATION_RULES: Record<string, VacationDurationRule> = {
  default: { roles: ["attraction", "attraction", "food", "attraction", "coffee_dessert", "attraction", "food"] },
};

export const ABROAD_VACATION_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, לבניית חופשה מלאה בחו"ל - מסלול נפרד לכל יום.

*** זהו טיול מרובה-ימים. כל יום מתחלק לבוקר/צהריים/אחר-הצהריים/ערב, ומתוכנן
סביב מיקום המלון של אותו יום, שעות הטיסה (ביום ההגעה/העזיבה), וקצב הטיול
שנבחר (רגוע/מאוזן/מתוכנן - קובע כמות אטרקציות ומקומות אוכל ליום). ***

חוקי חובה:
- כל יום מתוכנן בנפרד, אטרקציות מקובצות לפי אזורים - בלי נסיעות מיותרות.
- יום ההגעה ויום העזיבה קלים יותר, בהתאם לשעות הטיסה.
- כל התחנות פתוחות בזמן ההגעה, כולל שילוב זמני מנוחה וארוחות מתאימות לשעה.
- אם המשתמש הזין מלון - כל יום מתחיל ומסתיים סביבו; אם לא - המנוע מציע אזורי לינה מתאימים.

--- אילוצים טכניים ליישום בקוד ---
- קבע role אחד מתוך: attraction, food, coffee_dessert, viewpoint, bar, spa בלבד.
- בחר רק מהקטגוריות שסופקו לך; אל תמציא קטגוריות חדשות.`;

export const ABROAD_VACATION_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי מידת ההתאמה שלו לחופשה הספציפית הזו.

המלל החופשי הוא מרכז ההחלטה (כ-90%, בהתאם לכלל העליון של המערכת). סוג החופשה
שסומן, מיקום המלון/אזור באותו יום ותקציב הם context משלים (כ-10% יחד) - חשוב לבדוק
קרבה גיאוגרפית וזמינות בזמן ההגעה, אך לעולם לא על חשבון בקשה מפורשת בצ'אט.

reason: משפט אחד בעברית שמסביר את ההתאמה לחופשה הספציפית. אסור לתת לכל
המועמדים ציון דומה; חובה לבדל.`;