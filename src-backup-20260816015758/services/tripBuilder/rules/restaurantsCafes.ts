import type { StopRole, TripBuilderStep } from "../types";
import {
  RESTAURANT_COMPANION_OPTIONS,
  RESTAURANT_CHILD_AGE_OPTIONS,
  RESTAURANT_TIMING_OPTIONS,
  RESTAURANT_DISTANCE_STEPS,
  RESTAURANT_BUDGET_STEPS,
  CUISINE_OPTIONS,
} from "@/locales/he/restaurantsCafes";

export const RESTAURANTS_CAFES_QUESTIONS: TripBuilderStep[] = [
  {
    type: "companions",
    key: "companions",
    title: "עם מי יוצאים?",
    options: RESTAURANT_COMPANION_OPTIONS,
    childAgeKey: "childAgeBands",
    childAgeTitle: "גילאי הילדים",
    childAgeOptions: RESTAURANT_CHILD_AGE_OPTIONS,
    childAgeTriggerValue: "family",
  },
  {
    type: "date",
    key: "timing",
    title: "מתי יוצאים?",
    options: RESTAURANT_TIMING_OPTIONS,
    otherDateKey: "otherDate",
    otherDateTriggerValue: "other_date",
  },
  {
    type: "slider",
    key: "distanceBand",
    title: "מרחק מקסימלי מהבית",
    steps: RESTAURANT_DISTANCE_STEPS,
  },
  {
    type: "slider",
    key: "budgetBand",
    title: "תקציב",
    steps: RESTAURANT_BUDGET_STEPS,
  },
  {
    type: "multi-emoji",
    key: "cuisine",
    title: "איזה אוכל בא לכם?",
    options: CUISINE_OPTIONS,
  },
  {
    type: "text",
    key: "freeText",
    title: "משהו נוסף שתרצו להוסיף?",
    placeholder: "לדוגמה: חייב חניה, מקום שקט, ישיבה בחוץ...",
  },
];

interface RestaurantDurationRule {
  roles: StopRole[];
}

/**
 * "משך" כאן הוא לא שאלה למשתמש (כמו בטיול היומי) - נגזר אוטומטית משעת היום
 * (בוקר/צהריים/ערב), בדיוק כמו שהמסמך מתאר. מפתח יחיד "default" כי הבחירה
 * בפועל נעשית ע"י Claude בתוך הפרומפט, לא ע"י המשתמש בשאלון.
 */
export const RESTAURANTS_CAFES_DURATION_RULES: Record<string, RestaurantDurationRule> = {
  default: { roles: ["food", "coffee_dessert"] },
};

export const RESTAURANTS_CAFES_PLAN_PROMPT_RULES = `אתה מנוע ה-AI של TRIPLACE, למציאת המסעדה או בית הקפה המתאימים ביותר למשתמש.

המטרה היא להמליץ על **מקום אחד בלבד** - המתאים ביותר בדיוק לרגע הזה. אין לבנות סביבו
בילוי משלים או שרשרת תחנות - רק מקום אחד, מדויק.

*** משקל ההחלטה: המלל החופשי הוא הגורם המשמעותי ביותר. תחומי העניין הקולינריים
שסומנו הם בסיס, אבל אם המלל החופשי מבקש משהו ספציפי (אווירה, נוף, ישיבה בחוץ,
מקום שקט) - זה גובר. ***

חוקי חובה:
- אם המשתמש סימן כשרות - רק מקומות כשרים.
- אם המשתמש סימן צמחונות/טבעונות - עדיפות למקומות מתאימים.
- אם המשתמש מטייל עם כלב - עדיפות למקומות ידידותיים לבעלי חיים.
- המקום חייב להיות פתוח בזמן ההגעה המשוער.
- המקום חייב לעמוד בתקציב שנבחר.

--- אילוצים טכניים ליישום בקוד ---
- החזר בדיוק תחנה אחת בלבד ברשימה.
- קבע role: food או coffee_dessert בלבד.
- בחר רק מהקטגוריות שסופקו לך; אל תמציא קטגוריות חדשות.`;

export const RESTAURANTS_CAFES_RANKING_PROMPT_RULES = `דרג כל מועמד 0-100 לפי מידת ההתאמה שלו למשתמש הספציפי הזה, לא לפי איכות המקום בכללי.

המלל החופשי הוא מרכז ההחלטה (כ-90%) - נתח אווירה רצויה, מגבלות, בקשות מיוחדות
(נוף, ישיבה בחוץ, חניה, שקט וכו'). תחומי העניין הקולינריים שסומנו ופרופיל/היסטוריית
העדפות הם context משלים (כ-10% יחד).

שקול: סוג המטבח, מגבלות תזונה, כשרות, נגישות, בעלי חיים, תקציב, מרחק, דירוג, שעות
פתיחה בזמן ההגעה.

reason: משפט אחד בעברית, שמסביר קודם כל את הקשר למלל החופשי (אם קיים), ורק אז שאר
הנתונים. אם אין מידע אמיתי על אווירה/נוף וכו' - אל תמציא, נסח בזהירות.
אסור לתת לכל המועמדים ציון דומה; חובה לבדל.`;