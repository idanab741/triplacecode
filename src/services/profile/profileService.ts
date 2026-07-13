import { createClient } from "@/services/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  city: string | null;
  birth_date: string | null;
  country: string | null;
  avatar_url: string | null;
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

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "city" | "birth_date" | "country" | "avatar_url">>
) {
  const supabase = createClient();
  return supabase.from("profiles").update(updates).eq("id", userId);
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
