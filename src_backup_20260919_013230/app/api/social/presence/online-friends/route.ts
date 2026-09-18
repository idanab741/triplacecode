import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getOnlineFriends } from "@/services/social/onlinePresenceService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const friends = await getOnlineFriends(supabase, user.id);
  return NextResponse.json({ friends });
}
