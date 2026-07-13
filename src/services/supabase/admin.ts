import { createClient } from "@supabase/supabase-js";

/**
 * לקוח Supabase עם ה-service_role key — עוקף RLS לגמרי.
 * לשימוש אך ורק בקוד צד-שרת (API Routes), אף פעם לא בצד הלקוח.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
