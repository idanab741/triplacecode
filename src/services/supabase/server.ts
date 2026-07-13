import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * לקוח Supabase לשימוש ב-Server Components / Route Handlers.
 * קורא ורושם עוגיות session דרך next/headers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // מתרחש כשקוראים מתוך Server Component; ה-proxy דואג לרענון ה-session במקרה כזה
          }
        },
      },
    }
  );
}
