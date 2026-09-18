import type { TripAddCategory } from "@/services/tripadd/tripAddService";

/**
 * *** מיפוי בין קודי "תחומי עניין" הרחבים שנשמרים ב-user_preferences.interests
 * (עמוד הפרופיל/העדפות - src/locales/he/preferences.ts, 14 ערכים כלליים)
 * לבין קבוצות-המשנה העדינות בטקסונומיה של TripAdd (TRIPADD_SUBCATEGORIES).
 * אין קשר ישיר/אוטומטי בין שתי הרשימות בקוד (הן נבנו בהקשרים שונים
 * לגמרי) - זהו מיפוי ידני, לשימוש ב-FilterModal כדי להעלות קודם את
 * קבוצות-המשנה הרלוונטיות למי שבחר את תחום העניין הזה בפרופיל שלו
 * (בקשה מפורשת - "תתי הקטגוריות... מותאמות לפרופיל").
 *
 * *** בכוונה לא כל תחום עניין ממופה לקבוצה בכל קטגוריה, ובכוונה יש
 * תחומי עניין שממופים ליותר מקבוצה אחת/יותר מקטגוריה אחת (למשל
 * "events_festivals" רלוונטי גם למופעים תחת אטרקציות וגם למוזיקה
 * חיה תחת חיי לילה).
 */
export const INTEREST_SUBCATEGORY_GROUPS: Record<string, { category: TripAddCategory; group: string }[]> = {
  coffee_carts_cafes: [
    { category: "food", group: "בית קפה" },
    { category: "food", group: "אוכל רחוב" },
  ],
  nature_trails: [
    { category: "nature", group: "מסלולים וטיולים בטבע" },
    { category: "nature", group: "הרים ותצפיות טבעיות" },
  ],
  beaches_pools: [{ category: "nature", group: "חופים וים" }],
  viewpoints: [
    { category: "nature", group: "הרים ותצפיות טבעיות" },
    { category: "attraction", group: "תצפיות עירוניות" },
  ],
  parks_gardens: [{ category: "nature", group: "פארקים ושמורות טבע" }],
  water_amusement_parks: [{ category: "attraction", group: "מתחמי בילוי ושעשועים" }],
  attractions_activities: [
    { category: "attraction", group: "מבנים ואתרים אייקוניים" },
    { category: "attraction", group: "מופעים ובידור" },
  ],
  sports_extreme: [
    { category: "attraction", group: "אקסטרים והרפתקאות" },
    { category: "attraction", group: "ספורט ואצטדיונים" },
  ],
  restaurants_culinary: [
    { category: "food", group: "מסעדה" },
    { category: "food", group: "מזון מהיר" },
    { category: "food", group: "חוויה קולינרית" },
  ],
  wineries_breweries: [{ category: "food", group: "יקבים ומבשלות" }],
  culture_history: [{ category: "attraction", group: "תרבות והיסטוריה" }],
  shopping: [
    { category: "shopping", group: "קניונים ומרכזי קניות" },
    { category: "shopping", group: "רחובות ואזורי קניות" },
    { category: "shopping", group: "שווקים" },
    { category: "shopping", group: "חנויות מיוחדות" },
  ],
  events_festivals: [
    { category: "attraction", group: "מופעים ובידור" },
    { category: "nightlife", group: "מוזיקה חיה" },
  ],
  nightlife_entertainment: [
    { category: "nightlife", group: "ברים" },
    { category: "nightlife", group: "מועדונים ומסיבות" },
    { category: "nightlife", group: "מוזיקה חיה" },
    { category: "nightlife", group: "מועדוני חוף וגגות" },
    { category: "nightlife", group: "בילוי ובידור לילי" },
  ],
  spa_relaxation: [{ category: "attraction", group: "ספא ורוגע" }],
};
