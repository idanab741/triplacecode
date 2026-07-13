import { createBrowserClient } from "@supabase/ssr";

/**
 * לקוח Supabase לשימוש בקומפוננטות צד-לקוח ("use client").
 * ה-URL והמפתח מגיעים אך ורק ממשתני הסביבה (.env.local) — אין להקשיח אותם בקוד.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
