import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * נקודת החזרה מקישור אימות המייל של Supabase.
 * מחליפה את קוד האימות ב-session, ומנתבת לפי מצב הפרופיל וההעדפות.
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
        const [{ data: profile }, { data: preferences }] = await Promise.all([
          supabase.from("profiles").select("full_name, intro_completed_at").eq("id", user.id).single(),
          supabase
            .from("user_preferences")
            .select("onboarding_completed_at")
            .eq("id", user.id)
            .single(),
        ]);

        let destination = "/profile-setup";
        if (profile?.full_name) {
          if (!profile?.intro_completed_at) {
            // עדיין לא ראה את סיור ה-Onboarding (5 מסכי "ברוכים הבאים") -
            // חובה להראות אותו כאן, כי משתמשי Google/Apple/אישור-מייל
            // "מדלגים" לגמרי על /profile-setup (הפרופיל כבר מלא מהספק),
            // אז שם לא הייתה להם אף הזדמנות לראות את זה.
            destination = "/onboarding";
          } else {
            destination = preferences?.onboarding_completed_at ? "/home" : "/preferences";
          }
        }
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth`);
}
