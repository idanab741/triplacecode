import type { SupabaseClient } from "@supabase/supabase-js";
import { getFollowCounts, isFollowing } from "./followService";
import { getFriendshipStatus, getFriendsCount } from "./friendService";

export interface SocialProfileDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  website: string | null;
  isCreator: boolean;
  profileVisibility: "public" | "private";
  counts: { followers: number; following: number; friends: number };
  viewerState: {
    isSelf: boolean;
    following: boolean;
    friendStatus: "none" | "pending" | "accepted" | "declined" | "blocked";
    friendshipId: string | null;
    isRequester: boolean;
  };
}

/** מביא פרופיל מלא לפי username, עם viewerState מחושב מול viewerId.
 *  ה-RLS על profiles כבר קובע אם השורה בכלל נגישה (public/creator/self). */
export async function getProfileByUsername(
  supabase: SupabaseClient,
  username: string,
  viewerId: string | null
): Promise<SocialProfileDto | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, cover_url, bio, website, is_creator, profile_visibility")
    .ilike("username", username)
    .maybeSingle();
  if (!profile) return null;

  const [counts, following, friendship] = await Promise.all([
    (async () => {
      const { followers, following } = await getFollowCounts(supabase, profile.id);
      const friends = await getFriendsCount(supabase, profile.id);
      return { followers, following, friends };
    })(),
    viewerId && viewerId !== profile.id ? isFollowing(supabase, viewerId, profile.id) : Promise.resolve(false),
    viewerId && viewerId !== profile.id ? getFriendshipStatus(supabase, viewerId, profile.id) : Promise.resolve(null),
  ]);

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    coverUrl: profile.cover_url,
    bio: profile.bio,
    website: profile.website,
    isCreator: profile.is_creator,
    profileVisibility: profile.profile_visibility,
    counts,
    viewerState: {
      isSelf: viewerId === profile.id,
      following,
      friendStatus: friendship?.status ?? "none",
      friendshipId: friendship?.id ?? null,
      isRequester: friendship?.isRequester ?? false,
    },
  };
}

/** קובע/מעדכן username. ולידציה בסיסית כאן, הפורמט/ייחודיות נאכפים גם ב-DB. */
export async function setUsername(supabase: SupabaseClient, userId: string, username: string): Promise<void> {
  const normalized = username.trim();
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalized)) {
    throw new Error("שם משתמש חייב להיות 3-30 תווים: אותיות באנגלית, ספרות וקו תחתון בלבד");
  }
  const { error } = await supabase.from("profiles").update({ username: normalized }).eq("id", userId);
  if (error) {
    if (error.code === "23505") throw new Error("שם המשתמש הזה כבר תפוס");
    throw error;
  }
}

export async function updateSocialProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: { bio?: string; coverUrl?: string; website?: string; profileVisibility?: "public" | "private" }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.bio !== undefined) payload.bio = updates.bio;
  if (updates.coverUrl !== undefined) payload.cover_url = updates.coverUrl;
  if (updates.website !== undefined) payload.website = updates.website;
  if (updates.profileVisibility !== undefined) payload.profile_visibility = updates.profileVisibility;
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}
