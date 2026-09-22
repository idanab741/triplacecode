import type { SupabaseClient } from "@supabase/supabase-js";
import { getFeed, type FeedTab } from "./feedService";
import { getCollectionCards } from "./collectionService";
import { getTripCards } from "./tripService";
import type { FeedEntryDto } from "./collectionTypes";

const PAGE_SIZE = 15;

/**
 * *** ביצועים (בקשה מפורשת - "הכל צריך לזרום מהר, כמו אינסטגרם/פייסבוק"):
 * הלוגיקה שהייתה כפולה בין /api/social/feed (טעינת "עוד") לבין עמוד ה-Places
 * (שהיה טוען הכל בצד הלקוח, אחרי שה-JS נטען, אחרי שה-auth נפתר) - עברה
 * לכאן, לפונקציה אחת משותפת. עכשיו עמוד ה-Places (page.tsx) הוא Server
 * Component שקורא לה ישירות בשרת ומזין את הפריטים הראשונים כ-props התחלתיים -
 * בלי לחכות ל-mount/hydration/auth-context/round-trip נוסף רק כדי לראות פיד ריק.
 * ה-API route ממשיך לשמש לעמודים הבאים (גלילה אינסופית), עם אותה פונקציה בדיוק.
 */
export async function getMergedFeedPage(
  supabase: SupabaseClient,
  userId: string,
  tab: FeedTab,
  cursor?: string
): Promise<{ entries: FeedEntryDto[]; nextCursor: string | null }> {
  const [postsPage, collectionCards, tripCards] = await Promise.all([
    getFeed(supabase, userId, tab, PAGE_SIZE, cursor),
    // כשל בשליפת האוספים/הטיולים לא צריך להפיל את ה-Feed של הפוסטים.
    getCollectionCards(supabase, userId, { tab, limit: PAGE_SIZE, cursor, excludePrivate: true }).catch(() => []),
    getTripCards(supabase, userId, { tab, limit: PAGE_SIZE, cursor, excludePrivate: true }).catch(() => []),
  ]);

  const entries: FeedEntryDto[] = [
    ...postsPage.items.map((item): FeedEntryDto => ({ kind: "post", item })),
    ...collectionCards.map((item): FeedEntryDto => ({ kind: "collection", item })),
    ...tripCards.map((item): FeedEntryDto => ({ kind: "trip", item })),
  ].sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());

  const page = entries.slice(0, PAGE_SIZE);
  const hasMore =
    entries.length > PAGE_SIZE ||
    postsPage.nextCursor !== null ||
    collectionCards.length === PAGE_SIZE ||
    tripCards.length === PAGE_SIZE;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].item.createdAt : null;

  return { entries: page, nextCursor };
}
