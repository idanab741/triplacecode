import { INTERESTS } from "@/locales/he/preferences";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import { PLACE_CATEGORY_LABELS } from "@/constants/placeCategories";

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

  // סוגי מטבח - למסעדות ובתי קפה
  israeli: "ישראלי",
  italian: "איטלקי",
  asian: "אסייתי",
  bbq: "בשרים ועל האש",
  burger_diner: "המבורגר ודיינר אמריקאי",
  mexican: "מקסיקני",
  greek: "יווני",
  french_bistro: "ביסטרו צרפתי",
  indian: "הודי",
  mediterranean: "ים־תיכוני",
  seafood: "דגים ופירות ים",
  pizza: "פיצה",
  brunch: "ארוחת בוקר ובראנץ'",
  cafe: "בית קפה",
  sweets: "מאנצ'ים ומתוקים",
};

// כל תתי-התגיות (154) מתוך tripTaxonomy.ts - נבנה פעם אחת, לא בכל קריאה.
const SUBTAG_LABELS: Record<string, string> = Object.fromEntries(
  TRIP_TYPE_GROUPS.flatMap((group) => group.subTags.map((sub) => [sub.id, sub.label]))
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
  return EXTRA_CATEGORY_LABELS[categoryId] ?? SUBTAG_LABELS[categoryId] ?? categoryId;
}
