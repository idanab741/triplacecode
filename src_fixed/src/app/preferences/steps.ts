import { PREFERENCES_TAXONOMY, emptyTaxonomySelections, type TaxonomySelections } from "@/locales/he/preferencesTaxonomy";
import { DIETARY_RESTRICTIONS, TRANSPORTATION } from "@/locales/he/preferences";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

/**
 * *** עיצוב מחדש מלא של אשף ההעדפות (בקשה מפורשת - "מחליף את כל
 * עמודי ההתאמה האישית"): במקום 5 השלבים הישנים (culinary_styles /
 * transportation / interests / accommodation_types / vacation_preferences,
 * כל אחד רשימה שטוחה של 5-19 צ'יפים) - עכשיו שלב אחד לכל אחת מ-6
 * הקטגוריות הראשיות של הטקסונומיה החדשה (PREFERENCES_TAXONOMY),
 * ובכל שלב: בחירה ברמת קבוצת-המשנה + אפשרות לפתוח ולבחור תגיות
 * ספציפיות בתוכה. ר' page.tsx למימוש ה-UI האנימטיבי.
 *
 * *** transportation / kosher / accessibility / dietary_restrictions
 * לא חלק מהטקסונומיה החדשה (זו לא "סוג מקום" אלא צורך/הגבלה נפרדים),
 * ונשארים בכוונה כשדות עצמאיים בשלב אחרון קומפקטי - הם עדיין
 * נקראים ישירות במקומות רבים באפליקציה (matching/ranking/travel DNA
 * וכו') ולכן לא הוסרו.
 *
 * *** טיפוסי הבחירה עצמם (CategorySelectionState / TaxonomySelections)
 * מוגדרים ב-locales/he/preferencesTaxonomy.ts (שכבה משותפת), לא כאן -
 * כדי ש-preferencesService.ts (שכבת שירות) לא יצטרך לייבא משכבת app/.
 */
export type TaxonomyFieldKey = TripAddCategory;

export interface TaxonomyCategoryStep {
  type: "taxonomy";
  key: TaxonomyFieldKey;
}

export interface ExtraStep {
  type: "extra";
}

export type PreferenceStep = TaxonomyCategoryStep | ExtraStep;

export const STEPS: PreferenceStep[] = [
  ...PREFERENCES_TAXONOMY.map((category): TaxonomyCategoryStep => ({ type: "taxonomy", key: category.id })),
  { type: "extra" },
];

export interface PreferencesFormState {
  taxonomy: TaxonomySelections;
  transportation: string[];
  dietary_restrictions: string[];
  kosher: boolean;
  accessibility_types: string[];
}

export const EMPTY_PREFERENCES_STATE: PreferencesFormState = {
  taxonomy: emptyTaxonomySelections(),
  transportation: [],
  dietary_restrictions: [],
  kosher: false,
  accessibility_types: [],
};

export { countCategorySelections } from "@/locales/he/preferencesTaxonomy";
export type { TaxonomySelections, CategorySelectionState } from "@/locales/he/preferencesTaxonomy";
export { TRANSPORTATION, DIETARY_RESTRICTIONS };
