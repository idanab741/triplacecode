import type { SupabaseClient } from "@supabase/supabase-js";

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

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  timestamp: string;
  source: string;
}

/**
 * User 360° - כל מה שהמערכת יודעת בפועל על משתמש אחד + כל מה שהוא עשה
 * בתוך TRIPLACE. משותף בין /api/admin/users/[id] (GET, ל-Drawer) ו-
 * /api/admin/users/[id]/export (כדי שלא לשכפל את אותה שאילתה ענקית).
 *
 * *** עיקרון מוביל: כל section מבוסס על שאילתה אמיתית; אם מקור נתונים
 * לא קיים בקוד/DB (search history, segments), מוחזר available:false
 * ומטופל ב-UI כ"אין נתונים במערכת" - לא מומצא.
 */
export async function getUserFullDetail(supabase: SupabaseClient, userId: string) {
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authUser?.user) return null;
  const u = authUser.user;

  const [
    { data: profile },
    { data: preferences },
    { data: travelDna },
    { data: tokenBalanceRow },
    { data: tripBuilderSessions },
    { data: trippyResults },
    { data: tripMatchSessions },
    { data: favorites },
    { data: supportConvos },
    { data: destinationScores },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("id", userId).maybeSingle(),
    supabase.from("travel_dna").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_token_balances").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("trip_builder_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("trippy_ai_results").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("tripmatch_sessions").select("*").eq("user_id", userId),
    supabase.from("favorites").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("support_conversations").select("*").eq("user_id", userId).order("last_message_at", { ascending: false }),
    supabase.from("destination_match_scores").select("*,destinations(name,country)").eq("user_id", userId).order("score", { ascending: false }).limit(8),
  ]);

  const { data: tokenTx } = await supabase
    .from("token_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const placeIds = (favorites ?? []).filter((f) => f.place_type === "place").map((f) => f.place_id);
  const destIds = (favorites ?? []).filter((f) => f.place_type === "destination").map((f) => f.place_id);
  interface PlaceRow {
    id: string;
    name: string;
    category: string;
    city: string | null;
    country: string | null;
  }
  interface DestRow {
    id: string;
    name: string;
    country: string | null;
  }
  const [{ data: likedPlaces }, { data: likedDestinations }] = await Promise.all([
    placeIds.length ? supabase.from("places").select("id,name,category,city,country").in("id", placeIds) : Promise.resolve({ data: [] as PlaceRow[] }),
    destIds.length ? supabase.from("destinations").select("id,name,country").in("id", destIds) : Promise.resolve({ data: [] as DestRow[] }),
  ]);
  const placeById = new Map(((likedPlaces ?? []) as PlaceRow[]).map((p) => [p.id, p]));
  const destById = new Map(((likedDestinations ?? []) as DestRow[]).map((d) => [d.id, d]));

  function describeFavoritePlace(placeId: string, placeType: string) {
    if (placeType === "destination") {
      const d = destById.get(placeId);
      return d ? { name: d.name, category: "יעד", city: null, country: d.country } : { name: "מקום לא זמין", category: null, city: null, country: null };
    }
    const p = placeById.get(placeId);
    return p ? { name: p.name, category: p.category, city: p.city, country: p.country } : { name: "מקום לא זמין", category: null, city: null, country: null };
  }

  let supportLastMessage: { message: string; senderType: string; createdAt: string } | null = null;
  if (supportConvos && supportConvos.length > 0) {
    const { data: lastMsg } = await supabase
      .from("support_messages")
      .select("message,sender_type,created_at")
      .eq("conversation_id", supportConvos[0].id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastMsg) supportLastMessage = { message: lastMsg.message, senderType: lastMsg.sender_type, createdAt: lastMsg.created_at };
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(30);
  const { data: reads } = await supabase.from("notification_reads").select("activity_key").eq("user_id", userId);
  const readKeys = new Set((reads ?? []).map((r) => r.activity_key));
  const notificationsWithRead = (notifications ?? []).map((n) => ({ ...n, isRead: readKeys.has(`notif:${n.id}`) }));

  const timeline: TimelineEvent[] = [];
  timeline.push({ id: `reg:${u.id}`, type: "account", title: "נרשם/ה ל-TRIPLACE", subtitle: "", timestamp: u.created_at, source: "Auth" });
  if (u.last_sign_in_at) {
    timeline.push({ id: `login:${u.id}`, type: "account", title: "התחברות אחרונה", subtitle: "", timestamp: u.last_sign_in_at, source: "Auth" });
  }
  for (const s of tripBuilderSessions ?? []) {
    const dest = (s.answers as { destination?: string; requestedArea?: string } | null)?.destination ?? (s.answers as { requestedArea?: string } | null)?.requestedArea ?? "";
    timeline.push({
      id: `session:${s.id}`,
      type: s.trip_type === "tripmatch" ? "tripmatch" : "trip",
      title: s.final_itinerary ? `נבנה מסלול (${s.trip_type})` : `התחיל תהליך בניית טיול (${s.trip_type})`,
      subtitle: dest,
      timestamp: s.created_at,
      source: "Trip Builder",
    });
  }
  for (const r of trippyResults ?? []) {
    const city = (r.search_context as { city?: string } | null)?.city ?? "";
    timeline.push({ id: `trippy:${r.id}`, type: "trippy", title: "השתמש ב-Trippy AI", subtitle: r.title ? `${r.title}${city ? ` · ${city}` : ""}` : city, timestamp: r.created_at, source: "Trippy AI" });
  }
  for (const f of favorites ?? []) {
    const desc = describeFavoritePlace(f.place_id, f.place_type);
    const verb = f.status === "liked" ? "עשה Like ל-" : f.status === "saved" ? "שמר את" : "דילג על";
    timeline.push({ id: `fav:${f.id}`, type: "interaction", title: `${verb} ${desc.name}`, subtitle: desc.category ?? "", timestamp: f.created_at, source: "Likes/Saves" });
  }
  for (const c of supportConvos ?? []) {
    timeline.push({ id: `support:${c.id}`, type: "support", title: "פתח פנייה לשירות לקוחות", subtitle: "", timestamp: c.created_at, source: "Support" });
  }
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const tmSessions = (tripMatchSessions ?? []) as { id: string; city: string; category: string; liked_place_ids: string[]; rejected_place_ids: string[] }[];
  const totalLikes = tmSessions.reduce((sum, s) => sum + (s.liked_place_ids?.length ?? 0), 0);
  const totalRejects = tmSessions.reduce((sum, s) => sum + (s.rejected_place_ids?.length ?? 0), 0);
  const matchSessions = (tripBuilderSessions ?? []).filter((s) => s.trip_type === "tripmatch" && s.final_itinerary);

  return {
    account: {
      id: u.id,
      email: u.email ?? "",
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      age: ageFromBirthDate(profile?.birth_date ?? null),
      isAnonymous: Boolean(u.is_anonymous),
      isBanned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
      bannedUntil: u.banned_until ?? null,
      signupDate: u.created_at,
      lastLogin: u.last_sign_in_at ?? null,
      onboarding: {
        main: Boolean(profile?.main_onboarding_completed_at ?? profile?.intro_completed_at),
        tripmatch: Boolean(profile?.tripmatch_onboarding_completed_at),
        tripbuilding: Boolean(profile?.tripbuilding_onboarding_completed_at),
        preferences: Boolean(preferences?.onboarding_completed_at),
      },
      inviteCode: profile?.invite_code ?? null,
      referredBy: profile?.referred_by ?? null,
    },
    preferences: preferences ?? null,
    travelDna: travelDna ?? null,
    tokens: tokenBalanceRow ? { balance: tokenBalanceRow.balance, cycleStart: tokenBalanceRow.cycle_start } : null,
    tokenTransactions: tokenTx ?? [],
    freeText: (trippyResults ?? [])
      .filter((r) => r.free_text)
      .map((r) => ({ text: r.free_text, createdAt: r.created_at, screen: "Trippy AI", resultTitle: r.title })),
    searchHistory: { available: false, note: "המערכת לא שומרת היום היסטוריית חיפושים (search history) - רק את הטקסט החופשי שהוזן ב-Trippy AI (ר' Free Text)." },
    tripBuilderSessions: (tripBuilderSessions ?? []).map((s) => ({
      id: s.id,
      tripType: s.trip_type,
      status: s.status,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      destination: (s.answers as { destination?: string; requestedArea?: string } | null)?.destination ?? (s.answers as { requestedArea?: string } | null)?.requestedArea ?? null,
      isSaved: s.is_saved,
      hasFinalItinerary: Boolean(s.final_itinerary),
    })),
    trips: {
      built: (tripBuilderSessions ?? [])
        .filter((s) => s.final_itinerary)
        .map((s) => ({
          id: s.id,
          tripType: s.trip_type,
          destination: (s.answers as { destination?: string; requestedArea?: string } | null)?.destination ?? (s.answers as { requestedArea?: string } | null)?.requestedArea ?? null,
          isSaved: s.is_saved,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        })),
      drafts: (tripBuilderSessions ?? [])
        .filter((s) => !s.final_itinerary)
        .map((s) => ({ id: s.id, tripType: s.trip_type, status: s.status, createdAt: s.created_at, updatedAt: s.updated_at })),
    },
    likes: (favorites ?? [])
      .filter((f) => f.status === "liked")
      .map((f) => ({ ...describeFavoritePlace(f.place_id, f.place_type), placeId: f.place_id, createdAt: f.created_at })),
    saves: (favorites ?? [])
      .filter((f) => f.status === "saved")
      .map((f) => ({ ...describeFavoritePlace(f.place_id, f.place_type), placeId: f.place_id, createdAt: f.created_at })),
    tripMatch: {
      sessionsCount: tmSessions.length,
      cardsViewed: totalLikes + totalRejects,
      swipeRight: totalLikes,
      swipeLeft: totalRejects,
      matches: matchSessions.length,
      cities: Array.from(new Set(tmSessions.map((s) => s.city).filter(Boolean))),
      categories: Array.from(new Set(tmSessions.map((s) => s.category).filter(Boolean))),
    },
    trippyAi: {
      resultsCount: (trippyResults ?? []).length,
      lastUsed: trippyResults && trippyResults.length > 0 ? trippyResults[0].created_at : null,
      results: (trippyResults ?? []).slice(0, 20).map((r) => ({
        id: r.id,
        title: r.title,
        freeText: r.free_text,
        city: (r.search_context as { city?: string } | null)?.city ?? null,
        stopsCount: Array.isArray(r.stops) ? r.stops.length : 0,
        createdAt: r.created_at,
      })),
    },
    notifications: {
      total: notificationsWithRead.length,
      unread: notificationsWithRead.filter((n) => !n.isRead).length,
      items: notificationsWithRead.slice(0, 20).map((n) => ({ id: n.id, title: n.title, description: n.description, isRead: n.isRead, publishedAt: n.published_at })),
    },
    support: {
      conversationsCount: (supportConvos ?? []).length,
      lastStatus: supportConvos && supportConvos.length > 0 ? supportConvos[0].status : null,
      lastConversationId: supportConvos && supportConvos.length > 0 ? supportConvos[0].id : null,
      lastMessage: supportLastMessage,
    },
    segments: { available: false, note: "מערכת Segments טרם נבנתה - אין טבלה כזו במערכת היום." },
    destinationScores: (destinationScores ?? []).map((d) => ({
      destinationId: d.destination_id,
      destinationName: (d as unknown as { destinations?: { name: string; country: string } }).destinations?.name ?? "—",
      country: (d as unknown as { destinations?: { name: string; country: string } }).destinations?.country ?? "",
      score: d.score,
      reason: d.reason,
    })),
    activityTimeline: timeline.slice(0, 60),
  };
}

export type UserFullDetail = NonNullable<Awaited<ReturnType<typeof getUserFullDetail>>>;
