import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * נקודת החזרה מקישור אימות המייל של Supabase.
 * מחליפה את קוד האימות ב-session, ומנתבת לפי מצב הפרופיל.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        const destination = profile?.full_name ? "/home" : "/profile-setup";
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth`);
}
