import { createBrowserClient } from "@supabase/ssr";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 100; // 100 יום

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { maxAge: COOKIE_MAX_AGE_SECONDS } }
  );
}
