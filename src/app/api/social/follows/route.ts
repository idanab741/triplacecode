import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { followUser, unfollowUser } from "@/services/social/followService";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const followingId = body?.userId as string | undefined;
  if (!followingId) return NextResponse.json({ error: "חסר userId" }, { status: 422 });

  try {
    await followUser(supabase, user.id, followingId);
    return NextResponse.json({ following: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const followingId = searchParams.get("userId");
  if (!followingId) return NextResponse.json({ error: "חסר userId" }, { status: 422 });

  await unfollowUser(supabase, user.id, followingId);
  return NextResponse.json({ following: false });
}
