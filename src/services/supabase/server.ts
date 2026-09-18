import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 100; // 100 יום - תואם ל-client.ts

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: COOKIE_MAX_AGE_SECONDS },
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
