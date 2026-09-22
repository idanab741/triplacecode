import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import type { FeedTab } from "@/services/social/feedService";
import { getMergedFeedPage } from "@/services/social/feedPageService";

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

  // *** אוספים (Collections) וטיולים (Trips) הם תוכן חברתי עצמאי - לא Post - ולכן
  // נשלפים בנפרד ומתמזגים ל-Feed לפי createdAt. הלוגיקה עברה ל-feedPageService.ts
  // (משותפת עם עמוד ה-Places עצמו, שקורא לה ישירות בשרת לטעינת העמוד הראשון).
  const { entries, nextCursor } = await getMergedFeedPage(supabase, user.id, tab, cursor);

  return NextResponse.json({ entries, nextCursor });
}
