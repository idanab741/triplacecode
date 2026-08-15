import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** Completes email/OAuth authentication and resumes the same entry flow as password login. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/auth`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/auth`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/auth`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, main_onboarding_completed_at, intro_completed_at")
    .eq("id", user.id)
    .single();

  const destination = !profile?.full_name
    ? "/profile-setup"
    : !(profile.main_onboarding_completed_at ?? profile.intro_completed_at)
      ? "/onboarding"
      : "/home";
  return NextResponse.redirect(`${origin}${destination}`);
}
