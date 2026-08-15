import { createClient } from "@/services/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  city: string | null;
  birth_date: string | null;
  country: string | null;
  avatar_url: string | null;
  main_onboarding_completed_at: string | null;
  intro_completed_at?: string | null;
  tripmatch_onboarding_completed_at: string | null;
  tripbuilding_onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

/** פרופיל נחשב "שלם" כשיש בו שם מלא. */
export function isProfileComplete(profile: Profile | null): boolean {
  return Boolean(profile?.full_name && profile.full_name.trim().length > 0);
}

/** Existing accounts remain recognised while the status migration is rolled out. */
export function isMainOnboardingComplete(profile: Profile | null): boolean {
  return Boolean(profile?.main_onboarding_completed_at ?? profile?.intro_completed_at);
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "city" | "birth_date" | "country" | "avatar_url">>
) {
  const supabase = createClient();
  // upsert (לא update) - אם משום מה שורת ה-profiles של המשתמש עדיין
  // לא נוצרה (למשל הטריגר handle_new_user לא רץ, כמו שקרה עם משתמשי
  // Google/Apple), update() "מצליח בשקט" בלי לשנות כלום כי אין שורה
  // תואמת. upsert מבטיח שהשורה תיווצר כאן אם היא חסרה.
  return supabase.from("profiles").upsert({ id: userId, ...updates });
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
