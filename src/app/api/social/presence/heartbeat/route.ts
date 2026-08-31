import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { heartbeat } from "@/services/social/onlinePresenceService";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  await heartbeat(supabase, user.id);
  return NextResponse.json({ success: true });
}
