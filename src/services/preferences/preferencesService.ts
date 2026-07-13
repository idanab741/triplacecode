import { createClient } from "@/services/supabase/client";

export interface UserPreferences {
  id: string;
  culinary_styles: string[];
  dietary_restrictions: string[];
  kosher: boolean;
  accessibility: boolean;
  transportation: string[];
  interests: string[];
  accommodation_types: string[];
  vacation_preferences: string[];
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
  return supabase.from("user_preferences").update(updates).eq("id", userId);
}

/** שמירה סופית — מסמנת את האשף כהושלם. */
export async function completePreferences(
  userId: string,
  updates: Partial<PreferencesFields>
) {
  const supabase = createClient();
  return supabase
    .from("user_preferences")
    .update({ ...updates, onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);
}
