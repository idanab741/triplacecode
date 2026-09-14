/**
 * *** טקסונומיה חדשה, עצמאית לגמרי, לשורת "סוגי הטיול" בעמוד הבית
 * (בקשה מפורשת - "קריטי להמשך הפיתוח"). בכוונה **לא** מחליפה/נוגעת
 * ב-constants/quickCategories.ts הקיים: אותו type (QuickCategoryId)
 * משמש גם את מערכת הניהול (adminDiscoverySections.ts, AddPlaceModal
 * של האדמין), את בורר הקטגוריות של Trippy AI (CategoryOptions.tsx),
 * ואת לוגיקת סיווג המקומות (placeClassificationStatus.ts) - שינוי שם
 * הערכים שם היה שובר את כל המערכות האלה, לא רק את שורת הבית. לכן
 * זו טקסונומיה נפרדת (HomeQuickCategoryId) עם קובץ קבועים משלה,
 * המשמשת רק את HomeQuickCategories.tsx בעמוד הבית.
 */
export type HomeQuickCategoryId =
  | "nature"
  | "attraction"
  | "food"
  | "nightlife"
  | "sleep"
  | "shopping";

export interface HomeQuickCategoryDefinition {
  id: HomeQuickCategoryId;
  /** משתנה ה-CSS של צבע ההדגשה (מתוך theme/tokens.css) */
  colorVar: string;
  /** נתיב לתמונת האייקון (public/images/categories) */
  imageSrc: string;
}

export const HOME_QUICK_CATEGORIES: HomeQuickCategoryDefinition[] = [
  {
    id: "attraction",
    colorVar: "--color-primary-start",
    imageSrc: "/images/categories/cat-attraction.png",
  },
  {
    id: "food",
    colorVar: "--color-category-orange",
    imageSrc: "/images/categories/cat-food.png",
  },
  {
    id: "shopping",
    colorVar: "--color-category-pink",
    imageSrc: "/images/categories/cat-shopping.png",
  },
  {
    id: "nature",
    colorVar: "--color-category-green",
    imageSrc: "/images/categories/cat-nature.png",
  },
  {
    id: "nightlife",
    colorVar: "--color-category-blue",
    imageSrc: "/images/categories/cat-nightlife.png",
  },
  {
    id: "sleep",
    colorVar: "--color-category-purple",
    imageSrc: "/images/categories/cat-sleep.png",
  },
];

/**
 * מיפוי לקישור ניווט. nature/attraction/food/nightlife מצביעות לאותם
 * עמודי Discovery קיימים בדיוק כמו הקטגוריות הישנות המקבילות (טיול
 * בטבע/טיול יומי/מסעדות וקפה/חיי לילה) - שום route חדש. sleep/shopping
 * הן קטגוריות חדשות לגמרי בלי עמוד Discovery ייעודי - מנותבות לחיפוש
 * הכללי (/search) לפי categories/query כאן.
 */
export const HOME_QUICK_CATEGORY_LINKS: Record<
  HomeQuickCategoryId,
  { href?: string; categories?: string[]; query?: string }
> = {
  nature: { href: "/trip-builder/nature-trip/discover" },
  attraction: { href: "/trip-builder/day-trip/discover" },
  food: { href: "/trip-builder/restaurants-cafes/discover" },
  nightlife: { href: "/trip-builder/nightlife/discover" },
  sleep: { categories: ["hotels"] },
  // *** אושר מול המשתמש - "אין קטגוריה כזאת" - אין category קיים
  // ל"קניות" במערכת ה-places; חיפוש טקסט חופשי בינתיים.
  shopping: { query: "קניות" },
};
