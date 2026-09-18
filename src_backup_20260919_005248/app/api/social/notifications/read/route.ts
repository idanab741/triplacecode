import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { markSocialNotificationRead } from "@/services/social/socialNotificationsService";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const activityKey = body?.activityKey as string | undefined;
  if (!activityKey) return NextResponse.json({ error: "חסר activityKey" }, { status: 422 });

  await markSocialNotificationRead(supabase, user.id, activityKey);
  return NextResponse.json({ success: true });
}
