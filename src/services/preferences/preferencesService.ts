import { createClient } from "@/services/supabase/client";
import { recomputeTravelDna } from "@/services/travelDna/travelDnaService";
import type { TaxonomySelections } from "@/locales/he/preferencesTaxonomy";

export interface UserPreferences {
  id: string;
  /**
   * *** עמוד ההעדפות (`/preferences`) עבר לטקסונומיה החדשה והעשירה
   * (ר' `locales/he/preferencesTaxonomy.ts`) ולא ממלא יותר את 4
   * השדות הישנים למטה (culinary_styles / interests /
   * accommodation_types / vacation_preferences) - הם נשארים כאן
   * ובעמודת ה-DB רק כי עשרות קבצים אחרים (matching/ranking/travel
   * DNA/tripmatch/admin וכו') עדיין קוראים אותם ישירות; חיבור
   * המערכות האלה לטקסונומיה החדשה הוא עבודת המשך נפרדת שלא בוצעה
   * כאן. עד אז אלה ישקפו רק נתונים ישנים (או יהיו ריקים למשתמשים
   * חדשים שמילאו רק את האשף החדש).
   */
  culinary_styles: string[];
  dietary_restrictions: string[];
  kosher: boolean;
  accessibility: boolean;
  /** סוגי נגישות ספציפיים - ר' locales/he/preferences.ts ACCESSIBILITY_TYPES. */
  accessibility_types: string[];
  transportation: string[];
  interests: string[];
  accommodation_types: string[];
  vacation_preferences: string[];
  /**
   * בחירות האשף החדש: לכל קטגוריה (food/attraction/nature/shopping/
   * sleep/nightlife) - קבוצות-משנה שנבחרו בשלמותן + תגיות ספציפיות.
   * עמודת JSONB חדשה - דורשת מיגרציה ב-DB (לא בוצעה כאן, ר' סיכום).
   * אופציונלי כי שורות ישנות ב-DB לא יכילו את העמודה הזו עד המיגרציה.
   */
  taxonomy_selections?: TaxonomySelections | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PreferencesFields = Omit<UserPreferences, "id" | "created_at" | "updated_at">;

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

/** "הושלם" = המשתמש עבר את כל שלבי אשף ההעדפות (גם אם דילג על חלקם). */
export function isPreferencesComplete(preferences: UserPreferences | null): boolean {
  return Boolean(preferences?.onboarding_completed_at);
}

/** שמירת ביניים — לא מסמנת את התהליך כהושלם. */
export async function savePreferences(
  userId: string,
  updates: Partial<PreferencesFields>
) {
  const supabase = createClient();
  // upsert, מאותה סיבה כמו ב-profileService.updateProfile: אם שורת
  // ה-user_preferences חסרה (הטריגר לא רץ), update() נכשל בשקט.
  return supabase.from("user_preferences").upsert({ id: userId, ...updates });
}

/** שמירה סופית — מסמנת את האשף כהושלם, ומרעננת את ה-Travel DNA. */
export async function completePreferences(
  userId: string,
  updates: Partial<PreferencesFields>
) {
  const supabase = createClient();
  const result = await supabase
    .from("user_preferences")
    .upsert({ id: userId, ...updates, onboarding_completed_at: new Date().toISOString() });

  if (!result.error) {
    await recomputeTravelDna(supabase, userId);
  }

  return result;
}
