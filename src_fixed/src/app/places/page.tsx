import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { getMergedFeedPage } from "@/services/social/feedPageService";
import { PlacesFeedClient } from "@/screens/places/PlacesFeedClient";

/**
 * *** ביצועים (בקשה מפורשת - "הכל צריך לזרום מהר, כמו אינסטגרם/פייסבוק"):
 * זה היה עמוד לקוח מלא ("use client") - כל תוכן הפיד נטען *אחרי* שהדפדפן הוריד
 * והריץ את ה-JS, חיכה ל-AuthProvider (getSession אסינכרוני), ורק אז ירה בקשת
 * fetch לפיד. עכשיו זה Server Component: המשתמש וה-15 פריטים הראשונים נשלפים
 * בשרת ומגיעים מוכנים בתוך ה-HTML הראשוני - אין המתנה נראית-לעין ואין
 * round-trip נוסף רק כדי לראות את מסך הבית של Places. הכל אחריי (גלילה,
 * לייקים, מעקב) נשאר בדיוק כמו שהיה, ב-PlacesFeedClient.tsx.
 */
export default async function PlacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { entries, nextCursor } = await getMergedFeedPage(supabase, user.id, "for_you");

  return <PlacesFeedClient initialUser={user} initialEntries={entries} initialNextCursor={nextCursor} />;
}
