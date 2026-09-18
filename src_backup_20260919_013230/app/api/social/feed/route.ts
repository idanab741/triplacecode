import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getFeed, type FeedTab } from "@/services/social/feedService";

const VALID_TABS: FeedTab[] = ["for_you", "friends", "following"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tabParam = searchParams.get("tab");
  const tab: FeedTab = VALID_TABS.includes(tabParam as FeedTab) ? (tabParam as FeedTab) : "for_you";
  const cursor = searchParams.get("cursor") ?? undefined;

  const { items, nextCursor } = await getFeed(supabase, user.id, tab, 15, cursor);
  return NextResponse.json({ items, nextCursor });
}
