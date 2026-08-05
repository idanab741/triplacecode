import { createClient } from "@supabase/supabase-js";

/**
 * לקוח Supabase עם הרשאות מלאות (service_role, עוקף RLS) - לשימוש אך ורק
 * בפעולות שרת מבוקרות (כמו הכנסת מקומות שנוצרו ע"י AI לטבלת places),
 * לעולם לא ייחשף לצד הלקוח.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    // כשל ברור ומיידי - עדיף על שגיאה מסתורית ("{}") שמגיעה הרבה יותר
    // מאוחר מ-Supabase, ברגע שמנסים להשתמש במפתח undefined.
    throw new Error(
      `createAdminClient: משתני סביבה חסרים (${!url ? "NEXT_PUBLIC_SUPABASE_URL" : ""}${!url && !serviceRoleKey ? ", " : ""}${!serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""}). ודא שהם מוגדרים ב-.env.local (מקומית) וב-Vercel Environment Variables (בפרודקשן), ואז הפעל מחדש את השרת.`
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}