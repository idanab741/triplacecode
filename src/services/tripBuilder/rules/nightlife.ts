import type { StopRole, TripBuilderStep } from "../types";
import {
  NIGHTLIFE_COMPANION_OPTIONS,
  NIGHTLIFE_GROUP_SIZE_OPTIONS,
  NIGHTLIFE_TIMING_OPTIONS,
  NIGHTLIFE_DISTANCE_STEPS,
  NIGHTLIFE_BUDGET_STEPS,
  NIGHTLIFE_VENUE_TYPE_OPTIONS,
} from "@/locales/he/nightlife";

export const NIGHTLIFE_QUESTIONS: TripBuilderStep[] = [
  {
    type: "companions",
    key: "companions",
    title: "עם מי אתם יוצאים?",
    options: NIGHTLIFE_COMPANION_OPTIONS,
    // "קבוצה" מפעילה שאלת המשך על גודל הקבוצה - נטפל בזה בעמוד ה-UI בנפרד,
    // כי זה לא "גילאי ילדים" אלא שאלת המשך אחרת לגמרי
    childAgeKey: "groupSize",
    childAgeTitle: "כמה אנשים אתם?",
    childAgeOptions: NIGHTLIFE_GROUP_SIZE_OPTIONS,
    childAgeTriggerValue: "group",
  },
  {
    type: "date",
    key: "timing",
    title: "מתי יוצאים?",
    options: NIGHTLIFE_TIMING_OPTIONS,
    otherDateKey: "otherDate",
    otherDateTriggerValue: "other_date",
  },
  {
    type: "slider",
    key: "distanceBand",
    title: "מרחק מקסימלי לנסיעה",
    steps: NIGHTLIFE_DISTANCE_STEPS,
  },
  {
    type: "slider",
    key: "budgetBand",
    title: "תקציב",
    steps: NIGHTLIFE_BUDGET_STEPS,
  },
  {
    type: "multi-emoji",
    key: "venueTypes",
    title: "איזה בילוי בא לכם?",
    options: NIGHTLIFE_VENUE_TYPE_OPTIONS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: "לדוגמה: רוצים לרקוד, מחפשים Happy Hour, בלי תור בכניסה...",
  },
];

interface NightlifeRule {
  roles: StopRole[];
}

/**
 * "סוג הבילוי" (venue types) קובע את התוכן, אבל מבנה הערב (roles) קבוע יחסית
 * לפי אורך הבילוי. המפתח "default" הוא הגיבוי הראשי - האורך בפועל נגזר
 * מהמלל החופשי/הקשר, לא משאלת משתמש נפרדת, בדיוק כמו במסעדות.
 */
export const NIGHTLIFE_DURATION_RULES: Record<string, NightlifeRule> = {
  short: { roles: ["bar"] }, // בילוי קצר - מקום בילוי מרכזי אחד
  regular: { roles: ["bar", "attraction"] }, // ערב רגיל - 2 תחנות
  full: { roles: ["food", "bar", "attraction"] }, // ערב מלא - 3-4 תחנות
  default: { roles: ["food", "bar", "attraction"] },
};

export const NIGHTLIFE_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, לבניית ערב בילוי מותאם אישית (חיי לילה ובילויים).

המטרה היא ליצור **ערב זורם ומהנה** - לא רק רשימת מקומות. כל תחנה ממשיכה
באופן הגיוני את התחנה הקודמת (למשל: מסעדה → בר → מועדון).

*** משקל ההחלטה: סוג הבילוי שסומן (venueTypes, שכבר הומר לקטגוריות מתאימות)
הוא הבסיס. המלל החופשי גובר כשהוא מבקש משהו ספציפי (Happy Hour, לרקוד, שקט,
בלי תור). גודל הקבוצה (groupSize) משפיע על התאמת המקום לקיבולת. ***

חוקי חובה:
- כל המקומות פתוחים בזמן ההגעה.
- כל התחנות בתקציב.
- המסלול מתאים לגודל הקבוצה ולהרכב המשתתפים.
- הימנע ממקומות שלא מתאימים לאופי הבילוי שנבחר.

--- אילוצים טכניים ליישום בקוד ---
- קבע role אחד מתוך: attraction, food, coffee_dessert, viewpoint, bar, spa בלבד.
- בחר רק מהקטגוריות שסופקו לך; אל תמציא קטגוריות חדשות.`;

export const NIGHTLIFE_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי מידת ההתאמה שלו לערב הבילוי הספציפי הזה.

המלל החופשי הוא מרכז ההחלטה (כ-90%) - נתח אווירה רצויה (רגועה/תוססת/יוקרתית/
אינטימית/מסיבה), Happy Hour, מוזיקה, ריקודים. סוג הבילוי שסומן, גודל הקבוצה והרכב
המשתתפים הם context משלים (כ-10% יחד) - חשוב שהמקום יכול להכיל את הקבוצה.

שקול: אווירה, תקציב, מרחק, דירוג, שעות פעילות בזמן ההגעה, קיבולת מול גודל
הקבוצה, מוזיקה/DJ אם רלוונטי.

reason: משפט אחד בעברית, שמסביר קודם כל למה המקום מתאים לבילוי הספציפי הזה.
אסור לתת לכל המועמדים ציון דומה; חובה לבדל.`;