import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { updateSocialProfile } from "@/services/social/socialProfileService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, cover_url, bio, website, is_creator, profile_visibility")
    .eq("id", user.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  await updateSocialProfile(supabase, user.id, {
    bio: body?.bio,
    coverUrl: body?.coverUrl,
    website: body?.website,
    profileVisibility: body?.profileVisibility,
  });
  return NextResponse.json({ success: true });
}
