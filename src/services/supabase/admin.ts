import { createClient } from "@supabase/supabase-js";

/**
 * לקוח Supabase עם הרשאות מלאות (service_role, עוקף RLS) - לשימוש אך ורק
 * בפעולות שרת מבוקרות (כמו הכנסת מקומות שנוצרו ע"י AI לטבלת places),
 * לעולם לא ייחשף לצד הלקוח.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}