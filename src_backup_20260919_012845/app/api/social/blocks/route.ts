import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { blockUser, unblockUser, getBlockedUsers } from "@/services/social/blockService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const blocked = await getBlockedUsers(supabase, user.id);
  return NextResponse.json({ blocked });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const blockedId = body?.userId as string | undefined;
  if (!blockedId) return NextResponse.json({ error: "חסר userId" }, { status: 422 });

  try {
    await blockUser(supabase, user.id, blockedId);
    return NextResponse.json({ blocked: true });
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
  const blockedId = searchParams.get("userId");
  if (!blockedId) return NextResponse.json({ error: "חסר userId" }, { status: 422 });

  await unblockUser(supabase, user.id, blockedId);
  return NextResponse.json({ blocked: false });
}
