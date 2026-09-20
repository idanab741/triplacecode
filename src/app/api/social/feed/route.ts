import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getFeed, type FeedTab } from "@/services/social/feedService";
import { getCollectionCards } from "@/services/social/collectionService";
import type { FeedEntryDto } from "@/services/social/collectionTypes";

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

  // *** אוספים (Collections) הם תוכן חברתי עצמאי - לא Post - ולכן נשלפים בנפרד ומתמזגים ל-Feed
  // לפי createdAt. שני המקורות נשלפים באותו cursor (created_at < cursor) ובאותו limit; אחרי המיזוג
  // חותכים ל-limit, וה-cursor הבא הוא createdAt של הפריט האחרון שהוחזר בפועל - פריטים שנשלפו
  // ונחתכו הם בהכרח ישנים יותר מה-cursor, ולכן ייטענו שוב בעמוד הבא (בלי כפילויות ובלי חורים).
  const PAGE_SIZE = 15;
  const [postsPage, collectionCards] = await Promise.all([
    getFeed(supabase, user.id, tab, PAGE_SIZE, cursor),
    // כשל בשליפת האוספים (למשל migration 0089 עוד לא הורצה) לא צריך להפיל את ה-Feed של הפוסטים.
    getCollectionCards(supabase, user.id, { tab, limit: PAGE_SIZE, cursor }).catch(() => []),
  ]);

  const entries: FeedEntryDto[] = [
    ...postsPage.items.map((item): FeedEntryDto => ({ kind: "post", item })),
    ...collectionCards.map((item): FeedEntryDto => ({ kind: "collection", item })),
  ].sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());

  const page = entries.slice(0, PAGE_SIZE);
  const hasMore = entries.length > PAGE_SIZE || postsPage.nextCursor !== null || collectionCards.length === PAGE_SIZE;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].item.createdAt : null;

  return NextResponse.json({ entries: page, nextCursor });
}
