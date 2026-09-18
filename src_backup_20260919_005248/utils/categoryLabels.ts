import { INTERESTS } from "@/locales/he/preferences";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import { PLACE_CATEGORY_LABELS } from "@/constants/placeCategories";
import { CUISINE_TAGS as ADMIN_CUISINE_TAGS, PLACE_TYPE_TAGS as ADMIN_PLACE_TYPE_TAGS, TRIPMATCH_TAGS as ADMIN_TRIPMATCH_TAGS, DNA_TAGS as ADMIN_DNA_TAGS } from "@/constants/placeTagOptions";

/** תוויות לקטגוריות שאינן חלק מרשימת INTERESTS של ההעדפות. */
const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  attractions: "אטרקציות",
  hotels: "מלונות",
  coffee_carts_cafes: "עגלות קפה ובתי קפה",
  nature_trails: "מסלולי טבע ונופים",
  beaches_pools: "חופי ים ובריכות",
  viewpoints: "תצפיות, זריחות ושקיעות",
  parks_gardens: "פארקים וגנים",
  water_amusement_parks: "פארקי מים, שעשועים ומתקנים",
  attractions_activities: "אטרקציות ופעילויות",
  sports_extreme: "ספורט ואקסטרים",
  wineries_dining: "יקבים, מבשלות ומסעדות",
  culture_history: "תרבות, מוזיאונים והיסטוריה",
  shopping: "שופינג, קניות ושווקים",
  events_festivals: "אירועים ופסטיבלים",
spa_relaxation: "ספא ורוגע",

  // סוגי מטבח - למסעדות ובתי קפה. שומרים גם את המפתחות הישנים (bbq/brunch/
  // sweets) לתאימות לאחור עם נתונים שכבר נשמרו, וגם את המפתחות התואמים
  // ל-CULINARY_STYLES (locales/he/preferences.ts, ההתאמה האישית) - כדי
  // ששני המקומות ידברו באותה "שפה" ותהיה עקביות בין מה שנבחר בצ'אט לבין
  // מה שנלמד/מוצג מהפרופיל.
  israeli: "ישראלי",
  italian: "איטלקי",
  asian: "אסייתי",
  bbq: "בשרים ועל האש",
  meat_bbq: "בשרים ועל האש",
  burger_diner: "המבורגר ודיינר אמריקאי",
  mexican: "מקסיקני",
  greek: "יווני",
  french_bistro: "ביסטרו צרפתי",
  indian: "הודי",
  mediterranean: "ים־תיכוני",
  seafood: "דגים ופירות ים",
  pizza: "פיצה",
  brunch: "ארוחת בוקר ובראנץ'",
  breakfast_brunch: "ארוחת בוקר ובראנץ'",
  cafe: "בית קפה",
  sweets: "מאנצ'ים ומתוקים",
  snacks_sweets: "מאנצ'ים ומתוקים",
  fine_dining: "מסעדות שף",
  local_food: "אוכל מקומי",
};

// כל תתי-התגיות (154) מתוך tripTaxonomy.ts - נבנה פעם אחת, לא בכל קריאה.
const SUBTAG_LABELS: Record<string, string> = Object.fromEntries(
  TRIP_TYPE_GROUPS.flatMap((group) => group.subTags.map((sub) => [sub.id, sub.label]))
);

/**
 * *** תיקון: הטקסונומיה של האדמין (PLACE_TYPE_TAGS/CUISINE_TAGS/
 * TRIPMATCH_TAGS/DNA_TAGS ב-placeTagOptions.ts - זו ש"✨ תקן עם AI"
 * ב-/admin/places ממלא לתוך tags/cuisine_tags/tripmatch_scores/dna_scores)
 * לא הייתה מוכרת כאן בכלל - אף אחד מהערכים שלה (כמו "cocktail_bar",
 * "rooftop", "hotel") לא היה מתורגם, למרות שיש להם כבר תווית עברית
 * מוגדרת במקור. התוצאה: כל תיוג שנעשה באדמין נחסם ע"י hasHebrewLabel
 * ולא הופיע ב-TripMatch בכלל. עכשיו מאוחדים לתוך אותה טבלת תרגום.
 */
const ADMIN_TAXONOMY_LABELS: Record<string, string> = Object.fromEntries(
  [...ADMIN_CUISINE_TAGS, ...ADMIN_PLACE_TYPE_TAGS, ...ADMIN_TRIPMATCH_TAGS, ...ADMIN_DNA_TAGS].map((t) => [t.key, t.label])
);

export function getCategoryLabel(categoryId: string): string {
  // *** תיקון: השדה `places.category` אמור להכיל תמיד אחת מ-5 הקטגוריות
  // הראשיות (ראו src/constants/placeCategories.ts) - אלה נבדקות ראשונות
  // כדי שיוצגו נכון בעמודת "קטגוריה" גם אם קיים בטעות ערך זהה בשם ברשימות
  // האחרות (INTERESTS/EXTRA_CATEGORY_LABELS/SUBTAG_LABELS משמשות לתגיות
  // עדינות יותר כמו subcategory/tags, לא ל-category הראשי).
  if (PLACE_CATEGORY_LABELS[categoryId as keyof typeof PLACE_CATEGORY_LABELS]) {
    return PLACE_CATEGORY_LABELS[categoryId as keyof typeof PLACE_CATEGORY_LABELS];
  }
  const found = INTERESTS.find((option) => option.value === categoryId);
  if (found) return found.label;
  return EXTRA_CATEGORY_LABELS[categoryId] ?? SUBTAG_LABELS[categoryId] ?? ADMIN_TAXONOMY_LABELS[categoryId] ?? categoryId;
}

/**
 * true אם יש תרגום עברי אמיתי לתגית הזו. כמה נתיבי יצירה שונים באפליקציה
 * (יצירת אטרקציות ל-TripMatch, בונה הטיולים, ה-Discovery של האדמין) כל
 * אחד הזין בזמנים שונים ערכים חופשיים משלו (למשל "fine_dining",
 * "street_food") שלא קיימים באף אחת מרשימות התרגום - התוצאה: תגית באנגלית
 * מוצגת גולמית למשתמש. כדי להבטיח עברית בלבד בכל מקום שמציג תגיות
 * (ולא לרדוף אחרי כל נתיב יצירה בנפרד), משתמשים בפונקציה הזו כדי לסנן
 * ולהציג רק תגיות שבאמת יש להן תרגום.
 */
export function hasHebrewLabel(categoryId: string): boolean {
  return getCategoryLabel(categoryId) !== categoryId;
}
