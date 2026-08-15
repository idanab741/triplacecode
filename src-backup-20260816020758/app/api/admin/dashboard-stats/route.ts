import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const MONTH_LABELS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

/** מחזירה מדדי Dashboard אמיתיים בלבד - בכוונה בלי "Conversion ל-Premium"
 *  או "Retention" כי אין בסכמה הקיימת מושג של מנוי/פרימיום ואין טבלת
 *  אירועי login שמאפשרת לחשב retention אמיתי. כשיתווספו - קל להוסיף כאן. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("trip_builder_sessions")
    .select("user_id,trip_type,is_saved,final_itinerary,created_at");
  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalUsers = authData.users.length;
  const newUsersThisMonth = authData.users.filter((u) => new Date(u.created_at) >= startOfMonth).length;

  const builtSessions = (sessions ?? []).filter((s) => s.final_itinerary);
  const savedSessions = (sessions ?? []).filter((s) => s.is_saved);
  const activeUserIds = new Set((sessions ?? []).filter((s) => new Date(s.created_at) >= new Date(now.getTime() - 30 * 24 * 3600 * 1000)).map((s) => s.user_id));

  // הרשמות לפי חודש - 12 החודשים האחרונים
  const signupsByMonth = new Array(12).fill(0);
  const monthLabels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(MONTH_LABELS[d.getMonth()]);
  }
  for (const u of authData.users) {
    const d = new Date(u.created_at);
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < 12) signupsByMonth[11 - monthsAgo] += 1;
  }

  // מסלולים שנבנו לפי חודש
  const tripsByMonth = new Array(12).fill(0);
  for (const s of builtSessions) {
    const d = new Date(s.created_at);
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < 12) tripsByMonth[11 - monthsAgo] += 1;
  }

  // סוגי טיולים מובילים
  const typeCounts = new Map<string, number>();
  for (const s of sessions ?? []) {
    if (!s.trip_type) continue;
    typeCounts.set(s.trip_type, (typeCounts.get(s.trip_type) ?? 0) + 1);
  }
  const topTripTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  return NextResponse.json({
    totalUsers,
    newUsersThisMonth,
    activeUsers30d: activeUserIds.size,
    tripsBuilt: builtSessions.length,
    tripsSaved: savedSessions.length,
    monthLabels,
    signupsByMonth,
    tripsByMonth,
    topTripTypes,
  });
}
