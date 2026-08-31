import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import {
  sendFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getFriends,
  getPendingFriendRequests,
} from "@/services/social/friendService";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // "pending" | undefined (= friends list)

  if (scope === "pending") {
    const requests = await getPendingFriendRequests(supabase, user.id);
    return NextResponse.json({ requests });
  }

  const friends = await getFriends(supabase, user.id);
  return NextResponse.json({ friends });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const addresseeId = body?.userId as string | undefined;
  if (!addresseeId) return NextResponse.json({ error: "חסר userId" }, { status: 422 });

  try {
    await sendFriendRequest(supabase, user.id, addresseeId);
    return NextResponse.json({ status: "pending" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}

/** ביטול בקשה שנשלחה (id=friendshipId, ?mode=cancel) או הסרת חבר קיים (?mode=remove) */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const friendshipId = searchParams.get("id");
  const mode = searchParams.get("mode") ?? "remove";
  if (!friendshipId) return NextResponse.json({ error: "חסר id" }, { status: 422 });

  if (mode === "cancel") {
    await cancelFriendRequest(supabase, friendshipId, user.id);
  } else {
    await removeFriend(supabase, friendshipId, user.id);
  }
  return NextResponse.json({ success: true });
}
