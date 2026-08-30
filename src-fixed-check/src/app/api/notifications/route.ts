import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getActivityFeed, type ActivityTab } from "@/services/notifications/notificationsService";

const VALID_TABS: ActivityTab[] = ["all", "trips", "system", "recommendations"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tabParam = searchParams.get("tab");
  const tab: ActivityTab = VALID_TABS.includes(tabParam as ActivityTab) ? (tabParam as ActivityTab) : "all";

  const { items, unreadCount } = await getActivityFeed(supabase, user.id, tab);
  return NextResponse.json({ notifications: items, unreadCount });
}
