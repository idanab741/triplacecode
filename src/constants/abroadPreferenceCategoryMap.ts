import { VACATION_PREFERENCES } from "@/locales/he/preferences";
import { WORLDWIDE_VACATION_CATEGORIES } from "@/constants/worldwideVacationCategories";

/**
 * מיפוי בין ערך העדפה בעמוד ההעדפות האישיות (vacation_preferences, למשל
 * "backpacking_trekking") לבין ה-id המקביל בקטגוריות "חופשה בחו''ל"
 * (worldwideVacationCategories.ts, למשל "backpacking") - שני מקורות נתונים
 * נפרדים עם שמות מזהה שונים לאותה קטגוריה בפועל.
 *
 * "cruise" (קרוזים ושייט) ממופה ל-categoryId="cruise" - מקרה מיוחד:
 * אין קטגוריה כזו ב-WORLDWIDE_VACATION_CATEGORIES (זו רשימת חברות
 * ספנות, CRUISE_LINES, לא יעדים), אז עמוד הקטגוריה (category/[id]/page.tsx)
 * מטפל ב-id="cruise" בנפרד ומציג שם את כרטיסי חברות הספנות במקום יעדים.
 */
export const PREFERENCE_TO_ABROAD_CATEGORY_ID: Record<string, string> = {
  beach_relax: "beaches-relax",
  casino_gambling: "casino-gambling",
  cruise: "cruise",
  family: "family",
  seasonal_holidays: "seasonal",
  honeymoon_romantic: "romantic-honeymoon",
  live_shows_festivals: "live-music-festivals",
  digital_nomad: "digital-nomad",
  luxury_indulgence: "luxury",
  spa_wellness_retreats: "spa-wellness",
  ski_winter_sports: "ski-winter-sports",
  sports_events: "sports-events",
  backpacking_trekking: "backpacking",
  tropical_vacation: "tropical",
  urban_city_trip: "urban",
  parties_nightlife: "nightlife-parties",
};

export interface AbroadPreferenceCategoryTile {
  /** ערך ההעדפה כמו שנשמר ב-vacation_preferences. */
  preferenceValue: string;
  /** id של הקטגוריה - משמש לבניית הקישור ל-category/[id]. "cruise" הוא
   *  מקרה מיוחד (ר' הערה למעלה). */
  categoryId: string;
  label: string;
  emoji: string;
  /** תמונת הכרטיס - מעמוד ההעדפות (לא תמונת יעד ספציפי). */
  imageSrc?: string;
}

/** כל 16 האריחים האפשריים (כולל "קרוזים ושייט"), בסדר VACATION_PREFERENCES. */
export const ALL_ABROAD_PREFERENCE_TILES: AbroadPreferenceCategoryTile[] = VACATION_PREFERENCES.filter(
  (pref) => pref.value in PREFERENCE_TO_ABROAD_CATEGORY_ID
).map((pref) => {
  const categoryId = PREFERENCE_TO_ABROAD_CATEGORY_ID[pref.value];
  const category = WORLDWIDE_VACATION_CATEGORIES.find((c) => c.id === categoryId);
  return {
    preferenceValue: pref.value,
    categoryId,
    label: pref.label,
    emoji: category?.emoji ?? "",
    imageSrc: pref.imageSrc,
  };
});
