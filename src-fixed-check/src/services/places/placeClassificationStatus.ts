import { ADMIN_DISCOVERY_SECTIONS, type AdminDiscoverySection } from "@/constants/adminDiscoverySections";
import { QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES } from "@/constants/placeCategories";

export interface ClassifiablePlaceRow {
  id: string;
  category: string | null;
  subcategory: string | null;
  trip_type_tags: string[] | null;
  tags: string[] | null;
  cuisine_tags: string[] | null;
}

/** אותה לוגיקה בדיוק בכל מקום שבודק "האם המקום הזה כבר סווג לסקשן
 *  הזה" (characterization-stats, discovery-sections/all, כאן) - מקור
 *  אמת יחיד, לא שלוש גרסאות מקורבות. */
export function matchesSection(p: ClassifiablePlaceRow, section: AdminDiscoverySection): boolean {
  if (section.categoryColumnEquals) {
    const columnMatch = p.category === section.categoryColumnEquals;
    if (section.requiredAnyTags?.length) return columnMatch || section.requiredAnyTags.some((t) => (p.tags ?? []).includes(t));
    return columnMatch;
  }
  const groupIds = section.categories ?? (section.category ? [section.category] : []);
  if (groupIds.length > 0 || section.subcategories?.length) {
    const groupMatch = groupIds.some((c) => (p.trip_type_tags ?? []).includes(c));
    const subcatMatch = !!section.subcategories?.length && !!p.subcategory && section.subcategories.includes(p.subcategory);
    if (!groupMatch && !subcatMatch) return false;
  }
  if (section.requiredAnyTags?.length && !section.requiredAnyTags.some((t) => (p.tags ?? []).includes(t))) return false;
  if (section.requiredAnyCuisineTags?.length && !section.requiredAnyCuisineTags.some((t) => (p.cuisine_tags ?? []).includes(t))) return false;
  return true;
}

/** category -> אילו quickCategory ids "שם" הוא רלוונטי אליהם (ההופכי
 *  של QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES). "hotels" לא מופיע בשום
 *  quickCategory (המנגנון הזה מכסה רק את 5 סוגי הטיול מבוססי-הסקשנים -
 *  day_trip/nature_trip/restaurants_cafes/romantic_date/nightlife;
 *  מלונות/abroad/weekend עובדים אחרת לגמרי, לא חלק מהבדיקה הזו). */
const CATEGORY_TO_ELIGIBLE_QUICK_CATEGORIES: Record<string, string[]> = {};
for (const [quickCategory, categories] of Object.entries(QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES)) {
  for (const category of categories ?? []) {
    CATEGORY_TO_ELIGIBLE_QUICK_CATEGORIES[category] = [...(CATEGORY_TO_ELIGIBLE_QUICK_CATEGORIES[category] ?? []), quickCategory];
  }
}

/**
 * *** תיקון (באג אמיתי - "0% לא מאופיינות?? אין סיכוי!!"): ההגדרה
 * הקודמת ("יש ערך באחד לפחות מ-4 השדות") הייתה רפה מדי - מקום עם
 * subcategory אקראי/ישן שלא תואם לאף סקשן אמיתי נחשב "מאופיין" אצלה,
 * למרות שהוא לא מופיע בשום מקום בפועל. ההגדרה האמיתית שקובעת אם מקום
 * "מסווג" היא: **האם הוא תואם סקשן אמיתי אחד לפחות מתוך סוגי הטיול
 * שהוא בכלל רלוונטי אליהם** (לפי category) - בדיוק אותה שאלה שקובעת
 * needsClassification בתצוגת "הכל". זו עכשיו ההגדרה היחידה בכל המערכת.
 */
export function isGenuinelyUnclassified(p: ClassifiablePlaceRow): boolean {
  const eligibleQuickCategories = CATEGORY_TO_ELIGIBLE_QUICK_CATEGORIES[p.category ?? ""] ?? [];
  if (eligibleQuickCategories.length === 0) return false; // מלונות וכו' - לא חלק מהמנגנון הזה בכלל
  return eligibleQuickCategories.every((quickCategory) => {
    const sections = ADMIN_DISCOVERY_SECTIONS[quickCategory] ?? [];
    return !sections.some((section) => matchesSection(p, section));
  });
}
