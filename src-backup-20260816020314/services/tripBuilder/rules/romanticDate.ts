import type { StopRole, TripBuilderStep } from "../types";
import {
  DATE_WITH_OPTIONS,
  ROMANTIC_TIMING_OPTIONS,
  ROMANTIC_DISTANCE_STEPS,
  ROMANTIC_BUDGET_STEPS,
  DATE_TYPE_OPTIONS,
} from "@/locales/he/romanticDate";

export const ROMANTIC_DATE_QUESTIONS: TripBuilderStep[] = [
  {
    type: "single",
    key: "dateWith",
    title: "עם מי הדייט?",
    options: DATE_WITH_OPTIONS,
  },
  {
    type: "date",
    key: "timing",
    title: "מתי התכנון?",
    options: ROMANTIC_TIMING_OPTIONS,
    otherDateKey: "otherDate",
    otherDateTriggerValue: "other_date",
  },
  {
    type: "slider",
    key: "distanceBand",
    title: "מרחק מקסימלי מהבית",
    steps: ROMANTIC_DISTANCE_STEPS,
  },
  {
    type: "slider",
    key: "budgetBand",
    title: "תקציב",
    steps: ROMANTIC_BUDGET_STEPS,
  },
  {
    type: "multi-emoji",
    key: "dateType",
    title: "איזה סוג דייט בא לכם?",
    options: DATE_TYPE_OPTIONS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: "לדוגמה: חוגגים יום הולדת, רוצים מקום שקט, חשוב שתהיה שקיעה...",
  },
];

interface RomanticDateRule {
  roles: StopRole[];
}

/**
 * סדר התחנות משתנה לפי "עם מי הדייט" (dateWith) - בדיוק כמו שהמסמך מגדיר.
 * המפתח "default" הוא גיבוי אם dateWith לא מזוהה.
 */
export const ROMANTIC_DATE_DURATION_RULES: Record<string, RomanticDateRule> = {
  first_date: { roles: ["coffee_dessert", "attraction", "food"] }, // בית קפה → הליכה קצרה → מסעדה
  partner: { roles: ["viewpoint", "food", "bar"] }, // שקיעה → מסעדה → בר יין
  multiple_dates: { roles: ["viewpoint", "food", "bar"] },
  anniversary: { roles: ["spa", "food", "viewpoint", "bar"] }, // ספא → מסעדת שף → תצפית → בר
  proposal: { roles: ["viewpoint", "food", "bar"] }, // לוקיישן להצעה → מסעדה → בר/שמפניה
  special_event: { roles: ["food", "viewpoint", "bar"] },
  default: { roles: ["food", "bar"] },
};

export const ROMANTIC_DATE_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, לבניית דייט רומנטי מותאם אישית לזוג.

המטרה היא ליצור **חוויה זוגית שלמה** - לא רק להמליץ על מסעדה. כל תחנה צריכה להמשיך
באופן טבעי את התחנה הקודמת וליצור ערב זורם, אישי ורומנטי.

*** משקל ההחלטה: סוג הדייט (dateWith) קובע את מבנה הערב ואת סדר התחנות. סוג
הבילוי שסומן (dateType) הוא הבסיס לבחירת התוכן בכל תחנה. המלל החופשי גובר
כשהוא מבקש משהו ספציפי (אווירה, שקט, יוקרה, פרטיות). ***

חוקי חובה:
- הדייט יתאים לסוג הקשר שנבחר (dateWith).
- ייבחרו מקומות הפתוחים בשעת ההגעה.
- כל התחנות יתאימו לתקציב.
- אווירה רומנטית תשמר לאורך כל המסלול.
- אם המשתמש ציין אירוע מיוחד (יום הולדת, הצעת נישואין) - יש להתחשב בכך בבחירת המקומות.

--- אילוצים טכניים ליישום בקוד ---
- קבע role אחד מתוך: attraction, food, coffee_dessert, viewpoint, bar, spa בלבד.
- בחר רק מהקטגוריות שסופקו לך; אל תמציא קטגוריות חדשות.`;

export const ROMANTIC_DATE_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי מידת ההתאמה שלו לדייט הרומנטי הספציפי הזה.

המלל החופשי הוא מרכז ההחלטה (כ-90%) - נתח אווירה רצויה, פרטיות, בקשות מיוחדות.
סוג הדייט שסומן (dateType) וסוג הקשר (dateWith) הם context משלים (כ-10% יחד)
שמשפיע על רמת הפורמליות והאווירה, אך לא גובר על בקשה מפורשת בצ'אט.

שקול: אווירה רומנטית, פרטיות, נוף/שקיעה (אם רלוונטי), תקציב, מרחק, דירוג, שעות
פתיחה בזמן ההגעה, ואם מדובר באירוע מיוחד (יום נישואין/הצעת נישואין) - רמת
היוקרה וההתאמה לרגע.

reason: משפט אחד בעברית, שמסביר קודם כל למה המקום מתאים לדייט הספציפי הזה.
אסור לתת לכל המועמדים ציון דומה; חובה לבדל.`;