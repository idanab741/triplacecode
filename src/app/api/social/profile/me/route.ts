import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { updateSocialProfile } from "@/services/social/socialProfileService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const BASE = "id, username, full_name, avatar_url, cover_url, bio, website, is_creator, profile_visibility";
  // עמודות אופציונליות שנוספו במיגרציות מאוחרות (0091: instagram/tiktok, 0092: username_changed_at) - אם עוד לא הורצו,
  // יורדים בשקט לשאילתה קטנה יותר, כדי לא לשבור את עריכת הפרופיל.
  let { data: profile, error } = await supabase.from("profiles").select(`${BASE}, instagram, tiktok, username_changed_at`).eq("id", user.id).single();
  if (error) ({ data: profile, error } = await supabase.from("profiles").select(`${BASE}, instagram, tiktok`).eq("id", user.id).single());
  if (error) ({ data: profile, error } = await supabase.from("profiles").select(BASE).eq("id", user.id).single());
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
  try {
    await updateSocialProfile(supabase, user.id, {
      bio: body?.bio,
      coverUrl: body?.coverUrl,
      website: body?.website,
      instagram: body?.instagram,
      tiktok: body?.tiktok,
      profileVisibility: body?.profileVisibility,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    // שגיאת ולידציה (handle לא תקין) -> 422 עם ההודעה בעברית; אחרת 400.
    const message = err instanceof Error ? err.message : "שגיאה בעדכון הפרופיל";
    return NextResponse.json({ error: message }, { status: /שם משתמש/.test(message) ? 422 : 400 });
  }
}
