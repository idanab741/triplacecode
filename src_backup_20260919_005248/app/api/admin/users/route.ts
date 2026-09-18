import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * רשימת משתמשים ל-Admin - Summary בלבד (ר' דרישת ביצועים מפורשת - לא
 * לטעון חיפושים/likes/trips/activity מלאים לכל משתמש בטבלה הראשית;
 * המידע המפורט נטען רק בפתיחת ה-Drawer, ר' /api/admin/users/[id]).
 *
 * *** Data Discovery (לפני implementation, כנדרש בסעיף 33 של המפרט):
 * סרקתי את auth.users, profiles, user_preferences, trip_builder_sessions,
 * trippy_ai_results, tripmatch_sessions, favorites, travel_dna,
 * token_transactions, support_conversations, notifications. *** אין
 * טבלת search_history בקוד/DB בכלל - "מה המשתמש חיפש" לא נשמר היום
 * (רק "Free Text" של Trippy AI כן נשמר, ב-trippy_ai_results.free_text -
 * זה שונה). *** אין טבלת segments - "לאילו קהלים הוא שייך" לא קיים
 * היום. שני הממצאים האלה מוצגים כ"אין נתונים במערכת" ב-Drawer, לא מומצאים.
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "guest" ? "guest" : "registered";
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const accountFilter = searchParams.get("account") ?? ""; // active | inactive | onboarding_complete | onboarding_incomplete
  const registrationFilter = searchParams.get("registration") ?? ""; // today | 7d | 30d
  const activityFilter = searchParams.get("activity") ?? ""; // today | 7d | 30d | inactive
  const tripsFilter = searchParams.get("trips") ?? ""; // has | none
  const destinationFilter = (searchParams.get("destination") ?? "").trim().toLowerCase();
  const interestFilter = searchParams.get("interest") ?? "";
  const ageMin = searchParams.get("ageMin") ? Number(searchParams.get("ageMin")) : null;
  const ageMax = searchParams.get("ageMax") ? Number(searchParams.get("ageMax")) : null;

  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const allAuthUsers = authData.users;
  const registeredUsers = allAuthUsers.filter((u) => !u.is_anonymous);
  const guestUsers = allAuthUsers.filter((u) => u.is_anonymous);
  const scopedUsers = type === "guest" ? guestUsers : registeredUsers;
  const userIds = scopedUsers.map((u) => u.id);

  const [{ data: profiles }, { data: preferences }, { data: sessions }, { data: trippyResults }, { data: tokenTx }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", userIds),
    supabase.from("user_preferences").select("*").in("id", userIds),
    supabase.from("trip_builder_sessions").select("user_id,trip_type,is_saved,final_itinerary,created_at").in("user_id", userIds),
    supabase.from("trippy_ai_results").select("user_id,created_at").in("user_id", userIds),
    supabase.from("token_transactions").select("user_id,created_at").in("user_id", userIds),
  ]);
  const { data: favorites } = userIds.length ? await supabase.from("favorites").select("user_id,status,created_at").in("user_id", userIds) : { data: [] };

  interface ProfileRow {
    id: string;
    full_name: string | null;
    city: string | null;
    country: string | null;
    avatar_url: string | null;
    birth_date: string | null;
  }
  interface PrefsRow {
    id: string;
    interests: string[] | null;
    kosher: boolean | null;
    accessibility: boolean | null;
    onboarding_completed_at: string | null;
  }
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const prefsById = new Map(((preferences ?? []) as PrefsRow[]).map((p) => [p.id, p]));

  const tripsByUser = new Map<string, { built: number; saved: number; types: string[] }>();
  for (const s of sessions ?? []) {
    const entry = tripsByUser.get(s.user_id) ?? { built: 0, saved: 0, types: [] };
    if (s.final_itinerary) entry.built += 1;
    if (s.is_saved) entry.saved += 1;
    if (s.trip_type) entry.types.push(s.trip_type);
    tripsByUser.set(s.user_id, entry);
  }

  const likesByUser = new Map<string, number>();
  const savesByUser = new Map<string, number>();
  const lastActivityByUser = new Map<string, string>();
  function bumpActivity(userId: string, iso: string | null | undefined) {
    if (!iso) return;
    const current = lastActivityByUser.get(userId);
    if (!current || iso > current) lastActivityByUser.set(userId, iso);
  }
  for (const f of (favorites ?? []) as { user_id: string; status: string; created_at: string }[]) {
    if (f.status === "liked") likesByUser.set(f.user_id, (likesByUser.get(f.user_id) ?? 0) + 1);
    if (f.status === "saved") savesByUser.set(f.user_id, (savesByUser.get(f.user_id) ?? 0) + 1);
    bumpActivity(f.user_id, f.created_at);
  }
  for (const s of sessions ?? []) bumpActivity(s.user_id, s.created_at);
  for (const r of (trippyResults ?? []) as { user_id: string; created_at: string }[]) bumpActivity(r.user_id, r.created_at);
  for (const t of (tokenTx ?? []) as { user_id: string; created_at: string }[]) bumpActivity(t.user_id, t.created_at);

  let users = scopedUsers.map((u) => {
    const profile = profileById.get(u.id);
    const prefs = prefsById.get(u.id);
    const trips = tripsByUser.get(u.id) ?? { built: 0, saved: 0, types: [] };
    const lastActivity = lastActivityByUser.get(u.id) ?? u.last_sign_in_at ?? null;
    return {
      id: u.id,
      email: u.email ?? "",
      fullName: profile?.full_name ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      age: ageFromBirthDate(profile?.birth_date ?? null),
      isAnonymous: Boolean(u.is_anonymous),
      isBanned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
      signupDate: u.created_at,
      lastLogin: u.last_sign_in_at,
      lastActivity,
      tripsBuilt: trips.built,
      tripsSaved: trips.saved,
      favoriteTripTypes: Array.from(new Set(trips.types)).slice(0, 3),
      likes: likesByUser.get(u.id) ?? 0,
      saves: savesByUser.get(u.id) ?? 0,
      interests: prefs?.interests ?? [],
      kosher: prefs?.kosher ?? false,
      accessibility: prefs?.accessibility ?? false,
      onboardingCompleted: Boolean(prefs?.onboarding_completed_at),
    };
  });

  // --- חיפוש (שם/email/User ID/עיר/מדינה) ---
  if (search) {
    users = users.filter((u) => {
      const haystack = `${u.fullName ?? ""} ${u.email} ${u.id} ${u.city ?? ""} ${u.country ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  // --- Account ---
  if (accountFilter === "active") users = users.filter((u) => !u.isBanned);
  if (accountFilter === "inactive") users = users.filter((u) => u.isBanned);
  if (accountFilter === "onboarding_complete") users = users.filter((u) => u.onboardingCompleted);
  if (accountFilter === "onboarding_incomplete") users = users.filter((u) => !u.onboardingCompleted);

  // --- Registration ---
  if (registrationFilter) {
    const maxDays = registrationFilter === "today" ? 1 : registrationFilter === "7d" ? 7 : registrationFilter === "30d" ? 30 : null;
    if (maxDays !== null) users = users.filter((u) => (daysAgo(u.signupDate) ?? Infinity) < maxDays);
  }

  // --- Activity ---
  if (activityFilter) {
    if (activityFilter === "inactive") {
      users = users.filter((u) => (daysAgo(u.lastActivity) ?? Infinity) >= 30);
    } else {
      const maxDays = activityFilter === "today" ? 1 : activityFilter === "7d" ? 7 : 30;
      users = users.filter((u) => (daysAgo(u.lastActivity) ?? Infinity) < maxDays);
    }
  }

  // --- Trips ---
  if (tripsFilter === "has") users = users.filter((u) => u.tripsBuilt > 0);
  if (tripsFilter === "none") users = users.filter((u) => u.tripsBuilt === 0);

  // --- Interests ---
  if (interestFilter) users = users.filter((u) => u.interests.includes(interestFilter));

  // --- Age ---
  if (ageMin !== null) users = users.filter((u) => u.age !== null && u.age >= ageMin);
  if (ageMax !== null) users = users.filter((u) => u.age !== null && u.age <= ageMax);

  // --- Destination (חיפש/בחר/שמר - best effort ממקורות אמיתיים בלבד) ---
  let destinationUserIds: Set<string> | null = null;
  if (destinationFilter) {
    const { data: trippyCtx } = await supabase.from("trippy_ai_results").select("user_id,search_context").in("user_id", userIds);
    const { data: matchCities } = await supabase.from("trip_builder_sessions").select("user_id,answers").in("user_id", userIds).eq("trip_type", "tripmatch");
    const ids = new Set<string>();
    for (const r of (trippyCtx ?? []) as { user_id: string; search_context: unknown }[]) {
      const city = (r.search_context as { city?: string } | null)?.city?.toLowerCase() ?? "";
      if (city.includes(destinationFilter)) ids.add(r.user_id);
    }
    for (const s of (matchCities ?? []) as { user_id: string; answers: unknown }[]) {
      const a = s.answers as { destination?: string; requestedArea?: string } | null;
      const dest = `${a?.destination ?? ""} ${a?.requestedArea ?? ""}`.toLowerCase();
      if (dest.includes(destinationFilter)) ids.add(s.user_id);
    }
    destinationUserIds = ids;
  }
  if (destinationUserIds) users = users.filter((u) => destinationUserIds!.has(u.id));

  return NextResponse.json({
    users,
    counts: { registered: registeredUsers.length, guest: guestUsers.length },
  });
}
