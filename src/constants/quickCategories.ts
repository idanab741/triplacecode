export type QuickCategoryId =
  | "restaurants_cafes"
  | "romantic_date"
  | "weekend"
  | "nature_trip"
  | "day_trip"
  | "abroad"
  | "nightlife";

export interface QuickCategoryDefinition {
  id: QuickCategoryId;
  /** משתנה ה-CSS של צבע ההדגשה (מתוך theme/tokens.css) */
  colorVar: string;
  /** נתיב לתמונת האייקון (public/images/categories) */
  imageSrc: string;
}

export const QUICK_CATEGORIES: QuickCategoryDefinition[] = [
  {
    id: "restaurants_cafes",
    colorVar: "--color-category-orange",
    imageSrc: "/images/categories/cat-restaurants.png",
  },
  {
    id: "romantic_date",
    colorVar: "--color-category-pink",
    imageSrc: "/images/categories/cat-romantic.png",
  },
  {
    id: "weekend",
    colorVar: "--color-category-purple",
    imageSrc: "/images/categories/cat-weekend.png",
  },
  {
    id: "nature_trip",
    colorVar: "--color-category-green",
    imageSrc: "/images/categories/cat-nature.png",
  },
  {
    id: "day_trip",
    colorVar: "--color-primary-start",
    imageSrc: "/images/categories/cat-daytrip.png",
  },
  {
    id: "abroad",
    // TODO: ודא שהמשתנה הזה מוגדר ב-theme/tokens.css, או החלף בטוקן קיים
    colorVar: "--color-category-purple",
    imageSrc: "/images/categories/cat-abroad.png",
  },
  {
    id: "nightlife",
    // TODO: ודא שהמשתנה הזה מוגדר ב-theme/tokens.css, או החלף בטוקן קיים
    colorVar: "--color-category-blue",
    imageSrc: "/images/categories/cat-nightlife.png",
  },
];

/**
 * מקור אמת יחיד למיפוי בין קטגוריה מהירה לסינון שנפתח ב-/search.
 * category = מזהי קטגוריה של places (בהתאמה ל-SEARCH_CATEGORY_CHIPS).
 * query = מונח חיפוש חופשי, לקטגוריות שאין להן קטגוריית places ברורה.
 */
export const QUICK_CATEGORY_SEARCH_LINKS: Record<
  QuickCategoryId,
  { categories?: string[]; query?: string }
> = {
  restaurants_cafes: { categories: ["restaurants_culinary", "coffee_carts_cafes"] },
  romantic_date: { query: "רומנטי" },
  weekend: { categories: ["hotels"] },
  nature_trip: { categories: ["nature_landscapes"] },
  day_trip: { categories: ["attractions"] },
  // TODO: אמת מול הצוות אילו קטגוריות/query מתאימים בפועל
  abroad: { query: "חופשה בחו\"ל" },
  nightlife: { query: "חיי לילה" },
};