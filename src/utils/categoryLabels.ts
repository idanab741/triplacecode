import { INTERESTS } from "@/locales/he/preferences";

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

export function getCategoryLabel(categoryId: string): string {
  const found = INTERESTS.find((option) => option.value === categoryId);
  if (found) return found.label;
  return EXTRA_CATEGORY_LABELS[categoryId] ?? categoryId;
}
