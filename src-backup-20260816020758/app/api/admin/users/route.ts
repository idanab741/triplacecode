import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מחזירה את כל המשתמשים האמיתיים - משלבת Supabase Auth (email, תאריכי
 *  התחברות) עם profiles (שם/עיר/מדינה), user_preferences (תחומי עניין,
 *  Travel DNA-ish) וספירת מסלולים מ-trip_builder_sessions. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Supabase Auth Admin API - עד 1000 משתמשים לעמוד; לרוב מספיק לכלי אדמין.
  // אם יש יותר, אפשר להוסיף עימוד (page/perPage) בהמשך.
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userIds = authData.users.map((u) => u.id);

  const [{ data: profiles }, { data: preferences }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", userIds),
    supabase.from("user_preferences").select("*").in("id", userIds),
    supabase.from("trip_builder_sessions").select("user_id,trip_type,is_saved,final_itinerary").in("user_id", userIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const prefsById = new Map((preferences ?? []).map((p) => [p.id, p]));

  const tripsByUser = new Map<string, { built: number; saved: number; types: string[] }>();
  for (const s of sessions ?? []) {
    const entry = tripsByUser.get(s.user_id) ?? { built: 0, saved: 0, types: [] };
    if (s.final_itinerary) entry.built += 1;
    if (s.is_saved) entry.saved += 1;
    if (s.trip_type) entry.types.push(s.trip_type);
    tripsByUser.set(s.user_id, entry);
  }

  const users = authData.users.map((u) => {
    const profile = profileById.get(u.id);
    const prefs = prefsById.get(u.id);
    const trips = tripsByUser.get(u.id) ?? { built: 0, saved: 0, types: [] };
    return {
      id: u.id,
      email: u.email ?? "",
      fullName: profile?.full_name ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      isAnonymous: Boolean(u.is_anonymous),
      signupDate: u.created_at,
      lastLogin: u.last_sign_in_at,
      tripsBuilt: trips.built,
      tripsSaved: trips.saved,
      favoriteTripTypes: Array.from(new Set(trips.types)).slice(0, 3),
      interests: prefs?.interests ?? [],
      kosher: prefs?.kosher ?? false,
      accessibility: prefs?.accessibility ?? false,
      onboardingCompleted: Boolean(prefs?.onboarding_completed_at),
    };
  });

  return NextResponse.json({ users });
}
