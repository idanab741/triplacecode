import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getFollowers } from "@/services/social/followService";

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { username } = await params;
  const { data: profile } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!profile) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const rows = await getFollowers(supabase, profile.id);
  const users = rows.map((r) => r.follower).filter(Boolean);
  return NextResponse.json({ users });
}
